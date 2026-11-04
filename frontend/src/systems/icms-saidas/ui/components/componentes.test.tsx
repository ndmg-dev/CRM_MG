// @vitest-environment jsdom
// Testes dos componentes menores: Tabela/EstadoTabela, Alerta, Selo/Chips, CartaoTotal, BarraSituacao, Dialogo, EnvioArquivo.
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ErroApi } from "../../api";
import { agir, desmontarTudo, escolherArquivo, montar } from "../../testes/dom";
import { Alerta, lerErro } from "./Alerta";
import { BarraSituacao } from "./BarraSituacao";
import { CartaoTotal } from "./CartaoTotal";
import { Dialogo } from "./Dialogo";
import { EnvioArquivo } from "./EnvioArquivo";
import { ChipDiferenca, ChipOrigem, grupoDaDiferenca, SeloSituacao } from "./Selo";
import { Tabela, type Coluna } from "./Tabela";

afterEach(desmontarTudo);

// jsdom não implementa showModal/close: o mínimo para o <dialog> nativo.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & { showModal?: () => void };
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

type Linha = { codigo: string; od: number };
const colunas: Coluna<Linha>[] = [
  { chave: "codigo", titulo: "Código", celula: (l) => l.codigo },
  { chave: "od", titulo: "OD (R$)", alinhar: "fim", celula: (l) => l.od },
];

describe("<Tabela>", () => {
  it("é uma tabela real num contêiner rolável focável com nome", async () => {
    const raiz = await montar(<Tabela rotulo="Empresas" colunas={colunas} linhas={[{ codigo: "0001", od: 10 }]} />);
    const regiao = raiz.querySelector('[role="region"]')!;
    expect(regiao.getAttribute("aria-label")).toBe("Empresas");
    expect(regiao.getAttribute("tabindex")).toBe("0");
    expect([...raiz.querySelectorAll("th")].map((th) => th.getAttribute("scope"))).toEqual(["col", "col"]);
    expect(raiz.querySelector("td[data-alinhar='fim']")?.textContent).toBe("10");
  });

  it("carregando: aria-busy, texto em role=status e 6 linhas de esqueleto", async () => {
    const raiz = await montar(
      <Tabela rotulo="Empresas" colunas={colunas} estado={{ tipo: "carregando", titulo: "Carregando apurações de 09/2026…" }} />,
    );
    expect(raiz.querySelector('[role="region"]')!.getAttribute("aria-busy")).toBe("true");
    expect(raiz.querySelector('[role="status"]')?.textContent).toBe("Carregando apurações de 09/2026…");
    expect(raiz.querySelectorAll(".tabela__esqueleto")).toHaveLength(6);
  });

  it("erro: role=alert com a ação de tentar de novo; vazio e filtro sem resultado sem papel de alerta", async () => {
    const tentar = vi.fn();
    const raiz = await montar(
      <Tabela
        rotulo="Empresas"
        colunas={colunas}
        estado={{ tipo: "erro", titulo: "Não foi possível carregar", acao: <button onClick={tentar}>Tentar de novo</button> }}
      />,
    );
    const alerta = raiz.querySelector('[role="alert"]')!;
    await agir(() => alerta.querySelector("button")!.click());
    expect(tentar).toHaveBeenCalled();

    const filtro = await montar(
      <Tabela rotulo="E" colunas={colunas} estado={{ tipo: "filtro-sem-resultado", titulo: "Nenhuma empresa corresponde a ‘x’" }} />,
    );
    expect(filtro.querySelector('[role="alert"], [role="status"]')).toBeNull();
    expect(filtro.querySelector(".estado-tabela")?.getAttribute("data-tipo")).toBe("filtro-sem-resultado");
  });
});

describe("<Alerta>", () => {
  it("erro com role=alert e detalhes numa caixa 'Detalhes (N)'", async () => {
    const raiz = await montar(
      <Alerta tipo="erro" titulo="A apuração não foi processada" detalhes={["linha 3: CFOP vazio", "linha 9: NCM inválido"]}>
        Nenhuma planilha foi gerada.
      </Alerta>,
    );
    expect(raiz.querySelector('[role="alert"]')).not.toBeNull();
    expect(raiz.querySelector("summary")?.textContent).toBe("Detalhes (2)");
  });

  it("aviso é recolhível e começa fechado; sucesso é role=status; bloqueio tem cadeado", async () => {
    const raiz = await montar(
      <>
        <Alerta tipo="aviso" titulo="2 avisos — não impedem a aplicação" detalhes={["a", "b"]} />
        <Alerta tipo="sucesso" titulo="Planilha baixada" />
        <Alerta tipo="bloqueio" titulo="Este lote não pode ser aplicado — 1 bloqueio" detalhes={["Arquivo de outra empresa"]} />
      </>,
    );
    const aviso = raiz.querySelector("details")!;
    expect(aviso.open).toBe(false);
    expect(raiz.querySelector('[role="status"]')?.textContent).toBe("Planilha baixada");
    const bloqueio = raiz.querySelector('[data-tipo="bloqueio"]')!;
    expect(bloqueio.getAttribute("role")).toBe("alert");
    expect(bloqueio.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lê mensagem, código e detalhes do erro da API", () => {
    const erro = new ErroApi(422, { codigo: "ARQUIVO_INVALIDO", mensagem: "Arquivo inválido.", detalhes: ["linha 3"] });
    expect(lerErro(erro)).toEqual({ mensagem: "Arquivo inválido.", codigo: "ARQUIVO_INVALIDO", detalhes: ["linha 3"] });
  });
});

describe("selos e chips", () => {
  it("selo tem texto e ícone decorativo", async () => {
    const raiz = await montar(<SeloSituacao situacao="CONCLUIDA_COM_PENDENCIAS" />);
    expect(raiz.textContent).toBe("Concluída com pendências");
    expect(raiz.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("chip de origem: texto explícito; zero não renderiza; sem número vira o motivo por extenso", async () => {
    const raiz = await montar(
      <>
        <ChipOrigem tipo="produtos" quantidade={3} />
        <ChipOrigem tipo="cfop" quantidade={0} />
        <ChipOrigem tipo="cfop" quantidade={null} />
      </>,
    );
    expect([...raiz.querySelectorAll(".chip")].map((c) => c.textContent)).toEqual(["Produtos: 3", "CFOP não parametrizado"]);
  });

  it("chip de diferença: símbolo decorativo + palavra; tipos do motor com acento", async () => {
    expect(grupoDaDiferenca("INCLUÍDO")).toBe("novo");
    expect(grupoDaDiferenca("TRIBUTAÇÃO ALTERADA")).toBe("alterado");
    expect(grupoDaDiferenca("DESCRIÇÃO ALTERADA")).toBe("alterado");
    expect(grupoDaDiferenca("REMOVIDO")).toBe("removido");
    const raiz = await montar(<ChipDiferenca tipo="removido" />);
    expect(raiz.textContent).toBe("−Removido");
    expect(raiz.querySelector(".chip__simbolo")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("<CartaoTotal>", () => {
  it("saldo sempre traz 'Não é o ICMS a recolher'", async () => {
    const raiz = await montar(<CartaoTotal rotulo="Saldo (OD − ED)" tipo="saldo" valor={-10} />);
    expect(raiz.textContent).toContain("Não é o ICMS a recolher");
  });

  it("valor ausente vira —", async () => {
    const raiz = await montar(<CartaoTotal rotulo="OD do mês" tipo="od" valor={null} />);
    expect(raiz.querySelector(".cartao-total__valor")?.textContent).toBe("—");
  });
});

describe("<Dialogo>", () => {
  function Teste({ fechar }: { fechar: () => void }) {
    const [aberto, setAberto] = useState(false);
    return (
      <>
        <button onClick={() => setAberto(true)}>abrir</button>
        <Dialogo
          titulo="Confirmar remoção de 80 itens"
          aberto={aberto}
          onFechar={() => {
            fechar();
            setAberto(false);
          }}
          acoes={<button onClick={() => setAberto(false)}>Voltar e revisar</button>}
        >
          <label>
            <input type="checkbox" /> Revisei
          </label>
        </Dialogo>
      </>
    );
  }

  it("abre com showModal, foca o primeiro controle, Esc cancela e o foco volta a quem abriu", async () => {
    const fechar = vi.fn();
    const raiz = await montar(<Teste fechar={fechar} />);
    const abrir = raiz.querySelector("button")!;
    abrir.focus();
    await agir(() => abrir.click());
    const dialogo = raiz.querySelector("dialog")!;
    expect(dialogo.open).toBe(true);
    expect(document.getElementById(dialogo.getAttribute("aria-labelledby")!)?.textContent).toBe("Confirmar remoção de 80 itens");
    expect(document.activeElement).toBe(dialogo.querySelector("input"));

    await agir(() => {
      dialogo.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(fechar).toHaveBeenCalled();
    expect(dialogo.open).toBe(false);
    expect(document.activeElement).toBe(abrir);
  });
});

describe("<EnvioArquivo>", () => {
  function Teste({ travado = false, aceita }: { travado?: boolean; aceita?: string }) {
    const [arquivo, setArquivo] = useState<File | null>(null);
    return <EnvioArquivo aceita={aceita} arquivo={arquivo} onEscolher={setArquivo} travado={travado} rotulo="Relatório de vendas" />;
  }
  const xlsx = () => new File([new Uint8Array(2048)], "SAIDAS_09_2026.xlsx");

  it("input file real ligado ao rótulo; ao escolher mostra nome, tamanho e Trocar", async () => {
    const raiz = await montar(<Teste />);
    const campo = raiz.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(raiz.querySelector(`label[for="${campo.id}"]`)).not.toBeNull();
    await agir(() => escolherArquivo(campo, xlsx()));
    expect(raiz.querySelector(".envio__nome")?.textContent).toBe("SAIDAS_09_2026.xlsx");
    expect(raiz.querySelector(".envio__tamanho")?.textContent).toBe("2 KB");
    expect(raiz.querySelector(".envio__trocar")?.textContent).toBe("Trocar relatório de vendas");
  });

  it("recusa extensão errada com mensagem", async () => {
    const raiz = await montar(<Teste />);
    const campo = raiz.querySelector<HTMLInputElement>('input[type="file"]')!;
    await agir(() => escolherArquivo(campo, new File(["x"], "notas.pdf")));
    expect(raiz.querySelector('[role="alert"]')?.textContent).toBe("Escolha um arquivo .xlsx.");
    expect(raiz.querySelector(".envio__nome")).toBeNull();
  });

  it("travado: campo desabilitado e arquivo solto é ignorado", async () => {
    const raiz = await montar(<Teste travado />);
    expect(raiz.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(true);
    const area = raiz.querySelector(".envio")!;
    const soltar = new Event("drop", { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    soltar.dataTransfer = { files: [xlsx()] };
    await agir(() => {
      area.dispatchEvent(soltar);
    });
    expect(raiz.querySelector(".envio__nome")).toBeNull();
  });
});

describe("<BarraSituacao>", () => {
  it("segmentos proporcionais por atributo (sem style), concluídas à esquerda e 'Sem apuração' como trilho vazio", async () => {
    const raiz = await montar(<BarraSituacao contagens={{ CONCLUIDA: 5, PROCESSANDO: 0, CONCLUIDA_COM_PENDENCIAS: 2, ERRO: 1, SEM_APURACAO: 2 }} />);
    const svg = raiz.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 10 1");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    const segmentos = [...svg.querySelectorAll("rect")].map((r) => [r.dataset.situacao, r.getAttribute("x"), r.getAttribute("width")]);
    expect(segmentos).toEqual([
      ["CONCLUIDA", "0", "5"],
      ["CONCLUIDA_COM_PENDENCIAS", "5", "2"],
      ["ERRO", "7", "1"],
    ]);
    expect(raiz.querySelector("[style]")).toBeNull();
  });
});
