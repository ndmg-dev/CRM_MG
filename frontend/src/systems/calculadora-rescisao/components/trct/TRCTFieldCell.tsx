interface TRCTFieldCellProps {
  label: string;
  value: string;
  colSpan?: number;
  number?: string;
}

export function TRCTFieldCell({ label, value, colSpan = 1, number }: TRCTFieldCellProps) {
  return (
    <td colSpan={colSpan} className="border border-gray-400 p-0 align-top">
      <div className="px-1.5 py-0.5">
        <div className="text-[9px] text-gray-500 uppercase leading-tight">
          {number && <span className="font-bold mr-1">{number}</span>}
          {label}
        </div>
        <div className="text-[11px] font-medium leading-tight min-h-[14px]">
          {value || '—'}
        </div>
      </div>
    </td>
  );
}
