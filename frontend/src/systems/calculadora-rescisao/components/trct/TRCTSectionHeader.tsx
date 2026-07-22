interface TRCTSectionHeaderProps {
  title: string;
}

export function TRCTSectionHeader({ title }: TRCTSectionHeaderProps) {
  return (
    <div className="bg-gray-200 border border-gray-400 px-2 py-1">
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-center">
        {title}
      </h3>
    </div>
  );
}
