import { useCallback, useEffect, useState, type ReactNode } from "react";

import { api, requisitar } from "../api";
import { Link } from "../roteamento";
import { formatarValor } from "../formato";
import { Alerta, lerErro } from "../ui/components/Alerta";
import { Botao } from "../ui/components/Botao";

export function Pagina({ children }: { children: ReactNode }) {
  return <div className="pagina">{children}</div>;
}

/** Trilha de navegação: o último item é a página atual. */
export function Trilha({ itens }: { itens: { rotulo: string; para?: string }[] }) {
  return (
    <nav className="trilha" aria-label="Trilha">
      <ol>
        {itens.map((item, i) => (
          <li key={i}>
            {item.para ? <Link to={item.para}>{item.rotulo}</Link> : <span aria-current="page">{item.rotulo}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Erro do BFF/motor (ou de rede) como Alerta: mensagem, código e "Detalhes (N)". */
export function MensagemErro({ erro }: { erro: unknown }) {
  if (!erro) return null;
  const { mensagem, codigo, detalhes } = lerErro(erro);
  return <Alerta tipo="erro" titulo={mensagem} meta={codigo} detalhes={detalhes} />;
}

/** Valor de célula de tabela, sem símbolo (o cabeçalho diz "(R$)"); ausente = "—" em texto secundário. */
export function Valor({ valor }: { valor: number | null | undefined }) {
  return typeof valor === "number" ? <>{formatarValor(valor)}</> : <span className="tabela__ausente">—</span>;
}

export function Paginacao({
  offset,
  limite,
  quantidade,
  mudar,
  total,
}: {
  offset: number;
  limite: number;
  quantidade: number;
  mudar: (offset: number) => void;
  /** Total do filtro (cabeçalho X-Total-Count do motor). Com ele: "1–100 de 533", "Página 1 de 6" e "Próxima" certa na última página. */
  total?: number | null;
}) {
  const temTotal = typeof total === "number";
  if (offset === 0 && (temTotal ? total <= limite : quantidade < limite)) return null;
  const ultima = temTotal ? offset + limite >= total : quantidade < limite;
  const paginas = temTotal ? Math.max(1, Math.ceil(total / limite)) : null;
  const faixa = quantidade === 0 ? "Nenhum item" : temTotal ? `${offset + 1}–${offset + quantidade} de ${total}` : `${offset + 1}–${offset + quantidade}`;
  return (
    <nav className="paginacao" aria-label="Paginação">
      <Botao tamanho="compacto" desabilitado={offset === 0} onClick={() => mudar(Math.max(0, offset - limite))}>
        Anterior
      </Botao>
      <span className="paginacao__faixa">
        {faixa}
        {paginas !== null && ` · página ${Math.floor(offset / limite) + 1} de ${paginas}`}
      </span>
      <Botao tamanho="compacto" desabilitado={ultima} onClick={() => mudar(offset + limite)}>
        Próxima
      </Botao>
    </nav>
  );
}

/** Carrega dados de uma URL do BFF; `url` nula não carrega. */
export function useCarregar<T>(url: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!url) {
      setDados(null);
      return;
    }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api
      .get<T>(url)
      .then((d) => ativo && setDados(d))
      .catch((e: unknown) => ativo && setErro(e))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [url, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, erro, carregando, recarregar };
}

/** Como `useCarregar`, mas também lê o total do filtro no cabeçalho `X-Total-Count` (para paginar com "de N"). */
export function useCarregarComTotal<T>(url: string | null) {
  const [dados, setDados] = useState<T | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [carregando, setCarregando] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!url) {
      setDados(null);
      setTotal(null);
      return;
    }
    let ativo = true;
    setCarregando(true);
    setErro(null);
    requisitar("GET", url)
      .then(async (resposta) => {
        const n = Number(resposta.headers.get("X-Total-Count"));
        const corpo = (await resposta.json()) as T;
        if (!ativo) return;
        setDados(corpo);
        setTotal(Number.isFinite(n) && resposta.headers.has("X-Total-Count") ? n : null);
      })
      .catch((e: unknown) => ativo && setErro(e))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [url, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, total, erro, carregando, recarregar };
}
