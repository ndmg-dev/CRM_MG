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

export function toInputTime(iso: string): string {
  return utcDate(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}
