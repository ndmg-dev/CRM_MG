import { TRCTSectionHeader } from './TRCTSectionHeader';
import { formatarMoeda } from '@calc/lib/calculos';

export interface EarningRow {
  rubrica: string;
  descricao: string;
  valor: number;
}

interface Props {
  earnings: EarningRow[];
  totalBruto: number;
}

export function TerminationEarningsTable({ earnings, totalBruto }: Props) {
  return (
    <div>
      <TRCTSectionHeader title="Discriminação das Verbas Rescisórias" />
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-1.5 py-1 text-center w-14 text-[9px] uppercase">Rubrica</th>
            <th className="border border-gray-400 px-1.5 py-1 text-left text-[9px] uppercase">Descrição</th>
            <th className="border border-gray-400 px-1.5 py-1 text-right w-28 text-[9px] uppercase">Valor (R$)</th>
          </tr>
        </thead>
        <tbody>
          {earnings.map((row, i) => (
            <tr key={i}>
              <td className="border border-gray-400 px-1.5 py-0.5 font-mono text-[10px] text-center">{row.rubrica}</td>
              <td className="border border-gray-400 px-1.5 py-0.5">{row.descricao}</td>
              <td className="border border-gray-400 px-1.5 py-0.5 text-right font-mono">
                {formatarMoeda(row.valor)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td className="border border-gray-400 px-1.5 py-1" colSpan={2}>
              TOTAL BRUTO
            </td>
            <td className="border border-gray-400 px-1.5 py-1 text-right font-mono">
              {formatarMoeda(totalBruto)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
