import { formatarMoeda } from '@calc/lib/calculos';

interface Props {
  totalBruto: number;
  totalDeducoes: number;
  valorLiquido: number;
}

export function TerminationTotalsSection({ totalBruto, totalDeducoes, valorLiquido }: Props) {
  const saldoDevedor = valorLiquido < 0 ? Math.abs(valorLiquido) : 0;
  const liquidoExibido = valorLiquido < 0 ? 0 : valorLiquido;

  return (
    <div>
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          <tr className="bg-gray-100">
            <td className="border border-gray-400 px-2 py-1.5 font-bold uppercase text-[10px]">Total Bruto</td>
            <td className="border border-gray-400 px-2 py-1.5 text-right font-mono font-bold w-32">{formatarMoeda(totalBruto)}</td>
          </tr>
          <tr className="bg-gray-100">
            <td className="border border-gray-400 px-2 py-1.5 font-bold uppercase text-[10px]">Total Deduções</td>
            <td className="border border-gray-400 px-2 py-1.5 text-right font-mono font-bold w-32">({formatarMoeda(totalDeducoes)})</td>
          </tr>
          {saldoDevedor > 0 && (
            <tr className="bg-gray-100">
              <td className="border border-gray-400 px-2 py-1.5 font-bold uppercase text-[10px]">Saldo Devedor</td>
              <td className="border border-gray-400 px-2 py-1.5 text-right font-mono font-bold w-32">{formatarMoeda(saldoDevedor)}</td>
            </tr>
          )}
          <tr className="bg-gray-800 text-white">
            <td className="border border-gray-400 px-2 py-2 font-bold uppercase text-xs">Valor Líquido a Receber</td>
            <td className="border border-gray-400 px-2 py-2 text-right font-mono font-bold text-sm w-32">{formatarMoeda(liquidoExibido)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
