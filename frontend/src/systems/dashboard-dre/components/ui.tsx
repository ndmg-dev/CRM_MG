"use client";

/** Primitivas visuais — design-system.md §3 e §4. */

export function Eyebrow({
  children,
  descricao,
}: {
  children: React.ReactNode;
  descricao?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <h2 className="text-[11px] font-medium tracking-[.08em] text-text-muted uppercase">
        {children}
      </h2>
      {descricao && (
        <span className="text-[11px] text-text-faint">· {descricao}</span>
      )}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[10px] border border-line bg-panel p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function Nota({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-text-faint">{children}</p>;
}
