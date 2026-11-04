import { useEffect, useId, useRef, useState, type DragEvent } from "react";

import { formatarTamanho } from "../../formato";
import "./envio.css";

type Props = {
  /** Extensões aceitas, separadas por vírgula (".xlsx" ou ".xlsx,.csv"). */
  aceita?: string;
  arquivo: File | null;
  onEscolher: (arquivo: File | null) => void;
  /** Durante o processamento: nem escolher, nem trocar, nem soltar arquivo. */
  travado?: boolean;
  rotulo?: string;
};

function aceito(arquivo: File, aceita: string): boolean {
  const nome = arquivo.name.toLowerCase();
  return aceita.split(",").some((ext) => nome.endsWith(ext.trim().toLowerCase()));
}

/**
 * <input type="file"> real (visualmente oculto, mas focável) atrás de um <label> estilizado.
 * Arrastar e soltar é atalho, nunca o único caminho.
 */
export function EnvioArquivo({ aceita = ".xlsx", arquivo, onEscolher, travado = false, rotulo = "Arquivo" }: Props) {
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  const idErro = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const lista = aceita.split(",").map((e) => e.trim()).join(" ou ");

  // Arquivo limpo por fora (ex.: "Processar outro arquivo"): o campo nativo também.
  useEffect(() => {
    if (!arquivo && campo.current) campo.current.value = "";
  }, [arquivo]);

  function receber(novo: File | null | undefined) {
    if (travado || !novo) return;
    if (!aceito(novo, aceita)) {
      setErro(`Escolha um arquivo ${lista}.`);
      return;
    }
    setErro(null);
    onEscolher(novo);
  }

  function soltar(evento: DragEvent<HTMLElement>) {
    evento.preventDefault();
    setArrastando(false);
    receber(evento.dataTransfer.files?.[0]);
  }

  function sobre(evento: DragEvent<HTMLElement>) {
    evento.preventDefault();
    if (!travado) setArrastando(true);
  }

  return (
    <div
      className="envio"
      data-estado={arquivo ? "selecionado" : "vazio"}
      data-arrastando={arrastando || undefined}
      data-travado={travado || undefined}
      onDragOver={sobre}
      onDragLeave={() => setArrastando(false)}
      onDrop={soltar}
    >
      <input
        ref={campo}
        id={id}
        type="file"
        className="visualmente-oculto envio__campo"
        accept={aceita}
        disabled={travado}
        aria-invalid={!!erro || undefined}
        aria-describedby={erro ? idErro : undefined}
        onChange={(e) => receber(e.target.files?.[0])}
      />
      {arquivo ? (
        <div className="envio__selecionado">
          <IconeArquivo />
          <div className="envio__info">
            <span className="envio__nome">{arquivo.name}</span>
            <span className="envio__tamanho">{formatarTamanho(arquivo.size)}</span>
          </div>
          <label htmlFor={id} className="envio__trocar">
            Trocar<span className="visualmente-oculto"> {rotulo.toLowerCase()}</span>
          </label>
        </div>
      ) : (
        <label htmlFor={id} className="envio__area">
          <IconeArquivo />
          <span className="envio__chamada">
            {rotulo} ({lista}): <span className="envio__escolher">escolher arquivo</span>
          </span>
          <span className="envio__dica">ou arraste e solte aqui</span>
        </label>
      )}
      {erro && (
        <p id={idErro} className="envio__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

function IconeArquivo() {
  return (
    <svg className="envio__icone" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}
