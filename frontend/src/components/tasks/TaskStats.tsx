import { useMemo } from 'react'
import { AlertTriangle, CalendarClock, UserCheck, CheckCircle2 } from 'lucide-react'
import StatCard from '@/components/dashboard/StatCard'
import { formatSetor, getSetorColors } from '@/lib/constants'
import { dueMeta, isDueSoon } from '@/lib/utils'
import type { Tarefa, Usuario } from '@/types'

interface TaskStatsProps {
  tarefas: Tarefa[]
  user: Usuario | null
  /** Nome dos setores vindos da API, para a distribuição do 2º KPI. */
  nomeSetor: Record<string, string>
}

const MS_POR_DIA = 24 * 60 * 60 * 1000

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MS_POR_DIA)
}

function parseDate(value?: string): Date | null {
  if (!value) return null
  const d = new Date(value.endsWith('Z') ? value : `${value}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Resumo do quadro: o que já estourou, o que estoura na semana, o que é meu
 * e o que saiu. Responde "o que é urgente hoje" antes de o usuário varrer as
 * colunas.
 */
export default function TaskStats({ tarefas, user, nomeSetor }: TaskStatsProps) {
  const stats = useMemo(() => {
    const abertas = tarefas.filter((t) => t.status !== 'CONCLUIDO')

    const vencidas = abertas.filter((t) => dueMeta(t.dataVencimento, t.status).days < 0)

    const proximas = abertas.filter((t) => isDueSoon(t.dataVencimento, 7))

    // Distribuição por setor do que vence na semana, do maior para o menor.
    const porSetor = proximas.reduce<Record<string, number>>((acc, t) => {
      const codigo = String(t.setorOrigem || 'GERAL')
      acc[codigo] = (acc[codigo] || 0) + 1
      return acc
    }, {})
    const distribuicao = Object.entries(porSetor)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([codigo, n]) => `${getSetorColors(codigo, nomeSetor[codigo]).label} ${n}`)
      .join(' · ')

    const minhas = user ? abertas.filter((t) => t.responsavelId === user.id) : []

    const umaSemana = daysAgo(7)
    const duasSemanas = daysAgo(14)
    const concluidas = tarefas.filter((t) => {
      if (t.status !== 'CONCLUIDO') return false
      const d = parseDate(t.dataConclusao)
      return d !== null && d >= umaSemana
    })
    const concluidasAnterior = tarefas.filter((t) => {
      if (t.status !== 'CONCLUIDO') return false
      const d = parseDate(t.dataConclusao)
      return d !== null && d >= duasSemanas && d < umaSemana
    })

    // Sem base de comparação, mostrar "+100%" seria inventar tendência.
    const trend =
      concluidasAnterior.length > 0
        ? {
            value: Math.abs(
              Math.round(
                ((concluidas.length - concluidasAnterior.length) / concluidasAnterior.length) * 100,
              ),
            ),
            positive: concluidas.length >= concluidasAnterior.length,
          }
        : undefined

    return {
      vencidas: vencidas.length,
      proximas: proximas.length,
      distribuicao,
      minhas: minhas.length,
      concluidas: concluidas.length,
      concluidasAnterior: concluidasAnterior.length,
      trend,
    }
  }, [tarefas, user, nomeSetor])

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 kpi2:grid-cols-2 kpi3:grid-cols-4">
      <StatCard
        icon={AlertTriangle}
        tone="error"
        label="Tarefas vencidas"
        value={stats.vencidas}
        subtitle="Prazos estourados que exigem ação hoje"
      />
      <StatCard
        icon={CalendarClock}
        tone="warning"
        label="Vencem em 7 dias"
        value={stats.proximas}
        subtitle={stats.distribuicao || 'Nenhum vencimento na semana'}
      />
      <StatCard
        icon={UserCheck}
        tone="gold"
        label="Atribuídas a você"
        value={stats.minhas}
        subtitle={user ? `${user.nome} · ${formatSetor(user.setor)}` : 'Sem usuário na sessão'}
      />
      <StatCard
        icon={CheckCircle2}
        tone="success"
        label="Concluídas na semana"
        value={stats.concluidas}
        trend={stats.trend}
        subtitle={
          stats.concluidasAnterior > 0
            ? `${stats.concluidasAnterior} na semana anterior`
            : 'Sem base de comparação na semana anterior'
        }
      />
    </div>
  )
}
