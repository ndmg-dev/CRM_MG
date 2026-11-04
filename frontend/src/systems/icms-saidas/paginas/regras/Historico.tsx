// Aba Histórico: versões publicadas (com as alterações de cada uma) e a auditoria das regras.
import { useState } from "react";

import { consulta } from "../../api";
import { MensagemErro, Paginacao, useCarregar } from "../../componentes/comuns";
import { formatarCompetencia, formatarData } from "../../formato";
import type { EventoRegras, VersaoRegras, VersaoRegrasResumo } from "../../tipos";
import { Botao } from "../../ui/components/Botao";
import { Dialogo } from "../../ui/components/Dialogo";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { ResumoDiferencas } from "./diferencas";

const LIMITE_AUDITORIA = 50;

export function vigenciaDaVersao(v: Pick<VersaoRegrasResumo, "tipo" | "vigencia_inicio">): string {
  if (v.tipo === "INICIAL") return "Regras iniciais";
  if (v.tipo === "CORRECAO") return "Correção (todos os meses)";
  return `Mudança a partir de ${formatarCompetencia(v.vigencia_inicio)}`;
}

const ACOES: Record<string, string> = {
  "regras.semear": "Regras iniciais gravadas",
  "regras.rascunho.salvar": "Rascunho salvo",
  "regras.rascunho.descartar": "Rascunho descartado",
  "regras.publicar": "Publicação",
};

function quem(e: EventoRegras): string {
  return e.ator_externo ? `${e.ator_externo} (${e.ator})` : e.ator;
}

function oQue(e: EventoRegras): string {
  const partes = [ACOES[e.acao] ?? e.acao];
  if (e.acao === "regras.publicar" && e.alvo) partes[0] = `Publicação ${e.alvo}`;
  const n = e.detalhes.n_alteracoes;
  if (typeof n === "number") partes.push(`${n} alteraç${n === 1 ? "ão" : "ões"}`);
  if (typeof e.detalhes.motivo === "string" && e.detalhes.motivo) partes.push(`motivo: ${e.detalhes.motivo}`);
  return partes.join(" · ");
}

export function AbaHistorico() {
  const versoes = useCarregar<VersaoRegrasResumo[]>("/api/regras/versoes");
  const [offset, setOffset] = useState(0);
  const auditoria = useCarregar<EventoRegras[]>(`/api/regras/historico${consulta({ limit: LIMITE_AUDITORIA, offset })}`);
  const [aberta, setAberta] = useState<number | null>(null);
  const detalhe = useCarregar<VersaoRegras>(aberta === null ? null : `/api/regras/versoes/${aberta}`);

  const colunasVersoes: Coluna<VersaoRegrasResumo>[] = [
    { chave: "numero", titulo: "Versão", celula: (v) => `v${v.numero}` },
    { chave: "vigencia", titulo: "Vigência", celula: (v) => vigenciaDaVersao(v) },
    { chave: "resumo", titulo: "Resumo", celula: (v) => v.resumo || <span className="tabela__ausente">—</span> },
    { chave: "por", titulo: "Publicada por", celula: (v) => v.publicado_por },
    { chave: "quando", titulo: "Quando", celula: (v) => formatarData(v.criado_em) },
    { chave: "n", titulo: "Alterações", alinhar: "fim", celula: (v) => v.n_alteracoes.toLocaleString("pt-BR") },
    {
      chave: "ver",
      titulo: <span className="visualmente-oculto">Ações</span>,
      alinhar: "fim",
      celula: (v) =>
        v.tipo === "INICIAL" ? null : (
          <Botao tamanho="compacto" variante="fantasma" onClick={() => setAberta(v.numero)} aria-label={`Ver alterações da v${v.numero}`}>
            Ver alterações
          </Botao>
        ),
    },
  ];
  const colunasAuditoria: Coluna<EventoRegras>[] = [
    { chave: "quando", titulo: "Quando", celula: (e) => formatarData(e.quando) },
    { chave: "quem", titulo: "Quem", celula: quem },
    { chave: "oque", titulo: "O quê", celula: oQue },
  ];

  return (
    <div className="regras__aba">
      <h2>Versões publicadas</h2>
      <Tabela
        rotulo="Versões das regras"
        colunas={colunasVersoes}
        linhas={versoes.dados ?? []}
        chaveLinha={(v) => String(v.numero)}
        larguraMinima={800}
        estado={
          versoes.erro ? { tipo: "erro", titulo: "Não foi possível carregar as versões.", acao: <Botao onClick={versoes.recarregar}>Tentar de novo</Botao> }
          : versoes.carregando && !versoes.dados ? { tipo: "carregando", titulo: "Carregando versões…" }
          : versoes.dados && versoes.dados.length === 0 ? { tipo: "vazio", titulo: "Nenhuma versão publicada." }
          : null
        }
      />
      <h2>Auditoria</h2>
      <Tabela
        rotulo="Auditoria das regras"
        colunas={colunasAuditoria}
        linhas={auditoria.dados ?? []}
        chaveLinha={(e) => String(e.id)}
        estado={
          auditoria.erro ? { tipo: "erro", titulo: "Não foi possível carregar a auditoria.", acao: <Botao onClick={auditoria.recarregar}>Tentar de novo</Botao> }
          : auditoria.carregando && !auditoria.dados ? { tipo: "carregando", titulo: "Carregando auditoria…" }
          : auditoria.dados && auditoria.dados.length === 0 ? { tipo: "vazio", titulo: "Nenhum registro." }
          : null
        }
      />
      <Paginacao offset={offset} limite={LIMITE_AUDITORIA} quantidade={auditoria.dados?.length ?? 0} mudar={setOffset} />

      <Dialogo
        titulo={aberta === null ? "" : `Alterações da v${aberta}`}
        aberto={aberta !== null}
        onFechar={() => setAberta(null)}
        acoes={<Botao onClick={() => setAberta(null)}>Fechar</Botao>}
      >
        <MensagemErro erro={detalhe.erro} />
        {detalhe.carregando && <p role="status">Carregando…</p>}
        {detalhe.dados && detalhe.dados.numero === aberta && (
          <>
            <p className="regras__nota">
              {vigenciaDaVersao(detalhe.dados)} · {detalhe.dados.publicado_por} · {formatarData(detalhe.dados.criado_em)}
              {detalhe.dados.resumo && ` · ${detalhe.dados.resumo}`}
            </p>
            <ResumoDiferencas diferencas={detalhe.dados.diferencas} />
          </>
        )}
      </Dialogo>
    </div>
  );
}
