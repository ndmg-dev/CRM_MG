"""Sistema ICMS Saídas: o backend do CRM é o único que fala com o motor de apuração (repo tnunes8/motor-calculos).

LISTA FECHADA de rotas (uma função por rota, com método, caminho e parâmetros validados aqui) e permissão POR AÇÃO, configurável por
usuário (ADMIN tem todas). Injeta X-API-Key (segredo do servidor) e X-Actor (e-mail); a chave nunca vai ao navegador. Portado do BFF do
painel provisório (motor-icms-web). Erros no formato do motor: {"erro": {"codigo", "mensagem", "detalhes"}}.
"""
from __future__ import annotations

from typing import Annotated
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.core.security import get_current_user
from app.db.session import get_db
from app.integrations.icms_saidas import n8n
from app.integrations.icms_saidas import permissoes as perm
from app.integrations.icms_saidas.cliente import (
    _campo,
    _parametros,
    chamar_motor,
    ler_upload,
    ler_uploads_completar,
)
from app.integrations.icms_saidas.erros import ErroApi
from app.integrations.icms_saidas.rota import RotaIcms
from app.integrations.icms_saidas.schemas import (
    AceitarIdenticasIn,
    AprovarIn,
    CorrecoesIn,
    DescartarRegrasIn,
    EmpresaIn,
    EmpresaPatch,
    MotivoIn,
    PermissoesIn,
    PublicarRegrasIn,
    RascunhoRegrasIn,
    ResolverIn,
    ResolverLoteIn,
)
from app.integrations.icms_saidas.tipos import (
    RE_COMPETENCIA,
    RE_INICIO_MES,
    RE_MES,
    RE_TIPO_DIFERENCA,
    TIMEOUT_LEITURA,
    TIMEOUT_LONGO,
    Codigo,
    Competencia,
    Id,
    Limit,
    Offset,
    Pend,
    Status,
)
from app.models.audit_log import LogAuditoria
from app.models.user import Usuario
from app.models.usuario_permissao import UsuarioPermissao

router = APIRouter(route_class=RotaIcms)

Consultar = Annotated[Usuario, Depends(perm.exigir(perm.CONSULTAR))]
Operar = Annotated[Usuario, Depends(perm.exigir(perm.OPERAR))]
AprovarLotes = Annotated[Usuario, Depends(perm.exigir(perm.APROVAR_LOTES))]
GerirEmpresas = Annotated[Usuario, Depends(perm.exigir(perm.GERIR_EMPRESAS))]
EditarRegras = Annotated[Usuario, Depends(perm.exigir(perm.EDITAR_REGRAS))]
Admin = Annotated[Usuario, Depends(perm.exigir_admin)]

# ------------------------------------------------------------------------------------------------ permissões (CRM, não motor)


@router.get("/eu")
async def minhas_permissoes(
    usuario: Annotated[Usuario, Depends(get_current_user)], permissoes: Annotated[set[str], Depends(perm.obter_permissoes)]
) -> dict:
    """O que a pessoa logada pode fazer neste sistema (o front usa para mostrar/esconder botões; o backend confere de novo)."""
    return {"admin": usuario.perfil == "ADMIN", "permissoes": sorted(permissoes)}


@router.get("/permissoes/catalogo")
async def catalogo_permissoes(usuario: Admin) -> list[dict]:
    return perm.CATALOGO


@router.get("/permissoes/usuarios")
async def listar_usuarios_com_permissoes(
    usuario: Admin, db: Annotated[AsyncSession, Depends(get_db)], q: Annotated[str | None, Query(max_length=60)] = None
) -> list[dict]:
    """Usuários ativos com as permissões CONCEDIDAS (ADMIN tem todas e não precisa de concessão). Até 500, por nome."""
    consulta = select(Usuario).where(Usuario.ativo.is_(True)).order_by(Usuario.nome).limit(500)
    if q:
        padrao = f"%{q.strip().replace('%', '').replace('_', '')}%"
        consulta = consulta.where(Usuario.nome.ilike(padrao) | Usuario.email.ilike(padrao))
    usuarios = (await db.execute(consulta)).scalars().all()
    ids = [u.id for u in usuarios]
    concedidas: dict[UUID, list[str]] = {}
    if ids:
        for uid, p in (await db.execute(select(UsuarioPermissao.usuario_id, UsuarioPermissao.permissao).where(UsuarioPermissao.usuario_id.in_(ids)))).all():
            if p in perm.TODAS:
                concedidas.setdefault(uid, []).append(p)
    return [
        {"id": str(u.id), "nome": u.nome, "email": u.email, "perfil": u.perfil, "setor": u.setor, "admin": u.perfil == "ADMIN",
         "permissoes": sorted(concedidas.get(u.id, []))}
        for u in usuarios
    ]


@router.put("/permissoes/usuarios/{usuario_id}")
async def definir_permissoes(usuario_id: UUID, dados: PermissoesIn, admin: Admin, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Substitui as permissões concedidas ao usuário (conjunto completo). Fica na trilha de auditoria do CRM."""
    alvo = await db.scalar(select(Usuario).where(Usuario.id == usuario_id))
    if alvo is None:
        raise ErroApi(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado.")
    novas = sorted(set(dados.permissoes))
    desconhecidas = [p for p in novas if p not in perm.TODAS]
    if desconhecidas:
        raise ErroApi(422, "PERMISSAO_INVALIDA", "Permissão desconhecida.", desconhecidas[:8])
    await db.execute(delete(UsuarioPermissao).where(UsuarioPermissao.usuario_id == usuario_id, UsuarioPermissao.permissao.like(f"{perm.SISTEMA}.%")))
    for p in novas:
        db.add(UsuarioPermissao(usuario_id=usuario_id, permissao=p, granted_by=admin.id))
    db.add(LogAuditoria(usuario_id=admin.id, acao="ICMS_SAIDAS_PERMISSOES", alvo=f"Usuário {alvo.email}"[:255], detalhes={"usuario_alvo": str(usuario_id), "permissoes": novas}))
    await db.commit()
    return {"id": str(usuario_id), "permissoes": novas}


# ------------------------------------------------------------------------------------------------ rotas do motor


@router.get("/painel")
async def painel(request: Request, usuario: Consultar, competencia: Competencia = None) -> Response:
    return await chamar_motor(request, usuario, "GET", "/v1/painel", params=_parametros(competencia=competencia))


@router.get("/empresas")
async def listar_empresas(request: Request, usuario: Consultar, apenas_ativas: bool | None = None) -> Response:
    return await chamar_motor(request, usuario, "GET", "/v1/empresas", params=_parametros(apenas_ativas=apenas_ativas))


def disparador_n8n(request: Request) -> n8n.Disparador:
    """Um disparador por processo (guarda a janela de agrupamento dos pedidos)."""
    d = getattr(request.app.state, "icms_n8n", None)
    if d is None:
        d = n8n.Disparador(httpx.AsyncClient(follow_redirects=False, trust_env=False, timeout=n8n.TIMEOUT))
        request.app.state.icms_n8n = d
    return d


@router.post("/empresas")
async def criar_empresa(request: Request, usuario: GerirEmpresas, dados: EmpresaIn) -> Response:
    resposta = await chamar_motor(request, usuario, "POST", "/v1/empresas", corpo_json=dados.model_dump())
    if resposta.status_code < 300:
        # Pastas da empresa no Drive (n8n), depois de responder: falha aqui não afeta o cadastro.
        resposta.background = BackgroundTask(disparador_n8n(request).solicitar_sem_falhar, usuario.email, "empresa criada")
    return resposta


@router.post("/drive/preparar-pastas", status_code=202)
async def preparar_pastas(request: Request, usuario: GerirEmpresas) -> JSONResponse:
    """Pede ao n8n que crie no Drive as pastas das empresas que ainda não têm (agrupado: no máximo um disparo por minuto)."""
    if not n8n.Disparador.configurado():
        raise ErroApi(503, "INTEGRACAO_DESATIVADA", "A integração com o Drive (n8n) não está configurada.")
    situacao, ok = await disparador_n8n(request).solicitar(usuario.email, "botao")
    if not ok:
        raise ErroApi(502, "N8N_INDISPONIVEL", "O n8n não respondeu. As pastas serão criadas na próxima rodada (de hora em hora).")
    if situacao == "agendado":
        return JSONResponse({"situacao": situacao, "mensagem": "Pedido recebido. As pastas serão criadas em até 1 minuto."}, status_code=202)
    return JSONResponse({"situacao": situacao, "mensagem": "Pastas solicitadas. Elas aparecem no Drive em instantes."}, status_code=202)


@router.get("/empresas/{codigo}")
async def ver_empresa(request: Request, usuario: Consultar, codigo: Codigo) -> Response:
    return await chamar_motor(request, usuario, "GET", f"/v1/empresas/{codigo}")


@router.patch("/empresas/{codigo}")
async def alterar_empresa(request: Request, usuario: GerirEmpresas, codigo: Codigo, dados: EmpresaPatch) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "PATCH",
        f"/v1/empresas/{codigo}",
        empresa=codigo,
        corpo_json=dados.model_dump(exclude_unset=True),
    )


@router.get("/regras")
async def ver_regras(request: Request, usuario: Consultar, competencia: Competencia = None) -> Response:
    """Regras fiscais globais (ADR-007 do motor), só leitura: categorias e apelidos aceitos na coluna ICMS."""
    return await chamar_motor(request, usuario, "GET", "/v1/regras", params=_parametros(competencia=competencia))


@router.get("/regras/versoes")
async def versoes_regras(request: Request, usuario: Consultar) -> Response:
    return await chamar_motor(request, usuario, "GET", "/v1/regras/versoes")


@router.get("/regras/versoes/{numero}")
async def versao_regras(
    request: Request, usuario: Consultar, numero: Annotated[int, Path(ge=1, le=1_000_000)]
) -> Response:
    return await chamar_motor(request, usuario, "GET", f"/v1/regras/versoes/{numero}")


@router.get("/regras/historico")
async def historico_regras(
    request: Request,
    usuario: Consultar,
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
    offset: Offset = None,
) -> Response:
    params = _parametros(limit=limit, offset=offset)
    return await chamar_motor(request, usuario, "GET", "/v1/regras/historico", params=params)


@router.get("/regras/rascunho")
async def ver_rascunho_regras(
    request: Request, usuario: Consultar, vigencia_inicio: Annotated[str | None, Query(pattern=RE_MES)] = None
) -> Response:
    """Rascunho (ou as regras atuais) com diferenças e bloqueios; com `vigencia_inicio`, os bloqueios
    de uma mudança datada."""
    params = _parametros(vigencia_inicio=vigencia_inicio)
    return await chamar_motor(request, usuario, "GET", "/v1/regras/rascunho", params=params)


@router.put("/regras/rascunho")
async def salvar_rascunho_regras(request: Request, usuario: EditarRegras, dados: RascunhoRegrasIn) -> Response:
    return await chamar_motor(
        request, usuario, "PUT", "/v1/regras/rascunho", corpo_json=dados.model_dump(exclude_none=True)
    )


@router.post("/regras/rascunho/descartar")
async def descartar_rascunho_regras(request: Request, usuario: EditarRegras, dados: DescartarRegrasIn) -> Response:
    resposta = await chamar_motor(
        request, usuario, "POST", "/v1/regras/rascunho/descartar", corpo_json=dados.model_dump(exclude_none=True)
    )
    # O motor responde 204 sem corpo; o painel recebe JSON como nas demais rotas.
    if resposta.status_code == 204:
        return Response(b"{}", status_code=200, media_type="application/json")
    return resposta


@router.post("/regras/rascunho/publicar")
async def publicar_regras(request: Request, usuario: EditarRegras, dados: PublicarRegrasIn) -> Response:
    return await chamar_motor(
        request, usuario, "POST", "/v1/regras/rascunho/publicar", corpo_json=dados.model_dump(exclude_none=True)
    )


@router.post("/empresas/{codigo}/apuracoes")
async def criar_apuracao(request: Request, usuario: Operar, codigo: Codigo) -> Response:
    form, arquivo, nome, tipo = await ler_upload(request, {".xlsx"}, {"arquivo", "competencia", "origem"})
    try:
        competencia = _campo(form, "competencia", RE_COMPETENCIA)
        # "origem" do cliente é ignorada: o painel é sempre PORTAL.
        data = _parametros(competencia=competencia, origem="PORTAL")
        return await chamar_motor(
            request,
            usuario,
            "POST",
            f"/v1/empresas/{codigo}/apuracoes",
            empresa=codigo,
            files={"arquivo": (nome, arquivo.file, tipo)},
            data=data,
            timeout=TIMEOUT_LONGO,
        )
    finally:
        await form.close()


@router.get("/empresas/{codigo}/apuracoes")
async def listar_apuracoes(
    request: Request,
    usuario: Consultar,
    codigo: Codigo,
    competencia: Competencia = None,
    apenas_vigentes: bool | None = None,
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
    offset: Offset = None,
) -> Response:
    params = _parametros(competencia=competencia, apenas_vigentes=apenas_vigentes, limit=limit, offset=offset)
    return await chamar_motor(request, usuario, "GET", f"/v1/empresas/{codigo}/apuracoes", params=params)


@router.get("/empresas/{codigo}/apuracoes/{id}")
async def ver_apuracao(request: Request, usuario: Consultar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(request, usuario, "GET", f"/v1/empresas/{codigo}/apuracoes/{id}")


@router.get("/empresas/{codigo}/apuracoes/{id}/planilha")
async def baixar_planilha(request: Request, usuario: Consultar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(request, usuario, "GET", f"/v1/empresas/{codigo}/apuracoes/{id}/planilha", download=True)


@router.post("/empresas/{codigo}/apuracoes/{id}/reprocessar")
async def reprocessar(request: Request, usuario: Operar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/apuracoes/{id}/reprocessar",
        empresa=codigo,
        timeout=TIMEOUT_LONGO,
    )


@router.get("/empresas/{codigo}/pendencias")
async def listar_pendencias(
    request: Request,
    usuario: Consultar,
    codigo: Codigo,
    status: Status = None,
    limit: Limit = None,
    offset: Offset = None,
    sugestoes: bool | None = None,
) -> Response:
    """`sugestoes=true`: o motor anexa a cada pendência os itens parecidos da memória (ADR-010); timeout longo."""
    params = _parametros(status=status, limit=limit, offset=offset, sugestoes=sugestoes or None)
    return await chamar_motor(
        request,
        usuario,
        "GET",
        f"/v1/empresas/{codigo}/pendencias",
        params=params,
        timeout=TIMEOUT_LONGO if sugestoes else TIMEOUT_LEITURA,
        cabecalhos_resposta={"X-Total-Count": r"[0-9]{1,12}"},
    )


@router.get("/empresas/{codigo}/pendencias/resumo-sugestoes")
async def resumo_sugestoes_pendencias(request: Request, usuario: Consultar, codigo: Codigo) -> Response:
    """Panorama de TODAS as pendências abertas (idênticas aceitáveis, ambíguas, parecidas, sem sugestão)."""
    return await chamar_motor(
        request, usuario, "GET", f"/v1/empresas/{codigo}/pendencias/resumo-sugestoes", timeout=TIMEOUT_LONGO
    )


@router.post("/empresas/{codigo}/pendencias/aceitar-identicas")
async def aceitar_identicas_pendencias(
    request: Request, usuario: Operar, codigo: Codigo, dados: AceitarIdenticasIn
) -> Response:
    """Resolve de uma vez, em todas as páginas, só as pendências 100% idênticas (a decisão é do analista)."""
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/pendencias/aceitar-identicas",
        empresa=codigo,
        corpo_json=dados.model_dump(),
        timeout=TIMEOUT_LONGO,
    )


@router.get("/empresas/{codigo}/pendencias/exportar")
async def exportar_pendencias(request: Request, usuario: Consultar, codigo: Codigo) -> Response:
    """Planilha com TODAS as pendências abertas, para preencher a tributação e reenviar como lote parcial."""
    return await chamar_motor(
        request,
        usuario,
        "GET",
        f"/v1/empresas/{codigo}/pendencias/exportar",
        download=True,
        timeout=TIMEOUT_LONGO,
    )


@router.post("/empresas/{codigo}/pendencias/resolver-lote")
async def resolver_pendencias_em_lote(
    request: Request, usuario: Operar, codigo: Codigo, dados: ResolverLoteIn
) -> Response:
    """Resolve várias de uma vez (tudo ou nada, num só lote); a decisão do analista é a aprovação."""
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/pendencias/resolver-lote",
        empresa=codigo,
        corpo_json=dados.model_dump(),
        timeout=TIMEOUT_LONGO,
    )


@router.post("/empresas/{codigo}/pendencias/{pend}/resolver")
async def resolver_pendencia(
    request: Request, usuario: Operar, codigo: Codigo, pend: Pend, dados: ResolverIn
) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/pendencias/{pend}/resolver",
        empresa=codigo,
        corpo_json=dados.model_dump(exclude_none=True),
    )


@router.post("/empresas/{codigo}/pendencias/{pend}/descartar")
async def descartar_pendencia(
    request: Request, usuario: Operar, codigo: Codigo, pend: Pend, dados: MotivoIn
) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/pendencias/{pend}/descartar",
        empresa=codigo,
        corpo_json=dados.model_dump(),
    )


@router.get("/empresas/{codigo}/memoria")
async def ver_memoria(
    request: Request,
    usuario: Consultar,
    codigo: Codigo,
    competencia: Competencia = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Limit = None,
    offset: Offset = None,
) -> Response:
    params = _parametros(competencia=competencia, q=q, limit=limit, offset=offset)
    return await chamar_motor(request, usuario, "GET", f"/v1/empresas/{codigo}/memoria", params=params)


@router.get("/empresas/{codigo}/memoria/exportar")
async def exportar_memoria(
    request: Request, usuario: Consultar, codigo: Codigo, competencia: Competencia = None
) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "GET",
        f"/v1/empresas/{codigo}/memoria/exportar",
        params=_parametros(competencia=competencia),
        download=True,
    )


@router.post("/empresas/{codigo}/memoria/lotes")
async def criar_lote(request: Request, usuario: Operar, codigo: Codigo) -> Response:
    form, arquivo, nome, tipo_arquivo = await ler_upload(
        request, {".xlsx", ".csv"}, {"arquivo", "tipo", "vigencia_inicio"}
    )
    try:
        tipo = _campo(form, "tipo", r"^(COMPLETA|PARCIAL)$")
        # Sem vigência = correção de cadastro (vale para todos os meses); com vigência = mudança a partir do mês.
        vigencia = _campo(form, "vigencia_inicio", RE_INICIO_MES)
        if tipo is None:
            raise ErroApi(422, "REQUISICAO_INVALIDA", "Informe o tipo.")
        campos = {"tipo": tipo} if vigencia is None else {"tipo": tipo, "vigencia_inicio": vigencia}
        return await chamar_motor(
            request,
            usuario,
            "POST",
            f"/v1/empresas/{codigo}/memoria/lotes",
            empresa=codigo,
            files={"arquivo": (nome, arquivo.file, tipo_arquivo)},
            data=campos,
            timeout=TIMEOUT_LONGO,
        )
    finally:
        await form.close()


@router.post("/empresas/{codigo}/memoria/completar")
async def completar_memoria(request: Request, usuario: Operar, codigo: Codigo) -> Response:
    """Completa a memória com as descrições do ERP pelo código (ADR-010 do motor) e carrega o resultado como lote."""
    form, memoria, saidas, modo = await ler_uploads_completar(request)
    try:
        arquivos = [("memoria", (memoria[0], memoria[1].file, memoria[2]))]
        arquivos += [("saidas", (nome, arquivo.file, tipo)) for nome, arquivo, tipo in saidas]
        return await chamar_motor(
            request,
            usuario,
            "POST",
            f"/v1/empresas/{codigo}/memoria/completar",
            empresa=codigo,
            files=arquivos,
            data={"modo": modo},
            timeout=TIMEOUT_LONGO,
        )
    finally:
        await form.close()


@router.get("/empresas/{codigo}/memoria/lotes")
async def listar_lotes(request: Request, usuario: Consultar, codigo: Codigo, status: Status = None) -> Response:
    return await chamar_motor(
        request, usuario, "GET", f"/v1/empresas/{codigo}/memoria/lotes", params=_parametros(status=status)
    )


@router.get("/empresas/{codigo}/memoria/lotes/{id}")
async def ver_lote(request: Request, usuario: Consultar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(request, usuario, "GET", f"/v1/empresas/{codigo}/memoria/lotes/{id}")


@router.get("/empresas/{codigo}/memoria/lotes/{id}/diferencas")
async def diferencas_lote(
    request: Request,
    usuario: Consultar,
    codigo: Codigo,
    id: Id,
    tipo: Annotated[str | None, Query(pattern=RE_TIPO_DIFERENCA)] = None,
    q: Annotated[str | None, Query(max_length=60)] = None,
    limit: Limit = None,
    offset: Offset = None,
) -> Response:
    params = _parametros(tipo=tipo, q=q, limit=limit, offset=offset)
    return await chamar_motor(
        request,
        usuario,
        "GET",
        f"/v1/empresas/{codigo}/memoria/lotes/{id}/diferencas",
        params=params,
        cabecalhos_resposta={"X-Total-Count": r"[0-9]{1,12}"},
    )


@router.get("/empresas/{codigo}/memoria/lotes/{id}/relatorio.xlsx")
async def relatorio_lote(request: Request, usuario: Consultar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(
        request, usuario, "GET", f"/v1/empresas/{codigo}/memoria/lotes/{id}/relatorio.xlsx", download=True
    )


# Correção da importação: quem envia o arquivo (analista) resolve os problemas dele; aprovar continua só para admin.
# O motor relê o arquivo salvo (pode levar vários segundos em planilhas grandes): timeout longo.
@router.get("/empresas/{codigo}/memoria/lotes/{id}/problemas")
async def problemas_lote(request: Request, usuario: Consultar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(
        request, usuario, "GET", f"/v1/empresas/{codigo}/memoria/lotes/{id}/problemas", timeout=TIMEOUT_LONGO
    )


@router.get("/empresas/{codigo}/memoria/lotes/{id}/problemas.xlsx")
async def problemas_lote_xlsx(request: Request, usuario: Consultar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "GET",
        f"/v1/empresas/{codigo}/memoria/lotes/{id}/problemas.xlsx",
        download=True,
        timeout=TIMEOUT_LONGO,
    )


@router.put("/empresas/{codigo}/memoria/lotes/{id}/correcoes")
async def corrigir_lote(request: Request, usuario: Operar, codigo: Codigo, id: Id, dados: CorrecoesIn) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "PUT",
        f"/v1/empresas/{codigo}/memoria/lotes/{id}/correcoes",
        empresa=codigo,
        corpo_json=dados.model_dump(exclude_none=True),
        timeout=TIMEOUT_LONGO,
    )


@router.post("/empresas/{codigo}/memoria/lotes/{id}/reavaliar")
async def reavaliar_lote(request: Request, usuario: Operar, codigo: Codigo, id: Id) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/memoria/lotes/{id}/reavaliar",
        empresa=codigo,
        timeout=TIMEOUT_LONGO,
    )


@router.post("/empresas/{codigo}/memoria/lotes/{id}/aprovar")
async def aprovar_lote(request: Request, usuario: AprovarLotes, codigo: Codigo, id: Id, dados: AprovarIn) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/memoria/lotes/{id}/aprovar",
        empresa=codigo,
        corpo_json=dados.model_dump(exclude_none=True),
        timeout=TIMEOUT_LONGO,
    )


@router.post("/empresas/{codigo}/memoria/lotes/{id}/rejeitar")
async def rejeitar_lote(request: Request, usuario: AprovarLotes, codigo: Codigo, id: Id, dados: MotivoIn) -> Response:
    return await chamar_motor(
        request,
        usuario,
        "POST",
        f"/v1/empresas/{codigo}/memoria/lotes/{id}/rejeitar",
        empresa=codigo,
        corpo_json=dados.model_dump(),
    )
