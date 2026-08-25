import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  target_value: number;
  base_value?: number;
  delta_absolute?: number;
  delta_percentage?: number;
  description?: string;
}

export default function KPICard({ title, target_value, delta_percentage = 0, delta_absolute = 0 }: KPICardProps) {
  const isPositive = delta_percentage > 0;
  const isNeutral = delta_percentage === 0;

  return (
    <div className="bg-[#111111] border border-[#27272a] rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-[#d4af37]/40 transition-colors duration-300">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#d4af37] opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[#a1a1aa] text-xs uppercase tracking-widest font-semibold">{title}</h3>

        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-[#1a1a1c] ${isNeutral ? 'text-gray-400' : isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {isNeutral ? <Minus size={12} /> : isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(delta_percentage).toFixed(1)}%
        </div>
      </div>

      <div className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-white">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(target_value)}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-xs">
        <span className="text-[#71717a]">
          Variação Absoluta:
          <span className={`ml-2 font-semibold ${isNeutral ? 'text-gray-400' : isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {delta_absolute > 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(delta_absolute)}
          </span>
        </span>
      </div>
    </div>
  );
}
