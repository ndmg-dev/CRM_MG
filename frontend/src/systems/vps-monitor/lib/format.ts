// Helpers de formatação — o backend já entrega bytes/epoch, aqui só a
// apresentação (pt-BR).

export function fmtBytes(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—'
  if (n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / 1024 ** i).toFixed(digits)} ${units[i]}`
}

export function fmtPct(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toFixed(1)}%`
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return '—'
  const diff = Date.now() - d
  const abs = Math.abs(diff)
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  const suffix = diff >= 0 ? 'atrás' : 'no futuro'
  if (abs < hour) return `${Math.round(abs / min)} min ${suffix}`
  if (abs < day) return `${Math.round(abs / hour)} h ${suffix}`
  return `${Math.round(abs / day)} d ${suffix}`
}

export function fmtUptime(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}

// Rótulo curto do eixo X conforme a janela.
export function tickLabel(t: number, range: '24h' | '7d' | '30d'): string {
  const d = new Date(t)
  if (range === '24h') return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const STATE_LABELS: Record<string, string> = {
  running: 'Rodando',
  stopped: 'Parada',
  starting: 'Iniciando',
  stopping: 'Parando',
  restarting: 'Reiniciando',
  error: 'Erro',
  suspended: 'Suspensa',
}

export function stateLabel(state: string | null | undefined): string {
  if (!state) return '—'
  return STATE_LABELS[state] ?? state
}

export function stateTone(state: string | null | undefined): 'ok' | 'warn' | 'bad' | 'neutral' {
  switch (state) {
    case 'running':
      return 'ok'
    case 'starting':
    case 'stopping':
    case 'restarting':
      return 'warn'
    case 'error':
    case 'stopped':
    case 'suspended':
      return 'bad'
    default:
      return 'neutral'
  }
}

// Nomes de ação da Hostinger → português. `ct_set_limits` é ruído horário do
// orquestrador da Hostinger (ajuste de limites do container) — marcado como
// tal pra UI poder filtrar.
const ACTION_LABELS: Record<string, string> = {
  ct_set_limits: 'Ajuste de limites (automático)',
  backup_create: 'Backup criado',
  backup_restore: 'Backup restaurado',
  snapshot_create: 'Snapshot criado',
  snapshot_restore: 'Snapshot restaurado',
  restart: 'Reinício',
  start: 'Ligada',
  stop: 'Desligada',
  recreate: 'Recriada',
  create: 'Criada',
}

export function actionLabel(name: string): string {
  return ACTION_LABELS[name] ?? name
}

export function isNoiseAction(name: string): boolean {
  return name === 'ct_set_limits'
}
