import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { X, TrendingUp, AlertCircle } from 'lucide-react';
import { bimgApiUrl } from '../lib/api';

interface DrillDownModalProps {
  accountName: string;
  companyId: string;
  onClose: () => void;
  baseValue: number;
  targetValue: number;
}

export default function DrillDownModal({ accountName, companyId, onClose, baseValue, targetValue }: DrillDownModalProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const params = new URLSearchParams();
        params.append('account_name', accountName);
        if (companyId) {
          params.append('company_id', companyId);
        }

        const res = await fetch(bimgApiUrl(`/dre/account_history?${params.toString()}`));
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Error fetching drilldown data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();

    // Prevent scrolling behind modal
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [accountName, companyId]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const val = payload[0].value;
      const formattedValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

      return (
        <div className="bg-[#1a1a1c] border border-[#27272a] rounded-lg p-3 shadow-xl">
          <p className="text-[#d4af37] font-bold mb-1 m-0">{label}</p>
          <p className="m-0 text-white font-semibold">
            Saldo: {formattedValue}
          </p>
        </div>
      );
    }
    return null;
  };

  const trend = targetValue - baseValue;
  const isPositive = trend >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111111] border border-[#27272a] rounded-xl shadow-2xl w-full max-w-4xl relative overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-5 border-b border-[#27272a] flex justify-between items-start bg-[#161618]">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              Detalhamento: <span className="text-[#d4af37]">{accountName}</span>
            </h2>
            <p className="text-[#a1a1aa] text-sm flex items-center gap-2">
              Análise de Evolução Histórica
              {data.length > 0 && <span className="bg-[#27272a] px-2 py-0.5 rounded text-xs">{data.length} períodos carregados</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white transition-colors p-1 bg-transparent hover:bg-[#27272a] rounded-md"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="bg-[#1a1a1c] border border-[#27272a] p-4 rounded-lg">
                <p className="text-[#a1a1aa] text-sm mb-1 uppercase tracking-wider font-semibold">Saldo do Mês (Alvo)</p>
                <p className="text-2xl font-bold text-white">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(targetValue)}
                </p>
             </div>
             <div className="bg-[#1a1a1c] border border-[#27272a] p-4 rounded-lg">
                <p className="text-[#a1a1aa] text-sm mb-1 uppercase tracking-wider font-semibold">Variação Real (vs. Base)</p>
                <div className="flex items-center gap-2">
                  <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {trend > 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(trend)}
                  </p>
                  {trend !== 0 && (
                     <TrendingUp size={20} className={isPositive ? 'text-emerald-400' : 'text-rose-400 rotate-180'} />
                  )}
                </div>
             </div>
          </div>

          {/* Chart */}
          <div className="bg-[#1a1a1c] border border-[#27272a] p-5 rounded-lg flex-1 min-h-[350px]">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-[#d4af37]" />
              Linha do Tempo
            </h3>

            {loading ? (
              <div className="h-[250px] w-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[#27272a] border-t-[#d4af37] rounded-full animate-spin"></div>
              </div>
            ) : data.length === 0 ? (
              <div className="h-[250px] w-full flex items-center justify-center flex-col text-[#71717a]">
                <AlertCircle size={32} className="mb-2 opacity-50" />
                <p>Nenhum dado histórico encontrado para essa conta.</p>
              </div>
            ) : (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis
                      dataKey="period"
                      stroke="#71717a"
                      tick={{fill: '#71717a', fontSize: 12}}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                       stroke="#71717a"
                       tick={{fill: '#71717a', fontSize: 12}}
                       axisLine={false}
                       tickLine={false}
                       tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`}
                       width={80}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#27272a', strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#d4af37"
                      strokeWidth={3}
                      dot={{r: 4, fill: '#1a1a1c', stroke: '#d4af37', strokeWidth: 2}}
                      activeDot={{r: 6, fill: '#d4af37'}}
                      isAnimationActive={true}
                      animationDuration={1000}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
