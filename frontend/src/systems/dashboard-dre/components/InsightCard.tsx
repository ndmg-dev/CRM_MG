"use client";

import { useState } from "react";
import { Nota } from "./ui";
import type { Insight, Severidade } from "../lib/insights";
import { nomeMes } from "../lib/metrics";
import type {
  Anotacao,
  CampoLimpavel,
  StatusAnotacao,
} from "../lib/anotacoes/tipos";

const ESTILO: Record<
  Severidade,
  { rotulo: string; cor: string; fundo: string; borda: string }
> = {
  critico: {
    rotulo: "crítico",
    cor: "var(--neg)",
    fundo: "color-mix(in srgb, var(--neg) 10%, transparent)",
    borda: "color-mix(in srgb, var(--neg) 35%, transparent)",
  },
  alerta: {
    rotulo: "alerta",
    cor: "var(--gold)",
    fundo: "var(--gold-tint)",
    borda: "color-mix(in srgb, var(--gold) 35%, transparent)",
  },
  info: {
    rotulo: "info",
    cor: "var(--text-muted)",
    fundo: "var(--panel-2)",
    borda: "var(--border-strong)",
  },
};

const STATUS_ROTULO: Record<StatusAnotacao, string> = {
  em_aberto: "Em aberto",
  verificado: "Verificado",
  descartado: "Descartado",
};

const STATUS_COR: Record<StatusAnotacao, string> = {
  em_aberto: "var(--text-muted)",
  verificado: "var(--pos)",
  descartado: "var(--text-faint)",
};

interface Props {
  insight: Insight;
  anotacao: Anotacao | null;
  editavel: boolean;
  salvando: boolean;
  onSalvar: (chave: string, entrada: Record<string, unknown>) => Promise<boolean>;
  onLimpar: (chave: string, campos: CampoLimpavel[]) => Promise<boolean>;
}

export function InsightCard({
  insight,
  anotacao,
  editavel,
  salvando,
  onSalvar,
  onLimpar,
}: Props) {
  const estilo = ESTILO[insight.severidade];
  const status: StatusAnotacao = anotacao?.status ?? "em_aberto";
  const descartado = status === "descartado";

  // 🔴 Texto exibido = editado ?? gerado. O número nunca vem daqui.
  const titulo = anotacao?.tituloEditado ?? insight.titulo;
  const descricao = anotacao?.descricaoEditada ?? insight.descricao;
  const acao = anotacao?.acaoEditada ?? insight.acao;
  const temTextoEditado = Boolean(
    anotacao?.tituloEditado ?? anotacao?.descricaoEditada ?? anotacao?.acaoEditada,
  );

  const [editando, setEditando] = useState(false);
  const [comentando, setComentando] = useState(false);
  const [rascunho, setRascunho] = useState({ titulo, descricao, acao });
  const [comentario, setComentario] = useState(anotacao?.comentario ?? "");
  const [autor, setAutor] = useState(anotacao?.autor ?? "");

  // O rascunho é semeado ao ENTRAR em edição, não por efeito de sincronização:
  // assim uma atualização vinda do servidor nunca apaga o que está sendo digitado.
  const abrirEdicao = () => {
    setRascunho({ titulo, descricao, acao });
    setAutor(anotacao?.autor ?? "");
    setEditando(true);
  };

  const abrirComentario = () => {
    setComentario(anotacao?.comentario ?? "");
    setAutor(anotacao?.autor ?? "");
    setComentando(true);
  };

  const fechar = () => {
    setEditando(false);
    setComentando(false);
  };

  const salvarTexto = async () => {
    const ok = await onSalvar(insight.chave, {
      // só envia o que difere do texto gerado
      tituloEditado: rascunho.titulo === insight.titulo ? undefined : rascunho.titulo,
      descricaoEditada:
        rascunho.descricao === insight.descricao ? undefined : rascunho.descricao,
      acaoEditada: rascunho.acao === insight.acao ? undefined : rascunho.acao,
      autor: autor || undefined,
    });
    if (ok) fechar();
  };

  const salvarComentario = async () => {
    const ok = await onSalvar(insight.chave, {
      comentario: comentario || undefined,
      autor: autor || undefined,
    });
    if (ok) fechar();
  };

  const trocarStatus = (novo: StatusAnotacao) =>
    onSalvar(insight.chave, { status: novo, autor: autor || undefined });

  return (
    <article
      className={`flex flex-col rounded-[10px] border bg-panel p-5 transition-opacity ${
        descartado ? "opacity-55" : ""
      }`}
      style={{ borderColor: estilo.borda }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] tracking-[.06em] uppercase"
          style={{ background: estilo.fundo, color: estilo.cor }}
        >
          {estilo.rotulo}
        </span>
        <span className="text-[11px] tracking-[.08em] text-text-muted uppercase">
          {insight.regra}
        </span>
        {insight.empresa && (
          <span className="text-[11px] text-text-faint">· {insight.empresa}</span>
        )}
        {insight.mes && (
          <span className="text-[11px] text-text-faint">· {nomeMes(insight.mes)}</span>
        )}
        {status !== "em_aberto" && (
          <span
            className="ml-auto rounded border px-1.5 py-0.5 text-[10px] tracking-[.06em] uppercase"
            style={{ color: STATUS_COR[status], borderColor: "var(--border-strong)" }}
          >
            {STATUS_ROTULO[status]}
          </span>
        )}
      </div>

      {editando ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-[10px] tracking-[.06em] text-text-faint uppercase">
            Título
            <input
              value={rascunho.titulo}
              onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })}
              className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[14px] font-medium text-text normal-case"
            />
          </label>
          <label className="text-[10px] tracking-[.06em] text-text-faint uppercase">
            Descrição
            <textarea
              value={rascunho.descricao}
              onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
              rows={5}
              className="mt-1 w-full resize-y rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[13px] leading-relaxed text-text-muted normal-case"
            />
          </label>
          <label className="text-[10px] tracking-[.06em] text-text-faint uppercase">
            Ação sugerida
            <textarea
              value={rascunho.acao}
              onChange={(e) => setRascunho({ ...rascunho, acao: e.target.value })}
              rows={2}
              className="mt-1 w-full resize-y rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[12px] text-text-faint normal-case"
            />
          </label>
        </div>
      ) : (
        <>
          <h3 className="mt-3 text-[14px] font-medium text-text">{titulo}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{descricao}</p>
        </>
      )}

      {!editando && (
        <p className="mt-3 border-t border-line pt-2.5 text-[12px] text-text-faint">
          <span className="tracking-[.06em] uppercase">Ação</span> · {acao}
        </p>
      )}

      {anotacao?.comentario && !comentando && (
        <div className="mt-3 rounded-md border-l-2 bg-panel-2 px-3 py-2" style={{ borderColor: "var(--gold)" }}>
          <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-text-muted">
            {anotacao.comentario}
          </p>
          <p className="mt-1.5 text-[10px] text-text-faint">
            {anotacao.autor ? `${anotacao.autor} · ` : ""}
            {new Date(anotacao.atualizadoEm).toLocaleString("pt-BR")}
          </p>
        </div>
      )}

      {comentando && (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder="Ex.: contador confirmou que foi inventário de fevereiro."
            aria-label="Comentário"
            className="w-full resize-y rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[12px] text-text placeholder:text-text-faint"
          />
        </div>
      )}

      {(editando || comentando) && (
        <input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="Seu nome (atribuição, não é login)"
          aria-label="Autor"
          className="mt-2 w-full rounded-md border border-line bg-panel-2 px-2 py-1.5 text-[11px] text-text placeholder:text-text-faint"
        />
      )}

      {editavel && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
          {editando || comentando ? (
            <>
              <Botao
                onClick={editando ? salvarTexto : salvarComentario}
                disabled={salvando}
                destaque
              >
                {salvando ? "Salvando…" : "Salvar"}
              </Botao>
              <Botao onClick={fechar} disabled={salvando}>
                Cancelar
              </Botao>
              {editando && temTextoEditado && (
                <Botao
                  onClick={() =>
                    onLimpar(insight.chave, [
                      "titulo_editado",
                      "descricao_editada",
                      "acao_editada",
                    ])
                  }
                  disabled={salvando}
                >
                  Restaurar texto original
                </Botao>
              )}
            </>
          ) : (
            <>
              {(["verificado", "descartado", "em_aberto"] as StatusAnotacao[])
                .filter((s) => s !== status)
                .map((s) => (
                  <Botao
                    key={s}
                    onClick={() => trocarStatus(s)}
                    disabled={salvando}
                    destaque={s === "verificado"}
                  >
                    {s === "em_aberto" ? "Reabrir" : STATUS_ROTULO[s]}
                  </Botao>
                ))}
              <Botao onClick={abrirComentario} disabled={salvando}>
                {anotacao?.comentario ? "Editar comentário" : "Comentar"}
              </Botao>
              <Botao onClick={abrirEdicao} disabled={salvando}>
                Editar texto
              </Botao>
            </>
          )}
        </div>
      )}

      {temTextoEditado && !editando && (
        <div className="mt-2">
          <Nota>
            Texto editado manualmente — os números continuam vindo do cálculo
            automático.
          </Nota>
        </div>
      )}
    </article>
  );
}

function Botao({
  children,
  onClick,
  disabled,
  destaque,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destaque?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-2.5 py-1 text-[12px] transition-colors disabled:opacity-40 ${
        destaque
          ? "bg-gold-tint text-gold hover:brightness-125"
          : "text-text-muted hover:bg-panel-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
