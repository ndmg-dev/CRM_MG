"use client";

import { useCallback, useEffect, useState } from "react";
import { dreFetch } from "../api";
import type {
  Anotacao,
  AnotacaoEntrada,
  CampoLimpavel,
  RespostaAnotacoes,
} from "./tipos";

interface Estado {
  porChave: Map<string, Anotacao>;
  /** false = banco não configurado; a UI vira somente-leitura */
  persistencia: boolean;
  carregando: boolean;
  aviso: string | null;
  erro: string | null;
}

const INICIAL: Estado = {
  porChave: new Map(),
  persistencia: false,
  carregando: true,
  aviso: null,
  erro: null,
};

/**
 * Carrega as anotações e expõe o gravador.
 *
 * 🔴 Nunca derruba a tela: se a API falhar ou não houver banco, o dashboard
 * segue funcionando somente-leitura, com aviso.
 */
export function useAnotacoes() {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = useCallback(() => {
    let ativo = true;
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }));
    dreFetch("/api/anotacoes")
      .then(async (r) => {
        if (!r.ok) {
          // a API explica a causa no corpo; sem isto, sobra só "HTTP 503"
          const detalhe = await r
            .json()
            .then((c: { erro?: string }) => c.erro)
            .catch(() => null);
          throw new Error(detalhe ?? `HTTP ${r.status}`);
        }
        return (await r.json()) as RespostaAnotacoes;
      })
      .then((d) => {
        if (!ativo) return;
        setEstado({
          porChave: new Map(d.anotacoes.map((a) => [a.chave, a])),
          persistencia: d.persistencia,
          carregando: false,
          aviso: d.aviso ?? null,
          erro: null,
        });
      })
      .catch((e: Error) => {
        if (!ativo) return;
        setEstado({
          ...INICIAL,
          carregando: false,
          erro: e.message,
        });
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => carregar(), [carregar]);

  const aplicar = useCallback((anotacao: Anotacao | null, chave: string) => {
    setEstado((atual) => {
      const porChave = new Map(atual.porChave);
      if (anotacao) porChave.set(anotacao.chave, anotacao);
      else porChave.delete(chave);
      return { ...atual, porChave, erro: null };
    });
  }, []);

  const enviar = useCallback(
    async (chave: string, corpo: Record<string, unknown>) => {
      setSalvando(chave);
      try {
        const r = await dreFetch("/api/anotacoes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chave, ...corpo }),
        });
        const dados = (await r.json()) as {
          anotacao?: Anotacao | null;
          erro?: string;
        };
        if (!r.ok) throw new Error(dados.erro ?? `HTTP ${r.status}`);
        aplicar(dados.anotacao ?? null, chave);
        return true;
      } catch (e) {
        setEstado((atual) => ({
          ...atual,
          erro: `Não foi possível salvar: ${(e as Error).message}`,
        }));
        return false;
      } finally {
        setSalvando(null);
      }
    },
    [aplicar],
  );

  const salvar = useCallback(
    (chave: string, entrada: AnotacaoEntrada) => enviar(chave, entrada),
    [enviar],
  );

  const limpar = useCallback(
    (chave: string, campos: CampoLimpavel[]) => enviar(chave, { limpar: campos }),
    [enviar],
  );

  return {
    anotacaoDe: (chave: string) => estado.porChave.get(chave) ?? null,
    persistencia: estado.persistencia,
    carregando: estado.carregando,
    aviso: estado.aviso,
    erro: estado.erro,
    salvando,
    salvar,
    limpar,
    recarregar: carregar,
  };
}
