import { useExportFronteira, type WizardDuplicata } from "../../hooks/queries";
import { apiError } from "../../lib/api";
import { useState } from "react";
import { Badge, Button } from "@fronteira-ui";

/** Tela "Notas já importadas detectadas" — mostrada quando /wizard/upload
 * encontra, entre os arquivos enviados, notas cuja chave de acesso já foi
 * importada E CALCULADA antes (duplicata real, não apenas reimportação de
 * uma nota nunca calculada). O usuário decide o que fazer com o lote
 * inteiro: recalcular tudo (inclusive as duplicatas), seguir só com as
 * notas novas, ou cancelar a importação. */
export function WizardStepDuplicatas({
  duplicates,
  totalNotas,
  onResolve,
  onCancel,
}: {
  duplicates: WizardDuplicata[];
  totalNotas: number;
  onResolve: (acao: "recalcular" | "ignorar") => void;
  onCancel: () => void;
}) {
  const exportar = useExportFronteira();
  const [error, setError] = useState("");
  const chaves = new Set(duplicates.map((d) => d.chave_nfe));

  async function verAnterior(invoiceId: number) {
    setError("");
    try {
      await exportar.mutateAsync(invoiceId);
    } catch (err) {
      setError(apiError(err, "Não foi possível exportar o XLSX anterior."));
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 style={{ fontSize: 14 }}>Notas já importadas detectadas</h2>
        <Badge variant="err">
          {duplicates.length} de {totalNotas} nota(s)
        </Badge>
      </div>
      <div className="card-body stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="alert alert-warn">
          {duplicates.length} nota(s) deste envio já foram importadas <strong>e calculadas</strong> em um
          lote anterior (mesma chave de acesso). O que deseja fazer?
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Número</th>
              <th>Emitente</th>
              <th>Chave de acesso</th>
              <th>Competência anterior</th>
              <th>Nota anterior</th>
            </tr>
          </thead>
          <tbody>
            {duplicates.map((d) => (
              <tr key={d.chave_nfe}>
                <td className="num">{d.numero}</td>
                <td>{d.emitente_nome}</td>
                <td className="num" style={{ fontSize: 11.5 }}>
                  {d.chave_nfe}
                </td>
                <td className="num">{d.competencia}</td>
                <td>
                  <Button variant="ghost" size="sm" onClick={() => verAnterior(d.invoice_id)} disabled={exportar.isPending}>
                    Ver XLSX (nota #{d.invoice_id})
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted" style={{ fontSize: 13 }}>
          {totalNotas - chaves.size} nota(s) do envio são novas e serão processadas normalmente,
          independente da escolha abaixo.
        </p>
      </div>

      <div className="card-head" style={{ borderTop: "1px solid var(--line)", borderBottom: "none", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="ghost" onClick={() => onResolve("ignorar")}>
          Não, ignorar duplicatas
        </Button>
        <Button variant="primary" onClick={() => onResolve("recalcular")}>
          Sim, recalcular todas
        </Button>
      </div>
    </div>
  );
}
