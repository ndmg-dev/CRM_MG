import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, Activity } from 'lucide-react';
import DrillDownModal from './DrillDownModal';

export interface DreNode {
  account_name: string;
  value: number;
  percentage: number;
  base_value: number;
  base_percentage: number;
  ah_percentage: number;
  children: DreNode[];
}

interface DRETableContextProps {
  onAccountClick?: (node: DreNode) => void;
}

const DRETableContext = React.createContext<DRETableContextProps | null>(null);

interface DRETableProps {
  data: DreNode[];
  targetLabel: string;
  baseLabel: string;
}

function DRETableRow({ node, depth = 0 }: { node: DreNode; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  const context = React.useContext(DRETableContext);
  const onAccountClick = context?.onAccountClick;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <>
      <tr className={`border-b border-[#27272a] ${depth === 0 ? 'bg-[#1a1a1c]' : 'bg-[#111111] hover:bg-[#1a1a1c] transition-colors'}`}>
        <td className="p-3 font-semibold flex items-center gap-2 group cursor-pointer" onClick={() => onAccountClick && onAccountClick(node)}>
          <div style={{ marginLeft: `${depth * 16}px` }} className="flex items-center gap-2 w-full">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-[#a1a1aa] hover:text-white focus:outline-none"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!hasChildren && <span className="w-4" />}
            <span className={`flex-1 transition-colors ${depth === 0 ? 'text-[#d4af37]' : 'text-[#e4e4e7] group-hover:text-[#d4af37]'}`}>
              {node.account_name}
            </span>
            <Activity size={14} className="opacity-0 group-hover:opacity-100 text-[#d4af37] transition-opacity mr-2" />
          </div>
        </td>

        {/* TARGET PERIOD */}
        <td className={`py-3 px-4 text-sm text-right ${depth === 0 ? 'text-white' : 'text-gray-200'}`}>
          {formatCurrency(node.value)}
        </td>
        <td className={`py-3 px-4 text-sm text-right ${depth === 0 ? 'text-[#D4AF37]' : 'text-gray-400'}`}>
          {node.percentage.toFixed(2)}%
        </td>

        {/* BASE PERIOD */}
        <td className="py-3 px-4 text-sm text-right text-gray-300">
          {formatCurrency(node.base_value)}
        </td>
        <td className="py-3 px-4 text-sm text-right text-gray-500">
          {node.base_percentage.toFixed(2)}%
        </td>

        {/* ANÁLISE HORIZONTAL */}
        <td className={`py-3 px-4 text-sm text-right font-medium ${node.ah_percentage > 0 ? 'text-green-500' : node.ah_percentage < 0 ? 'text-red-500' : 'text-gray-500'}`}>
          {node.ah_percentage > 0 ? '+' : ''}{node.ah_percentage.toFixed(2)}%
        </td>
      </tr>
      {isExpanded && hasChildren && node.children.map((child, idx) => (
        <DRETableRow key={`${child.account_name}-${idx}`} node={child} depth={depth + 1} />
      ))}
    </>
  );
}

export default function DRETable({ data, targetLabel, baseLabel }: DRETableProps) {
  const [searchParams] = useSearchParams();
  const companyId = searchParams.get('company_id') || '';
  const [drilldownAccount, setDrilldownAccount] = useState<DreNode | null>(null);

  if (!data || data.length === 0) return null;

  const handleAccountClick = (node: DreNode) => {
    setDrilldownAccount(node);
  };

  return (
    <DRETableContext.Provider value={{ onAccountClick: handleAccountClick }}>
      <div className="bg-[#1a1a1c] border border-[#27272a] rounded-xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-[#27272a] flex justify-between items-center bg-[#151517]">
          <h2 className="text-white font-semibold text-lg">Demonstração do Resultado Analítica</h2>
          <span className="text-[#a1a1aa] text-sm hidden md:block">Comparativo Múltiplos Períodos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[#0c0c0c] border-b border-[#27272a] text-[#a1a1aa] text-xs uppercase tracking-wider">
                <th className="py-3 px-4 font-medium">Conta Contábil</th>
                <th className="py-3 px-4 font-medium text-right text-white">{targetLabel}</th>
                <th className="py-3 px-4 font-medium text-right text-[#D4AF37]">AV% ({targetLabel})</th>
                <th className="py-3 px-4 font-medium text-right text-gray-400">{baseLabel}</th>
                <th className="py-3 px-4 font-medium text-right text-gray-500">AV% ({baseLabel})</th>
                <th className="py-3 px-4 font-medium text-right">AH% (Variação)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((node, idx) => (
                <DRETableRow key={idx} node={node} />
              ))}
            </tbody>
          </table>
        </div>

        {drilldownAccount && (
          <DrillDownModal
            accountName={drilldownAccount.account_name}
            companyId={companyId}
            onClose={() => setDrilldownAccount(null)}
            baseValue={drilldownAccount.base_value}
            targetValue={drilldownAccount.value}
          />
        )}
      </div>
    </DRETableContext.Provider>
  );
}
