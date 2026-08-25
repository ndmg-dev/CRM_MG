import { Button } from "@fronteira-ui";
import { PAGE_SIZE } from "../hooks/queries";

/** Controles de paginação consistentes para as listagens que podem crescer.
 * `total` é o total de itens no servidor; `offset` o deslocamento atual. */
export function Pagination({
  total,
  offset,
  count,
  onChange,
}: {
  total: number;
  offset: number;
  count: number; // itens na página atual
  onChange: (offset: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;

  const from = total === 0 ? 0 : offset + 1;
  const to = offset + count;
  const temAnterior = offset > 0;
  const temProxima = to < total;

  return (
    <div className="row gap-8" style={{ justifyContent: "flex-end", padding: "10px 14px" }}>
      <span className="muted" style={{ fontSize: 13 }}>
        {from}–{to} de {total}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={!temAnterior}
        onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}
      >
        Anterior
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!temProxima}
        onClick={() => onChange(offset + PAGE_SIZE)}
      >
        Próxima
      </Button>
    </div>
  );
}
