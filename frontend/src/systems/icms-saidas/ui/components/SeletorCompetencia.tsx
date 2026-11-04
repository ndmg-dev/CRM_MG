import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";

import {
  competenciaPorExtenso,
  formatarCompetencia,
  lerCompetencia,
  MESES_CURTOS,
  mesAtual,
  somarMeses,
} from "../../formato";
import "./seletor-competencia.css";

const MENSAGEM_INVALIDA = "Use MM/AAAA, por exemplo 09/2026";
const COLUNAS_GRADE = 4;

/** Máscara leve: "092026" vira "09/2026"; quem digita a barra ("9/2026") fica como está. */
function mascarar(texto: string): string {
  const limpo = texto.replace(/[^\d/]/g, "").slice(0, 7);
  if (limpo.includes("/")) return limpo;
  return limpo.length > 2 ? `${limpo.slice(0, 2)}/${limpo.slice(2, 6)}` : limpo;
}

type Props = {
  /** Competência AAAA-MM (formato da API); "" = vazio (só no modo campo). Exibida sempre como MM/AAAA. */
  valor: string;
  onChange: (valor: string) => void;
  /** Avisa se o texto digitado (modo campo) é válido; inválido não chama `onChange`. */
  onValidade?: (valido: boolean) => void;
  /** Limites AAAA-MM. Padrão de `max`: o mês atual (meses futuros desabilitados). */
  min?: string;
  max?: string;
  modo?: "inline" | "campo";
  /** Nome acessível (inline) ou id do campo para um <label htmlFor> externo (campo). */
  rotulo?: string;
  id?: string;
  placeholder?: string;
  /** id de um texto de dica abaixo do campo. */
  idDica?: string;
  desabilitado?: boolean;
};

export function SeletorCompetencia({
  valor,
  onChange,
  onValidade,
  min,
  max = mesAtual(),
  modo = "inline",
  rotulo = "Competência",
  id,
  placeholder = "MM/AAAA",
  idDica,
  desabilitado = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(valor ? formatarCompetencia(valor) : "");
  const [erro, setErro] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const idErro = useId();
  const idDialogo = useId();

  // Valor mudou por fora (botões ‹ ›, URL, grade): o texto acompanha.
  useEffect(() => {
    setTexto(valor ? formatarCompetencia(valor) : "");
    setErro(false);
  }, [valor]);

  const foraDoLimite = (c: string) => (!!min && c < min) || (!!max && c > max);

  function escolher(c: string) {
    onChange(c);
    onValidade?.(true);
    setAberto(false);
    gatilho.current?.focus();
  }

  function confirmarTexto() {
    if (!texto.trim()) {
      setErro(false);
      onValidade?.(true);
      if (valor) onChange("");
      return;
    }
    const lido = lerCompetencia(texto);
    if (!lido || foraDoLimite(lido)) {
      setErro(true);
      onValidade?.(false);
      return;
    }
    setErro(false);
    setTexto(formatarCompetencia(lido));
    onValidade?.(true);
    if (lido !== valor) onChange(lido);
  }

  const popover = aberto && (
    <GradeMeses
      id={idDialogo}
      valor={valor || max}
      foraDoLimite={foraDoLimite}
      escolher={escolher}
      fechar={() => {
        setAberto(false);
        gatilho.current?.focus();
      }}
      raiz={raiz}
    />
  );

  if (modo === "campo") {
    const descritoPor = [idDica, erro ? idErro : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="seletor-competencia" data-modo="campo" ref={raiz}>
        <div className="seletor-competencia__campo">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={7}
            placeholder={placeholder}
            value={texto}
            disabled={desabilitado}
            aria-invalid={erro || undefined}
            aria-describedby={descritoPor}
            onChange={(e) => setTexto(mascarar(e.target.value))}
            onBlur={confirmarTexto}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarTexto();
            }}
          />
          <button
            ref={gatilho}
            type="button"
            className="seletor-competencia__abrir"
            aria-label="Escolher mês no calendário"
            aria-haspopup="dialog"
            aria-expanded={aberto}
            aria-controls={aberto ? idDialogo : undefined}
            disabled={desabilitado}
            onClick={() => setAberto((a) => !a)}
          >
            <IconeCalendario />
          </button>
        </div>
        {erro && (
          <p id={idErro} className="seletor-competencia__erro">
            {MENSAGEM_INVALIDA}
          </p>
        )}
        {popover}
      </div>
    );
  }

  const anterior = somarMeses(valor, -1);
  const proximo = somarMeses(valor, 1);
  return (
    <div className="seletor-competencia" data-modo="inline" ref={raiz} role="group" aria-label={rotulo}>
      <button
        type="button"
        className="seletor-competencia__passo"
        aria-label={`Mês anterior (${formatarCompetencia(anterior)})`}
        disabled={desabilitado || foraDoLimite(anterior)}
        onClick={() => onChange(anterior)}
      >
        ‹
      </button>
      <button
        ref={gatilho}
        type="button"
        className="seletor-competencia__atual"
        aria-label={`${rotulo}: ${formatarCompetencia(valor)}. Escolher outro mês`}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? idDialogo : undefined}
        disabled={desabilitado}
        onClick={() => setAberto((a) => !a)}
      >
        {formatarCompetencia(valor)}
      </button>
      <button
        type="button"
        className="seletor-competencia__passo"
        aria-label={`Próximo mês (${formatarCompetencia(proximo)})`}
        disabled={desabilitado || foraDoLimite(proximo)}
        onClick={() => onChange(proximo)}
      >
        ›
      </button>
      {popover}
    </div>
  );
}

function GradeMeses({
  id,
  valor,
  foraDoLimite,
  escolher,
  fechar,
  raiz,
}: {
  id: string;
  valor: string;
  foraDoLimite: (c: string) => boolean;
  escolher: (c: string) => void;
  fechar: () => void;
  raiz: RefObject<HTMLDivElement | null>;
}) {
  const [ano, setAno] = useState(Number(valor.slice(0, 4)));
  const [foco, setFoco] = useState(valor);
  const [digitado, setDigitado] = useState("");
  const [erro, setErro] = useState(false);
  const grade = useRef<HTMLDivElement>(null);
  const idErro = useId();

  // Ao abrir, o foco vai para o mês selecionado; depois, segue as setas (o botão pode ser de outro ano, já renderizado).
  const focarDepois = useRef<string | null>(valor);
  useEffect(() => {
    if (!focarDepois.current) return;
    grade.current?.querySelector<HTMLButtonElement>(`[data-competencia="${focarDepois.current}"]`)?.focus();
    focarDepois.current = null;
  });

  useEffect(() => {
    function fora(evento: Event) {
      if (raiz.current && !raiz.current.contains(evento.target as Node)) fechar();
    }
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [fechar, raiz]);

  function moverFoco(delta: number) {
    let alvo = somarMeses(foco, delta);
    // pula meses fora do limite, sem sair do intervalo possível
    for (let i = 0; i < 24 && foraDoLimite(alvo); i++) alvo = somarMeses(alvo, delta > 0 ? 1 : -1);
    if (foraDoLimite(alvo)) return;
    focarDepois.current = alvo;
    setFoco(alvo);
    setAno(Number(alvo.slice(0, 4)));
  }

  function teclaNaGrade(evento: KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -COLUNAS_GRADE,
      ArrowDown: COLUNAS_GRADE,
    };
    if (evento.key in passos) {
      evento.preventDefault();
      moverFoco(passos[evento.key]);
    }
  }

  function aplicarDigitado() {
    const lido = lerCompetencia(digitado);
    if (!lido || foraDoLimite(lido)) {
      setErro(true);
      return;
    }
    escolher(lido);
  }

  // O mês que recebe Tab na grade: o focado, ou o mesmo mês no ano que está à vista.
  const focoVisivel = foco.startsWith(`${ano}-`) ? foco : `${ano}-${foco.slice(5)}`;

  return (
    <div
      id={id}
      className="seletor-competencia__popover"
      role="dialog"
      aria-label="Escolher competência"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          fechar();
        }
      }}
    >
      <label className="seletor-competencia__digitar">
        Digite o mês
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={7}
          placeholder="MM/AAAA"
          value={digitado}
          aria-invalid={erro || undefined}
          aria-describedby={erro ? idErro : undefined}
          onChange={(e) => {
            setDigitado(mascarar(e.target.value));
            setErro(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              aplicarDigitado();
            }
          }}
        />
      </label>
      {erro && (
        <p id={idErro} className="seletor-competencia__erro">
          {MENSAGEM_INVALIDA}
        </p>
      )}
      <div className="seletor-competencia__ano">
        <button type="button" aria-label={`Ano anterior (${ano - 1})`} onClick={() => setAno((a) => a - 1)}>
          ‹
        </button>
        <span aria-live="polite">{ano}</span>
        <button type="button" aria-label={`Próximo ano (${ano + 1})`} onClick={() => setAno((a) => a + 1)}>
          ›
        </button>
      </div>
      <div className="seletor-competencia__grade" ref={grade} role="group" aria-label={`Meses de ${ano}`} onKeyDown={teclaNaGrade}>
        {MESES_CURTOS.map((nome, i) => {
          const c = `${ano}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button
              key={c}
              type="button"
              data-competencia={c}
              aria-label={competenciaPorExtenso(c)}
              aria-pressed={c === valor}
              tabIndex={c === focoVisivel ? 0 : -1}
              disabled={foraDoLimite(c)}
              onFocus={() => setFoco(c)}
              onClick={() => escolher(c)}
            >
              {nome}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IconeCalendario() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}
