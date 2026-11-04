import { useState, type ReactNode } from "react";

import { api } from "../api";
import { AjudaPopover } from "../ui/components/AjudaPopover";
import { Alerta, lerErro } from "../ui/components/Alerta";
import { Botao } from "../ui/components/Botao";
import { AJUDA } from "../ui/textosAjuda";

/**
 * Admin: pede ao n8n (via BFF, nunca direto) que crie no Drive as pastas das empresas que ainda não têm.
 * Devolve a ação (botão + ajuda, para a barra de ações da página) e o retorno (alerta, para logo abaixo do cabeçalho).
 */
export function useCriarPastas(): { acao: ReactNode; retorno: ReactNode } {
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  async function criar() {
    setEnviando(true);
    setErro(null);
    setMensagem(null);
    try {
      const resposta = await api.post<{ situacao: string; mensagem: string }>("/api/drive/preparar-pastas");
      setMensagem(resposta.mensagem);
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  const acao = (
    <span className="criar-pastas">
      <Botao carregando={enviando} onClick={() => void criar()}>
        Criar pastas no Drive
      </Botao>
      <AjudaPopover rotulo="Criar pastas no Drive" texto={AJUDA.criarPastas} alinhar="fim" />
    </span>
  );

  let retorno: ReactNode = null;
  if (mensagem) {
    retorno = <Alerta tipo="sucesso" titulo={mensagem} />;
  } else if (erro) {
    const { mensagem: texto, codigo } = lerErro(erro);
    retorno = (
      <Alerta tipo="erro" titulo="Não foi possível pedir as pastas no Drive" meta={codigo ?? "ERRO"}>
        {texto}
      </Alerta>
    );
  }
  return { acao, retorno };
}
