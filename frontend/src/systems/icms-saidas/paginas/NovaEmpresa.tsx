import { useState, type FormEvent } from "react";

import { api } from "../api";
import { useNavigate } from "../roteamento";
import { MensagemErro, Pagina, Trilha } from "../componentes/comuns";
import { lerCnpj, mascararCnpj, normalizarRazaoSocial, PADRAO_CNPJ } from "../formato";
import { Botao } from "../ui/components/Botao";
import { Campo, Formulario } from "../ui/components/Campo";
import type { Empresa } from "../tipos";

export function NovaEmpresa() {
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const navegar = useNavigate();

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    const valorCnpj = lerCnpj(cnpj);
    if (valorCnpj === undefined) {
      setErro(new Error("CNPJ inválido: use 14 dígitos ou o formato 00.000.000/0000-00."));
      return;
    }
    setEnviando(true);
    try {
      const empresa = await api.post<Empresa>("/api/empresas", { razao_social: normalizarRazaoSocial(razao), cnpj: valorCnpj });
      navegar(`/empresas/${encodeURIComponent(empresa.codigo)}`, {
        state: { aviso: `Empresa cadastrada com o código ${empresa.codigo}` },
      });
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Pagina>
      <Trilha itens={[{ rotulo: "Painel do mês", para: "/" }, { rotulo: "Nova empresa" }]} />
      <div className="pagina__cabecalho">
        <h1>Nova empresa</h1>
      </div>
      <Formulario estreito onSubmit={enviar}>
        <p className="formulario__texto">
          O código da empresa é gerado automaticamente. A empresa é criada já com a configuração fiscal padrão de PE.
        </p>
        <MensagemErro erro={erro} />
        <Campo rotulo="Razão social">
          <input className="campo__controle campo__controle--maiusculas" required minLength={2} maxLength={200} value={razao} onChange={(e) => setRazao(e.target.value)} />
        </Campo>
        <Campo rotulo="CNPJ" opcional>
          <input
            className="campo__controle"
            maxLength={18}
            inputMode="numeric"
            pattern={PADRAO_CNPJ}
            title="14 dígitos ou 00.000.000/0000-00"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
          />
        </Campo>
        <Botao type="submit" variante="primario" carregando={enviando}>
          {enviando ? "Criando…" : "Criar empresa"}
        </Botao>
      </Formulario>
    </Pagina>
  );
}
