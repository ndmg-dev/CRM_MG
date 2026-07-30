import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import IconBadge, { type IconBadgeTone } from '@/components/common/IconBadge'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  subtitle?: string
  /** Tom semântico do badge do ícone. */
  tone?: IconBadgeTone
  trend?: { value: number; positive: boolean }
}

/**
 * KPI compacto do dashboard (~136px de altura), na proporção do sistema de
 * ponto: badge do ícone no topo, rótulo em caixa alta, valor em destaque e
 * descrição secundária.
 *
 * O contador animado anterior foi removido de propósito: números que sobem
 * durante 1,2s atrapalham a leitura numa tela de operação.
 */
export default function StatCard({
  icon,
  label,
  value,
  subtitle,
  tone = 'gold',
  trend,
}: StatCardProps) {
  const display = typeof value === 'number' ? value.toLocaleString('pt-BR') : value

  return (
    <div className="flex min-h-[136px] flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-border-light">
      <IconBadge icon={icon} tone={tone} />

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-label text-text-muted">
        {label}
      </p>

      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-[30px] font-bold leading-none text-text-primary tabular-nums">
          {display}
        </p>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-medium ${
              trend.positive ? 'text-success' : 'text-error'
            }`}
          >
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            {/* O sinal também vai em texto — cor sozinha não comunica estado. */}
            {trend.positive ? '+' : '−'}{trend.value}%
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-auto pt-2 text-[11px] leading-snug text-text-muted">{subtitle}</p>
      )}
    </div>
  )
}
