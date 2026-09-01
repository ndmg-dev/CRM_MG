"use client";

import { useEffect, useRef, useState } from "react";
import { useIndice } from "./DatasetProvider";
import { dreFetch } from "../lib/api";
import { IconeConversa, IconeEnviar, IconeFechar } from "./icons";
import { rotuloEscopo, useFiltros } from "../lib/store";
import { EXPLICACOES } from "../lib/telas";
import type { Mensagem, RespostaAssistente } from "../lib/assistente/tipos";

/** Perguntas de partida — tirar a página em branco é metade da usabilidade. */
const SUGESTOES = [
  "O que exatamente é o “Grupo total”?",
  "Qual unidade está indo pior, e no que ela perde?",
  "Por que o atacado fica fora do ranking?",
  "O que aconteceu em fevereiro?",
];

interface Fala extends Mensagem {
  consultou?: string[];
  erro?: boolean;
}

export function Assistente() {
  const indice = useIndice();
  const { tela, escopo, meses } = useFiltros();

  const [disponivel, setDisponivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [pensando, setPensando] = useState(false);
  const fimDaLista = useRef<HTMLDivElement>(null);

  // Se o assistente não estiver configurado no servidor, o botão nem aparece —
  // mesma regra da curadoria: recurso indisponível não vira botão quebrado.
  useEffect(() => {
    let ativo = true;
    dreFetch("/api/assistente")
      .then((r) => r.json() as Promise<RespostaAssistente>)
      .then((r) => ativo && setDisponivel(Boolean(r.disponivel)))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: "end" });
  }, [falas, pensando]);

  async function perguntar(pergunta: string) {
    const texto = pergunta.trim();
    if (!texto || pensando) return;

    const historico: Fala[] = [...falas, { papel: "user", texto }];
    setFalas(historico);
    setRascunho("");
    setPensando(true);

    try {
      const resposta = await dreFetch("/api/assistente", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Só o histórico limpo vai para o servidor — `erro` e `consultou` são
          // enfeite de tela, não conversa.
          mensagens: historico
            .filter((f) => !f.erro)
            .map((f) => ({ papel: f.papel, texto: f.texto })),
          contexto: {
            tela,
            escopo: rotuloEscopo(escopo, indice),
            meses,
          },
        }),
      });
      const corpo = (await resposta.json()) as RespostaAssistente;
      setFalas((atual) => [
        ...atual,
        corpo.texto
          ? {
              papel: "assistant",
              texto: corpo.texto,
              consultou: corpo.consultou,
            }
          : {
              papel: "assistant",
              texto: corpo.erro ?? "Não consegui responder agora.",
              erro: true,
            },
      ]);
    } catch {
      setFalas((atual) => [
        ...atual,
        {
          papel: "assistant",
          texto: "Falha de conexão com o assistente. Tente de novo.",
          erro: true,
        },
      ]);
    } finally {
      setPensando(false);
    }
  }

  if (!disponivel) return null;

  // Botão flutuante: círculo com o ícone, que revela o rótulo ao passar o mouse.
  // Ícone sozinho é ambíguo (todo mundo já viu um balão que era chat de vendas);
  // o rótulo aparecendo no hover resolve sem ocupar a tela o tempo todo. Quem
  // navega por teclado ou leitor de tela recebe o mesmo texto pelo aria-label.
  if (!aberto)
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir o assistente e perguntar sobre esta tela"
        className="group fixed right-5 bottom-5 z-40 flex items-center rounded-full border border-gold-dim bg-panel p-3.5 text-gold shadow-lg transition-colors hover:bg-gold-tint"
      >
        <span className="max-w-0 overflow-hidden text-[13px] whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-[190px] group-hover:pr-2.5 group-hover:opacity-100">
          Perguntar sobre esta tela
        </span>
        <IconeConversa tamanho={20} />
      </button>
    );

  return (
    <aside
      aria-label="Assistente do dashboard"
      className="fixed inset-x-0 bottom-0 z-40 flex max-h-[80vh] flex-col rounded-t-[10px] border border-line bg-panel shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-h-[min(600px,80vh)] sm:w-[420px] sm:rounded-[10px]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-gold">
            <IconeConversa tamanho={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text">Assistente</p>
            <p className="truncate text-[11px] text-text-faint">
              responde sobre {EXPLICACOES[tela].pergunta.toLowerCase()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Fechar assistente"
          className="shrink-0 rounded-md p-1.5 text-text-faint transition-colors hover:bg-panel-2 hover:text-text"
        >
          <IconeFechar tamanho={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {falas.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] leading-relaxed text-text-faint">
              Pergunte sobre o que está na tela ou sobre os números. As respostas
              usam os mesmos cálculos do dashboard — o assistente lê os valores,
              não os recalcula.
            </p>
            {SUGESTOES.map((sugestao) => (
              <button
                key={sugestao}
                type="button"
                onClick={() => perguntar(sugestao)}
                className="rounded-md border border-line px-3 py-2 text-left text-[12px] text-text-muted transition-colors hover:border-gold-dim hover:text-text"
              >
                {sugestao}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {falas.map((fala, i) => (
            <div
              key={i}
              className={
                fala.papel === "user"
                  ? "self-end rounded-md bg-gold-tint px-3 py-2 text-[13px] text-gold"
                  : "text-[13px] leading-relaxed text-text"
              }
            >
              <p className={fala.erro ? "text-neg" : undefined}>
                {fala.texto.split("\n").map((linha, j) => (
                  <span key={j}>
                    {linha}
                    <br />
                  </span>
                ))}
              </p>
              {fala.consultou && fala.consultou.length > 0 && (
                <p className="mt-1 text-[10px] text-text-faint">
                  consultou: {fala.consultou.join(", ")}
                </p>
              )}
            </div>
          ))}
          {pensando && (
            <p className="text-[12px] text-text-faint">consultando os números…</p>
          )}
          <div ref={fimDaLista} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          perguntar(rascunho);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <input
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          placeholder="Pergunte alguma coisa…"
          aria-label="Sua pergunta"
          maxLength={1000}
          className="min-w-0 flex-1 rounded-md border border-line bg-panel-2 px-3 py-2 text-[13px] text-text placeholder:text-text-faint"
        />
        <button
          type="submit"
          disabled={pensando || !rascunho.trim()}
          aria-label="Enviar pergunta"
          className="shrink-0 rounded-md bg-gold-tint px-3 text-gold transition-opacity disabled:opacity-40"
        >
          <IconeEnviar tamanho={16} />
        </button>
      </form>
    </aside>
  );
}
