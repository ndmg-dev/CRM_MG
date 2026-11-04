// Abas de edição das regras. Cada alteração grava o rascunho INTEIRO no motor (PUT /regras/rascunho);
// a validação fina (faixas, duplicatas, uso na memória) é do motor e volta como erro ou como bloqueio.
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";

import { MensagemErro } from "../../componentes/comuns";
import type {
  AliasRegra,
  CategoriaRegra,
  CfopRegra,
  ConteudoRegras,
  DiferencasRegras,
  GrupoRegra,
  ModoGrupo,
  TabelaRegras,
  TratamentoCfop,
} from "../../tipos";
import { AjudaPopover } from "../../ui/components/AjudaPopover";
import { Botao } from "../../ui/components/Botao";
import { Campo, Formulario } from "../../ui/components/Campo";
import { Dialogo } from "../../ui/components/Dialogo";
import { ChipDiferenca } from "../../ui/components/Selo";
import { Tabela, type Coluna } from "../../ui/components/Tabela";
import { AJUDA } from "../../ui/textosAjuda";
import { formatarCampo, NOME_MODO } from "./diferencas";
import {
  fracaoParaPercentual,
  lerListaCst,
  lerListaNumeros,
  numeroParaTexto,
  percentualParaFracao,
  textoParaNumero,
} from "./numeros";

export type PropsAba = {
  conteudo: ConteudoRegras;
  diferencas: DiferencasRegras;
  /** Admin: mostra adicionar / editar / remover. */
  editavel: boolean;
  /** Mostra a coluna "No rascunho" (Novo / Alterado). */
  comRascunho: boolean;
  salvar: (conteudo: ConteudoRegras) => Promise<void>;
};

const MODOS: ModoGrupo[] = ["PERCENTUAL", "ST", "SO_ENTRADA"];
const TRATAMENTOS: TratamentoCfop[] = ["VENDA", "DEVOLUÇÃO", "CONFORME DESTAQUE"];

function Titulo({ texto, ajuda, alinhar }: { texto: string; ajuda: string; alinhar?: "inicio" | "fim" }) {
  return (
    <span className="rotulo-com-ajuda">
      {texto}
      <AjudaPopover rotulo={texto} texto={ajuda} alinhar={alinhar} />
    </span>
  );
}

/** Novo / Alterado da linha no rascunho (removidos só aparecem no resumo da publicação). */
function marcaRascunho(diferencas: DiferencasRegras, tabela: TabelaRegras, chave: string): ReactNode {
  const d = diferencas[tabela];
  if (!d) return null;
  const campo = tabela === "aliases" ? "texto" : tabela === "cfops" ? "cfop" : "nome";
  if (d.novos.some((n) => String(n[campo]) === chave)) return <ChipDiferenca tipo="novo" />;
  if (d.alterados.some((a) => a.chave === chave)) return <ChipDiferenca tipo="alterado" />;
  return null;
}

/** Colunas comuns ao fim de cada tabela: marca do rascunho e ações do admin. */
function colunasFinais<T>(
  props: PropsAba,
  tabela: TabelaRegras,
  chave: (l: T) => string,
  editar: (l: T) => void,
  remover: (l: T) => void,
): Coluna<T>[] {
  const colunas: Coluna<T>[] = [];
  if (props.comRascunho) {
    colunas.push({ chave: "rascunho", titulo: "No rascunho", celula: (l) => marcaRascunho(props.diferencas, tabela, chave(l)) });
  }
  if (props.editavel) {
    colunas.push({
      chave: "acoes",
      titulo: <span className="visualmente-oculto">Ações</span>,
      alinhar: "fim",
      celula: (l) => (
        <span className="regras__acoes-linha">
          <Botao tamanho="compacto" variante="fantasma" onClick={() => editar(l)} aria-label={`Editar ${chave(l)}`}>
            Editar
          </Botao>
          <Botao tamanho="compacto" variante="fantasma" onClick={() => remover(l)} aria-label={`Remover ${chave(l)}`}>
            Remover
          </Botao>
        </span>
      ),
    });
  }
  return colunas;
}

/** Edição/remoção de uma tabela: `edicao` = null (fechado), "novo" ou a linha sendo editada. */
function useEdicao<T>(props: PropsAba, tabela: TabelaRegras) {
  const [edicao, setEdicao] = useState<T | "novo" | null>(null);
  const [erro, setErro] = useState<unknown>(null);

  async function gravar(linhas: T[]) {
    await props.salvar({ ...props.conteudo, [tabela]: linhas });
  }
  async function remover(linha: T) {
    setErro(null);
    try {
      await gravar((props.conteudo[tabela] as T[]).filter((l) => l !== linha));
    } catch (e) {
      setErro(e);
    }
  }
  /** Substitui a linha em edição (mesma posição) ou acrescenta no fim. */
  async function confirmar(nova: T) {
    const linhas = props.conteudo[tabela] as T[];
    await gravar(edicao && edicao !== "novo" ? linhas.map((l) => (l === edicao ? nova : l)) : [...linhas, nova]);
    setEdicao(null);
  }
  return { edicao, setEdicao, erro, remover, confirmar };
}

/** Diálogo com formulário: valida no cliente (texto do erro) e grava; erro do motor aparece dentro do diálogo. */
function DialogoLinha({
  titulo,
  aberto,
  fechar,
  enviar,
  children,
}: {
  titulo: string;
  aberto: boolean;
  fechar: () => void;
  /** Devolve a mensagem de validação local, ou grava (pode lançar erro do motor). */
  enviar: () => Promise<string | null>;
  children: ReactNode;
}) {
  const id = useId();
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setErro(null);
  }, [aberto]);

  async function submeter(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const invalido = await enviar();
      if (invalido) setErro(new Error(invalido));
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialogo
      titulo={titulo}
      aberto={aberto}
      onFechar={fechar}
      acoes={
        <>
          <Botao variante="fantasma" onClick={fechar} desabilitado={enviando}>
            Cancelar
          </Botao>
          <Botao type="submit" form={id} variante="primario" carregando={enviando}>
            {enviando ? "Salvando…" : "Salvar no rascunho"}
          </Botao>
        </>
      }
    >
      <MensagemErro erro={erro} />
      <Formulario id={id} onSubmit={submeter} aria-label={titulo}>
        {children}
      </Formulario>
    </Dialogo>
  );
}

function BarraTabela({ titulo, editavel, adicionar, rotulo }: { titulo: string; editavel: boolean; adicionar: () => void; rotulo: string }) {
  return (
    <div className="regras__barra-tabela">
      <h2>{titulo}</h2>
      {editavel && (
        <Botao tamanho="compacto" onClick={adicionar}>
          {rotulo}
        </Botao>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Categorias e apelidos

export function AbaCategorias(props: PropsAba) {
  const { conteudo, editavel } = props;
  const cat = useEdicao<CategoriaRegra>(props, "categorias");
  const ali = useEdicao<AliasRegra>(props, "aliases");
  const modoDoGrupo = (nome: string) => conteudo.grupos.find((g) => g.nome === nome)?.modo;

  const colunasCat: Coluna<CategoriaRegra>[] = [
    { chave: "nome", titulo: <Titulo texto="Categoria" ajuda={AJUDA.categoria} />, celula: (c) => c.nome },
    { chave: "grupo", titulo: "Grupo de cálculo", celula: (c) => c.grupo },
    { chave: "modo", titulo: <Titulo texto="Modo" ajuda={AJUDA.modoGrupo} />, celula: (c) => NOME_MODO[modoDoGrupo(c.grupo) ?? ""] ?? "—" },
    ...colunasFinais<CategoriaRegra>(props, "categorias", (c) => c.nome, cat.setEdicao, (c) => void cat.remover(c)),
  ];
  const colunasAli: Coluna<AliasRegra>[] = [
    { chave: "texto", titulo: <Titulo texto="Texto na planilha" ajuda={AJUDA.alias} />, celula: (a) => a.texto },
    { chave: "categoria", titulo: "Categoria", celula: (a) => a.categoria },
    ...colunasFinais<AliasRegra>(props, "aliases", (a) => a.texto, ali.setEdicao, (a) => void ali.remover(a)),
  ];

  return (
    <div className="regras__aba">
      <BarraTabela titulo="Categorias de tributação" editavel={editavel} adicionar={() => cat.setEdicao("novo")} rotulo="Adicionar categoria" />
      <MensagemErro erro={cat.erro} />
      <Tabela
        rotulo="Categorias de tributação"
        colunas={colunasCat}
        linhas={conteudo.categorias}
        chaveLinha={(c) => c.nome}
        estado={conteudo.categorias.length ? null : { tipo: "vazio", titulo: "Nenhuma categoria cadastrada." }}
      />
      <BarraTabela titulo="Apelidos (grafias alternativas)" editavel={editavel} adicionar={() => ali.setEdicao("novo")} rotulo="Adicionar apelido" />
      <MensagemErro erro={ali.erro} />
      <Tabela
        rotulo="Apelidos"
        colunas={colunasAli}
        linhas={conteudo.aliases}
        chaveLinha={(a) => a.texto}
        estado={conteudo.aliases.length ? null : { tipo: "vazio", titulo: "Nenhum apelido cadastrado." }}
      />
      {editavel && (
        <>
          <FormCategoria conteudo={conteudo} edicao={cat.edicao} fechar={() => cat.setEdicao(null)} confirmar={cat.confirmar} />
          <FormApelido conteudo={conteudo} edicao={ali.edicao} fechar={() => ali.setEdicao(null)} confirmar={ali.confirmar} />
        </>
      )}
    </div>
  );
}

function FormCategoria({
  conteudo,
  edicao,
  fechar,
  confirmar,
}: {
  conteudo: ConteudoRegras;
  edicao: CategoriaRegra | "novo" | null;
  fechar: () => void;
  confirmar: (c: CategoriaRegra) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState("");
  useEffect(() => {
    const atual = edicao && edicao !== "novo" ? edicao : null;
    setNome(atual?.nome ?? "");
    setGrupo(atual?.grupo ?? conteudo.grupos[0]?.nome ?? "");
  }, [edicao, conteudo.grupos]);

  return (
    <DialogoLinha
      titulo={edicao === "novo" ? "Nova categoria" : "Editar categoria"}
      aberto={edicao !== null}
      fechar={fechar}
      enviar={async () => {
        if (!nome.trim() || !grupo) return "Informe o nome e o grupo de cálculo.";
        await confirmar({ nome: nome.trim(), grupo });
        return null;
      }}
    >
      <Campo rotulo="Categoria" dica="Texto aceito na coluna ICMS da memória. Renomear categoria em uso na memória é bloqueado na publicação.">
        <input className="campo__controle" required maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Campo rotulo="Grupo de cálculo">
        <select className="campo__controle" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          {conteudo.grupos.map((g) => (
            <option key={g.nome} value={g.nome}>
              {g.nome} ({NOME_MODO[g.modo] ?? g.modo})
            </option>
          ))}
        </select>
      </Campo>
    </DialogoLinha>
  );
}

function FormApelido({
  conteudo,
  edicao,
  fechar,
  confirmar,
}: {
  conteudo: ConteudoRegras;
  edicao: AliasRegra | "novo" | null;
  fechar: () => void;
  confirmar: (a: AliasRegra) => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  useEffect(() => {
    const atual = edicao && edicao !== "novo" ? edicao : null;
    setTexto(atual?.texto ?? "");
    setCategoria(atual?.categoria ?? conteudo.categorias[0]?.nome ?? "");
  }, [edicao, conteudo.categorias]);

  return (
    <DialogoLinha
      titulo={edicao === "novo" ? "Novo apelido" : "Editar apelido"}
      aberto={edicao !== null}
      fechar={fechar}
      enviar={async () => {
        if (!texto.trim() || !categoria) return "Informe o texto e a categoria.";
        await confirmar({ texto: texto.trim(), categoria });
        return null;
      }}
    >
      <Campo rotulo="Texto na planilha">
        <input className="campo__controle" required maxLength={60} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Campo>
      <Campo rotulo="Categoria">
        <select className="campo__controle" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {conteudo.categorias.map((c) => (
            <option key={c.nome} value={c.nome}>
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
    </DialogoLinha>
  );
}

// ---------------------------------------------------------------- Grupos e cargas

const percentual = (v: number | null) => (v === null ? <span className="tabela__ausente">—</span> : `${fracaoParaPercentual(v)}%`);

export function AbaGrupos(props: PropsAba) {
  const { conteudo, editavel } = props;
  const ed = useEdicao<GrupoRegra>(props, "grupos");
  const colunas: Coluna<GrupoRegra>[] = [
    { chave: "nome", titulo: "Grupo", celula: (g) => g.nome },
    { chave: "modo", titulo: <Titulo texto="Modo" ajuda={AJUDA.modoGrupo} />, celula: (g) => NOME_MODO[g.modo] ?? g.modo },
    { chave: "rbc_i", titulo: <Titulo texto="RBC interna" ajuda={AJUDA.rbc} alinhar="fim" />, alinhar: "fim", celula: (g) => percentual(g.rbc_interna) },
    { chave: "aliq_i", titulo: <Titulo texto="Alíq. interna" ajuda={AJUDA.aliquota} alinhar="fim" />, alinhar: "fim", celula: (g) => percentual(g.aliq_interna) },
    { chave: "rbc_e", titulo: "RBC interestadual", alinhar: "fim", celula: (g) => percentual(g.rbc_interestadual) },
    { chave: "aliq_e", titulo: "Alíq. interestadual", alinhar: "fim", celula: (g) => percentual(g.aliq_interestadual) },
    { chave: "cst", titulo: <Titulo texto="CST esperados" ajuda={AJUDA.cstEsperados} />, celula: (g) => g.cst_esperados.join(", ") || "—" },
    ...colunasFinais<GrupoRegra>(props, "grupos", (g) => g.nome, ed.setEdicao, (g) => void ed.remover(g)),
  ];
  return (
    <div className="regras__aba">
      <BarraTabela titulo="Grupos de cálculo e cargas" editavel={editavel} adicionar={() => ed.setEdicao("novo")} rotulo="Adicionar grupo" />
      <MensagemErro erro={ed.erro} />
      <Tabela
        rotulo="Grupos de cálculo"
        colunas={colunas}
        linhas={conteudo.grupos}
        chaveLinha={(g) => g.nome}
        larguraMinima={980}
        estado={conteudo.grupos.length ? null : { tipo: "vazio", titulo: "Nenhum grupo cadastrado." }}
      />
      {editavel && <FormGrupo edicao={ed.edicao} fechar={() => ed.setEdicao(null)} confirmar={ed.confirmar} />}
    </div>
  );
}

function FormGrupo({
  edicao,
  fechar,
  confirmar,
}: {
  edicao: GrupoRegra | "novo" | null;
  fechar: () => void;
  confirmar: (g: GrupoRegra) => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [modo, setModo] = useState<ModoGrupo>("PERCENTUAL");
  const [cargas, setCargas] = useState({ rbc_interna: "", aliq_interna: "", rbc_interestadual: "", aliq_interestadual: "" });
  const [cst, setCst] = useState("");
  useEffect(() => {
    const g = edicao && edicao !== "novo" ? edicao : null;
    setNome(g?.nome ?? "");
    setModo(g?.modo ?? "PERCENTUAL");
    setCargas({
      rbc_interna: fracaoParaPercentual(g?.rbc_interna),
      aliq_interna: fracaoParaPercentual(g?.aliq_interna),
      rbc_interestadual: fracaoParaPercentual(g?.rbc_interestadual),
      aliq_interestadual: fracaoParaPercentual(g?.aliq_interestadual),
    });
    setCst(g?.cst_esperados.join(", ") ?? "");
  }, [edicao]);

  const campos: { chave: keyof typeof cargas; rotulo: string }[] = [
    { chave: "rbc_interna", rotulo: "RBC interna (%)" },
    { chave: "aliq_interna", rotulo: "Alíquota interna (%)" },
    { chave: "rbc_interestadual", rotulo: "RBC interestadual (%)" },
    { chave: "aliq_interestadual", rotulo: "Alíquota interestadual (%)" },
  ];

  return (
    <DialogoLinha
      titulo={edicao === "novo" ? "Novo grupo de cálculo" : "Editar grupo de cálculo"}
      aberto={edicao !== null}
      fechar={fechar}
      enviar={async () => {
        if (!nome.trim()) return "Informe o nome do grupo.";
        const csts = lerListaCst(cst);
        if (csts === null) return "CST esperados: use códigos de 2 ou 3 dígitos separados por vírgula.";
        const fracoes = { rbc_interna: null, aliq_interna: null, rbc_interestadual: null, aliq_interestadual: null } as Record<keyof typeof cargas, number | null>;
        if (modo === "PERCENTUAL") {
          for (const c of campos) {
            const valor = percentualParaFracao(cargas[c.chave]);
            if (valor === null) return `${c.rotulo}: informe um número (ex.: 42,93).`;
            fracoes[c.chave] = valor;
          }
        }
        await confirmar({ nome: nome.trim(), modo, ...fracoes, cst_esperados: csts });
        return null;
      }}
    >
      <Campo rotulo="Nome do grupo">
        <input className="campo__controle" required maxLength={30} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>
      <Campo rotulo="Modo" dica={AJUDA.modoGrupo}>
        <select className="campo__controle" value={modo} onChange={(e) => setModo(e.target.value as ModoGrupo)}>
          {MODOS.map((m) => (
            <option key={m} value={m}>
              {NOME_MODO[m]}
            </option>
          ))}
        </select>
      </Campo>
      {modo === "PERCENTUAL" ? (
        <div className="regras__cargas">
          {campos.map((c) => (
            <Campo key={c.chave} rotulo={c.rotulo}>
              <input
                className="campo__controle"
                inputMode="decimal"
                required
                value={cargas[c.chave]}
                onChange={(e) => setCargas({ ...cargas, [c.chave]: e.target.value })}
              />
            </Campo>
          ))}
          <p className="regras__nota">Percentuais como cadastrados, sem arredondar: 42,93 = 42,93%.</p>
        </div>
      ) : (
        <p className="regras__nota">Grupos {NOME_MODO[modo]} não têm RBC nem alíquota (carga zero).</p>
      )}
      <Campo rotulo="CST esperados" opcional dica="Ex.: 60, 10. Vazio = sem ALERTA CST.">
        <input className="campo__controle" value={cst} onChange={(e) => setCst(e.target.value)} />
      </Campo>
    </DialogoLinha>
  );
}

// ---------------------------------------------------------------- CFOPs

export function AbaCfops(props: PropsAba) {
  const { conteudo, editavel } = props;
  const ed = useEdicao<CfopRegra>(props, "cfops");
  const colunas: Coluna<CfopRegra>[] = [
    { chave: "cfop", titulo: "CFOP", celula: (c) => c.cfop },
    { chave: "tratamento", titulo: <Titulo texto="Tratamento" ajuda={AJUDA.tratamentoCfop} />, celula: (c) => c.tratamento },
    { chave: "descricao", titulo: "Descrição", celula: (c) => c.descricao || <span className="tabela__ausente">—</span> },
    ...colunasFinais<CfopRegra>(props, "cfops", (c) => c.cfop, ed.setEdicao, (c) => void ed.remover(c)),
  ];
  const linhas = [...conteudo.cfops].sort((a, b) => a.cfop.localeCompare(b.cfop));
  return (
    <div className="regras__aba">
      <BarraTabela titulo="CFOPs parametrizados" editavel={editavel} adicionar={() => ed.setEdicao("novo")} rotulo="Adicionar CFOP" />
      <p className="regras__nota">CFOP fora da tabela aparece na apuração como CFOP NÃO PARAMETRIZADO.</p>
      <MensagemErro erro={ed.erro} />
      <Tabela
        rotulo="CFOPs"
        colunas={colunas}
        linhas={linhas}
        chaveLinha={(c) => c.cfop}
        estado={linhas.length ? null : { tipo: "vazio", titulo: "Nenhum CFOP parametrizado." }}
      />
      {editavel && <FormCfop edicao={ed.edicao} fechar={() => ed.setEdicao(null)} confirmar={ed.confirmar} />}
    </div>
  );
}

function FormCfop({
  edicao,
  fechar,
  confirmar,
}: {
  edicao: CfopRegra | "novo" | null;
  fechar: () => void;
  confirmar: (c: CfopRegra) => Promise<void>;
}) {
  const [cfop, setCfop] = useState("");
  const [tratamento, setTratamento] = useState<TratamentoCfop>("VENDA");
  const [descricao, setDescricao] = useState("");
  useEffect(() => {
    const c = edicao && edicao !== "novo" ? edicao : null;
    setCfop(c?.cfop ?? "");
    setTratamento(c?.tratamento ?? "VENDA");
    setDescricao(c?.descricao ?? "");
  }, [edicao]);

  return (
    <DialogoLinha
      titulo={edicao === "novo" ? "Novo CFOP" : "Editar CFOP"}
      aberto={edicao !== null}
      fechar={fechar}
      enviar={async () => {
        if (!/^\d{4}$/.test(cfop.trim())) return "CFOP: informe 4 dígitos.";
        await confirmar({ cfop: cfop.trim(), tratamento, descricao: descricao.trim() });
        return null;
      }}
    >
      <Campo rotulo="CFOP" dica="4 dígitos. VENDA precisa começar com 5 ou 6.">
        <input
          className="campo__controle"
          required
          inputMode="numeric"
          maxLength={4}
          pattern="\d{4}"
          value={cfop}
          onChange={(e) => setCfop(e.target.value.replace(/\D/g, ""))}
        />
      </Campo>
      <Campo rotulo="Tratamento" dica={AJUDA.tratamentoCfop}>
        <select className="campo__controle" value={tratamento} onChange={(e) => setTratamento(e.target.value as TratamentoCfop)}>
          {TRATAMENTOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Descrição" opcional>
        <input className="campo__controle" maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </Campo>
    </DialogoLinha>
  );
}

// ---------------------------------------------------------------- Parâmetros

export function AbaParametros(props: PropsAba) {
  const { conteudo, editavel, diferencas } = props;
  const p = conteudo.parametros;
  const [tolerancia, setTolerancia] = useState("");
  const [aliquotas, setAliquotas] = useState("");
  const [baseLegal, setBaseLegal] = useState("");
  const [erro, setErro] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    setTolerancia(numeroParaTexto(p.tolerancia));
    setAliquotas(p.aliquotas_validas.map(numeroParaTexto).join("; "));
    setBaseLegal(p.base_legal_st_interestadual);
  }, [p]);
  const alterados = new Set(diferencas.parametros?.alterados.map((a) => a.chave));
  const marca = (chave: string) => (props.comRascunho && alterados.has(chave) ? <ChipDiferenca tipo="alterado" /> : null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    const tol = textoParaNumero(tolerancia);
    const lista = lerListaNumeros(aliquotas);
    if (tol === null) return setErro(new Error("Tolerância: informe um valor em reais (ex.: 0,05)."));
    if (lista === null) return setErro(new Error("Alíquotas compatíveis: números em % separados por ponto e vírgula (ex.: 0; 4; 7; 12; 20,5)."));
    setEnviando(true);
    try {
      await props.salvar({
        ...conteudo,
        parametros: { ...p, tolerancia: tol, aliquotas_validas: lista, base_legal_st_interestadual: baseLegal.trim() },
      });
    } catch (e) {
      setErro(e);
    } finally {
      setEnviando(false);
    }
  }

  if (!editavel) {
    return (
      <div className="regras__aba">
        <h2>Parâmetros gerais</h2>
        <dl className="regras__parametros">
          <dt>
            <Titulo texto="Tolerância" ajuda={AJUDA.tolerancia} /> {marca("tolerancia")}
          </dt>
          <dd>{formatarCampo("tolerancia", p.tolerancia)}</dd>
          <dt>
            <Titulo texto="Alíquotas compatíveis" ajuda={AJUDA.aliquotasValidas} /> {marca("aliquotas_validas")}
          </dt>
          <dd>{formatarCampo("aliquotas_validas", p.aliquotas_validas)}</dd>
          <dt>
            <Titulo texto="Base legal do estorno de ST interestadual" ajuda={AJUDA.baseLegal} /> {marca("base_legal_st_interestadual")}
          </dt>
          <dd>{p.base_legal_st_interestadual || "—"}</dd>
        </dl>
      </div>
    );
  }

  return (
    <div className="regras__aba">
      <h2>Parâmetros gerais</h2>
      <Formulario estreito onSubmit={enviar} aria-label="Parâmetros gerais">
        <MensagemErro erro={erro} />
        <Campo rotulo={<>Tolerância (R$) {marca("tolerancia")}</>} dica={AJUDA.tolerancia}>
          <input className="campo__controle" inputMode="decimal" required value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} />
        </Campo>
        <Campo rotulo={<>Alíquotas compatíveis (%) {marca("aliquotas_validas")}</>} dica={`${AJUDA.aliquotasValidas} Separe por ponto e vírgula.`}>
          <input className="campo__controle" value={aliquotas} onChange={(e) => setAliquotas(e.target.value)} />
        </Campo>
        <Campo rotulo={<>Base legal do estorno de ST interestadual {marca("base_legal_st_interestadual")}</>} dica={AJUDA.baseLegal}>
          <textarea className="campo__controle" rows={2} maxLength={200} value={baseLegal} onChange={(e) => setBaseLegal(e.target.value)} />
        </Campo>
        <div className="formulario__acoes">
          <Botao type="submit" variante="primario" carregando={enviando}>
            {enviando ? "Salvando…" : "Salvar no rascunho"}
          </Botao>
        </div>
      </Formulario>
    </div>
  );
}
