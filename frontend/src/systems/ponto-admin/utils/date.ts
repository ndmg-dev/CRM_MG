// O backend salva horários como UTC naive (sem 'Z').
// JS trata strings sem timezone como horário LOCAL, causando exibição errada.
// Appending 'Z' força interpretação UTC → toLocale* converte para o timezone do browser.

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

function utcDate(iso: string): Date {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return new Date(iso)
  return new Date(iso + 'Z')
}

export function formatTime(iso: string): string {
  return utcDate(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ })
}

export function formatTimeShort(iso: string): string {
  return utcDate(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

// Minutos desde a meia-noite, no mesmo timezone que formatTimeShort exibe —
// para comparar um horário de batida com um horário de jornada ("HH:MM").
export function localMinutesOfDay(iso: string): number {
  const [h, m] = utcDate(iso)
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
    .split(':')
  return Number(h) * 60 + Number(m)
}

// Minutos decorridos desde um timestamp do backend até agora. Passa pelo mesmo
// utcDate() do resto do arquivo — sem ele o 'naive' seria lido como local e a
// diferença sairia deslocada pelo fuso.
export function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - utcDate(iso).getTime()) / 60000))
}

// "1h20" / "55min" — duração curta, para "fora há ...".
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`
}

export function formatDate(iso: string): string {
  return utcDate(iso).toLocaleDateString('pt-BR', { timeZone: TZ })
}

export function formatDateTime(iso: string): string {
  return utcDate(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

// Para campos date/time de formulário (<input type="date|time">)
// Converte o timestamp UTC para o valor local que o input deve exibir
export function toInputDate(iso: string): string {
  // en-CA produz YYYY-MM-DD — formato exigido por <input type="date">
  return utcDate(iso).toLocaleDateString('en-CA', { timeZone: TZ })
}

// Data de hoje no formato YYYY-MM-DD, no timezone do browser
export function todayInputDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

// Converte um valor de <input type="date"> (YYYY-MM-DD) no par [início, fim]
// do dia local, em UTC ISO — para usar como date_from/date_to de filtros de API.
// O <input type="date"> pode ficar vazio (usuário apaga o campo) — sem o
// fallback, `new Date('T00:00:00')` é Invalid Date e `.toISOString()` lança
// RangeError, derrubando a página inteira (Dashboard).
export function localDayRangeToUtcIso(inputDate: string): { from: string; to: string } {
  const day = inputDate || todayInputDate()
  return {
    from: new Date(`${day}T00:00:00`).toISOString(),
    to: new Date(`${day}T23:59:59.999`).toISOString(),
  }
}

// ─── Semana (segunda a domingo) ──────────────────────────────────────────────
// Compartilhado por Relatórios e pelo ranking do Dashboard: as duas telas
// precisam recortar exatamente a mesma semana, senão os saldos divergem.

/** Segunda e domingo da semana ISO que contém `anchor`. */
export function isoWeekBounds(anchor: Date): { start: Date; end: Date } {
  const day = anchor.getDay() // 0=domingo..6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(anchor)
  start.setDate(anchor.getDate() + diffToMonday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

/** YYYY-MM-DD no timezone do browser — formato de date_from/date_to da API. */
export function toInputDateLocal(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

/** "31/08" — extremo de um intervalo curto. */
export function fmtDayMonth(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function toInputTime(iso: string): string {
  return utcDate(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}
