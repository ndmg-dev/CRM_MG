import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAgenda } from '../hooks/useObrigacoes'
import { Carregando, ErroCarregamento } from '../components/Comuns'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** Calendário mensal com os vencimentos plotados por dia. As contagens vêm
 *  agregadas do banco (`agenda_mes`) — a tela não baixa as entregas. */
export function Agenda() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)

  const { data, isLoading, isError, error } = useAgenda(ano, mes)

  const porDia = new Map((data ?? []).map((d) => [d.dia.slice(0, 10), d]))

  // Usa UTC para montar a grade: `new Date(ano, mes, dia)` local mais fuso
  // negativo pode deslocar o primeiro dia do mês.
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1))
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const deslocamento = primeiro.getUTCDay()

  const navegar = (delta: number) => {
    const d = new Date(Date.UTC(ano, mes - 1 + delta, 1))
    setAno(d.getUTCFullYear())
    setMes(d.getUTCMonth() + 1)
  }

  const iso = (dia: number) =>
    `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`

  if (isError) return <ErroCarregamento erro={error} />

  return (
    <div className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-divider px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">
          {MESES[mes - 1]} de {ano}
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={() => navegar(-1)} aria-label="Mês anterior"
                  className="rounded p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button onClick={() => navegar(1)} aria-label="Próximo mês"
                  className="rounded p-1.5 text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-gold-border">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <Carregando label="Carregando agenda…" />
      ) : (
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase tracking-wide text-text-muted">
            {DIAS_SEMANA.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: deslocamento }).map((_, i) => (
              <div key={`vazio-${i}`} />
            ))}
            {Array.from({ length: diasNoMes }, (_, i) => i + 1).map((dia) => {
              const chave = iso(dia)
              const info = porDia.get(chave)
              const ehHoje = chave === hojeIso

              return (
                <div
                  key={dia}
                  className={`min-h-[4.5rem] rounded border p-1.5 text-left ${
                    ehHoje ? 'border-gold bg-gold-soft' : 'border-border-subtle bg-card-alt'
                  }`}
                >
                  <div className={`font-mono text-xs ${ehHoje ? 'text-gold' : 'text-text-muted'}`}>
                    {dia}
                  </div>
                  {info && (
                    <div className="mt-1 space-y-0.5">
                      <div className="rounded bg-surface px-1 py-0.5 text-[11px] text-text-primary">
                        {info.total} {info.total === 1 ? 'vence' : 'vencem'}
                      </div>
                      {info.atrasadas > 0 && (
                        <div className="rounded bg-error-soft px-1 py-0.5 text-[11px] text-error">
                          {info.atrasadas} em atraso
                        </div>
                      )}
                      {info.entregues > 0 && (
                        <div className="rounded bg-success-soft px-1 py-0.5 text-[11px] text-success">
                          {info.entregues} entregue{info.entregues > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
