"""Corpos JSON aceitos (validados AQUI, antes de chegar ao motor). Portados do BFF do painel."""
from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from .tipos import RE_CNPJ, RE_INICIO_MES, RE_MES, TABELAS_REGRAS, IdDiferenca, Texto


def _razao_social(valor: str) -> str:
    """Razão social sempre em MAIÚSCULAS (com acentos), espaços repetidos reduzidos a um."""
    limpa = " ".join(valor.split()).upper()
    if len(limpa) < 2:
        raise ValueError("razão social precisa de pelo menos 2 caracteres")
    return limpa


RazaoSocial = Annotated[str, Field(min_length=2, max_length=200), AfterValidator(_razao_social)]


class EmpresaIn(BaseModel):
    """Sem `codigo`: o motor gera o código (0001, 0002…)."""

    model_config = ConfigDict(extra="forbid")
    razao_social: RazaoSocial
    cnpj: str | None = Field(default=None, pattern=RE_CNPJ)


class EmpresaPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    razao_social: RazaoSocial | None = None
    cnpj: str | None = Field(default=None, pattern=RE_CNPJ)
    ativo: bool | None = None


class AprovarIn(BaseModel):
    """Aprovação item a item: `diferencas` (só estas) ou `excluir` (todas menos estas); ausentes os dois = todas.
    O front manda a lista menor, para caber no teto do corpo JSON. As demais regras (ids do lote, nada a aplicar)
    são conferidas pelo motor."""

    model_config = ConfigDict(extra="forbid")
    confirmar_remocoes: bool = False
    diferencas: list[IdDiferenca] | None = None
    excluir: list[IdDiferenca] | None = None

    @model_validator(mode="after")
    def _selecao(self) -> AprovarIn:
        if self.diferencas is not None and self.excluir is not None:
            raise ValueError("Informe 'diferencas' ou 'excluir', não os dois.")
        for lista in (self.diferencas, self.excluir):
            if lista is not None and len(set(lista)) != len(lista):
                raise ValueError("Seleção com diferença repetida.")
        return self


# Correção assistida da importação da memória (ADR-009 do motor): decisões do operador sobre as linhas com problema.
# O formato fino (categoria existente, decisão sem problema correspondente) é conferido pelo motor.
MAX_CORRECOES = 500  # o corpo JSON do BFF tem teto de 64 KB; acima disso o operador usa a planilha de problemas
TextoCurto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
NumeroLinha = Annotated[int, Field(strict=True, ge=2, le=1_000_000)]


class _Decisao(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MapearCategoria(_Decisao):
    tipo: Literal["MAPEAR_CATEGORIA"]
    texto: TextoCurto
    categoria: TextoCurto


class IgnorarCategoria(_Decisao):
    tipo: Literal["IGNORAR_CATEGORIA"]
    texto: TextoCurto


class CorrigirLinha(_Decisao):
    tipo: Literal["CORRIGIR_LINHA"]
    linha: NumeroLinha
    descricao: Annotated[str, StringConstraints(max_length=300)] | None = None
    ncm: Annotated[str, StringConstraints(max_length=20)] | None = None
    icms: TextoCurto | None = None
    pis_cofins: Annotated[str, StringConstraints(max_length=60)] | None = None

    @model_validator(mode="after")
    def _algum_campo(self) -> CorrigirLinha:
        if all(getattr(self, c) is None for c in ("descricao", "ncm", "icms", "pis_cofins")):
            raise ValueError("Informe ao menos um campo a corrigir.")
        return self


class IgnorarLinha(_Decisao):
    tipo: Literal["IGNORAR_LINHA"]
    linha: NumeroLinha


class EscolherConflito(_Decisao):
    tipo: Literal["ESCOLHER_CONFLITO"]
    descricao: Annotated[str, StringConstraints(min_length=1, max_length=300)]
    ncm: Annotated[str, StringConstraints(min_length=1, max_length=20)]
    categoria: TextoCurto


Correcao = Annotated[
    MapearCategoria | IgnorarCategoria | CorrigirLinha | IgnorarLinha | EscolherConflito, Field(discriminator="tipo")
]


class CorrecoesIn(BaseModel):
    """Conjunto COMPLETO de decisões do lote (o motor substitui o anterior); [] = limpar."""

    model_config = ConfigDict(extra="forbid")
    correcoes: list[Correcao] = Field(max_length=MAX_CORRECOES)


class RascunhoRegrasIn(BaseModel):
    """O rascunho inteiro (as 5 tabelas). O formato fino (nomes, faixas, duplicatas) é validado pelo motor
    (422 REGRAS_INVALIDAS)."""

    model_config = ConfigDict(extra="forbid")
    conteudo: dict[str, Any]
    base_versao: int | None = Field(default=None, ge=1, le=1_000_000)

    @model_validator(mode="after")
    def _tabelas(self) -> RascunhoRegrasIn:
        desconhecidas = set(self.conteudo) - TABELAS_REGRAS
        if desconhecidas:
            raise ValueError(f"Tabela desconhecida em 'conteudo': {', '.join(sorted(desconhecidas))}.")
        return self


class DescartarRegrasIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    motivo: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


class PublicarRegrasIn(BaseModel):
    """Correção (todos os meses, sem data) ou mudança a partir de AAAA-MM; a regra de negócio fica no motor."""

    model_config = ConfigDict(extra="forbid")
    tipo: Literal["CORRECAO", "MUDANCA"]
    vigencia_inicio: str | None = Field(default=None, pattern=RE_MES)
    resumo: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""
    confirmar_impacto: bool = False


class MotivoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    motivo: Texto


class ResolverIn(BaseModel):
    """Item novo vale para todos os meses: `vigencia_inicio` é opcional (e só repassado se vier)."""

    model_config = ConfigDict(extra="forbid")
    tributacao: str = Field(min_length=1, max_length=60)
    vigencia_inicio: str | None = Field(default=None, pattern=RE_INICIO_MES)


MAX_RESOLUCOES = 500  # o corpo JSON do BFF tem teto de 64 KB; o motor aceita até 1000 por chamada


class ResolucaoIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pendencia_id: Annotated[int, Field(strict=True, ge=1, le=2**53)]
    tributacao: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class AceitarSugestoesIn(BaseModel):
    """Aceita, de todas as páginas, a sugestão do sistema nas pendências abertas. O operador só escolhe a semelhança mínima; QUAIS
    pendências e qual tributação ficam a cargo do motor (nunca vêm do cliente)."""

    model_config = ConfigDict(extra="forbid")
    similaridade_minima: float = Field(0.0, ge=0.0, le=1.0)
    sobrescrever: bool = False


class AceitarIdenticasIn(BaseModel):
    """Aceita, de todas as páginas, as pendências com sugestão idêntica e consistente (o motor decide quais)."""

    model_config = ConfigDict(extra="forbid")
    sobrescrever: bool = False


class ResolverLoteIn(BaseModel):
    """Várias pendências de uma vez, cada uma com a tributação escolhida. Categoria e estado: o motor confere."""

    model_config = ConfigDict(extra="forbid")
    resolucoes: list[ResolucaoIn] = Field(min_length=1, max_length=MAX_RESOLUCOES)
    # false (padrão): item que já está na memória permanece; true: a tributação da pendência o substitui.
    sobrescrever: bool = False

    @model_validator(mode="after")
    def _sem_repetidas(self) -> ResolverLoteIn:
        ids = [r.pendencia_id for r in self.resolucoes]
        if len(set(ids)) != len(ids):
            raise ValueError("Pendência repetida no pedido.")
        return self


class PermissoesIn(BaseModel):
    """Conjunto COMPLETO de permissões concedidas ao usuário (substitui o anterior); [] = revogar tudo."""

    model_config = ConfigDict(extra="forbid")
    permissoes: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]] = Field(max_length=20)
