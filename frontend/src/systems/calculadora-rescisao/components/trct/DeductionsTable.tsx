import { TRCTSectionHeader } from './TRCTSectionHeader';
import { formatarMoeda } from '@calc/lib/calculos';

export interface DeductionRow {
  codigo: string;
  descricao: string;
  valor: number;
}

interface Props {
  deductions: DeductionRow[];
  totalDeducoes: number;
}

export function DeductionsTable({ deductions, totalDeducoes }: Props) {
  const minRows = 5;
  const padded = [...deductions];
  while (padded.length < minRows) {
    padded.push({ codigo: '', descricao: '', valor: 0 });
  }

  return (
    <div>
      <TRCTSectionHeader title="Deduções" />
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-1.5 py-1 text-left w-16 text-[9px] uppercase">Código</th>
            <th className="border border-gray-400 px-1.5 py-1 text-left text-[9px] uppercase">Descrição</th>
            <th className="border border-gray-400 px-1.5 py-1 text-right w-28 text-[9px] uppercase">Valor (R$)</th>
          </tr>
        </thead>
        <tbody>
          {padded.map((row, i) => (
            <tr key={i}>
              <td className="border border-gray-400 px-1.5 py-0.5 font-mono text-[10px]">{row.codigo}</td>
              <td className="border border-gray-400 px-1.5 py-0.5">{row.descricao}</td>
              <td className="border border-gray-400 px-1.5 py-0.5 text-right font-mono">
                {row.valor > 0 ? formatarMoeda(row.valor) : row.codigo ? '0,00' : ''}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td className="border border-gray-400 px-1.5 py-1" colSpan={2}>
              TOTAL DEDUÇÕES
            </td>
            <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
              {formatarMoeda(totalDeducoes)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
