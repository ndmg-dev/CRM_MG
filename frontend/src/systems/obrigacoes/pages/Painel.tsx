import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Users } from 'lucide-react'
import {
  useCargaResponsavel, usePainelResumo, useProximosVencimentos,
} from '../hooks/useObrigacoes'
import { Carregando, ChipStatus, ErroCarregamento, Indicador, Secao, TrilhoPrazo, Vazio } from '../components/Comuns'
import { ROTULO_DEPARTAMENTO, formatarCompetencia, formatarData } from '../lib/formato'

/**
 * Todos os números desta tela vêm agregados do banco (RPCs `painel_*`).
 * Nada é contado no frontend: a tabela de entregas cresce por competência e
 * baixá-la inteira para contar seria caro e traria dado pessoal sem uso.
 */
export function Painel({ competencia }: { competencia: string }) {
  const resumo = usePainelResumo(competencia)
  const carga = useCargaResponsavel(competencia)
  const proximos = useProximosVencimentos(8)

  if (resumo.isError) return <ErroCarregamento erro={resumo.error} />

  return (
    <div className="space-y-6">
      {resumo.isLoading || !resumo.data ? (
        <Carregando label="Carregando indicadores…" />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Indicador icone={CalendarClock} valor={resumo.data.total}
                     rotulo={`Entregas em ${formatarCompetencia(competencia)}`} />
          <Indicador icone={CheckCircle2} valor={resumo.data.entregues}
                     rotulo="Concluídas" tom="text-success" />
          <Indicador icone={Clock} valor={resumo.data.vencendo_3_dias}
                     rotulo="Vencem em até 3 dias" tom="text-warning" />
          <Indicador icone={AlertTriangle} valor={resumo.data.atrasadas}
                     rotulo="Em atraso" tom="text-error" />
          <Indicador icone={Users} valor={resumo.data.aguardando_cliente}
                     rotulo="Aguardando cliente" tom="text-info" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Secao titulo="Próximos vencimentos">
            {proximos.isLoading ? (
              <Carregando />
            ) : proximos.isError ? (
              <ErroCarregamento erro={proximos.error} />
            ) : proximos.data?.length ? (
              <ul className="divide-y divide-divider">
                {proximos.data.map((p) => (
                  <li key={p.entrega_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-text-primary">{p.empresa}</div>
                      <div className="truncate text-xs text-text-muted">
                        {p.obrigacao} · {ROTULO_DEPARTAMENTO[p.departamento]} ·{' '}
                        competência {formatarCompetencia(p.competencia)}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono text-sm text-text-primary">
                          {formatarData(p.vencimento)}
                        </div>
                        <TrilhoPrazo prazo={p.vencimento} status={p.status} />
                      </div>
                      <ChipStatus status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhuma entrega em aberto.</Vazio>
            )}
          </Secao>
        </div>

        <Secao titulo="Carga por responsável">
          {carga.isLoading ? (
            <Carregando />
          ) : carga.isError ? (
            <ErroCarregamento erro={carga.error} />
          ) : carga.data?.length ? (
            <ul className="divide-y divide-divider">
              {carga.data.map((c) => (
                <li key={c.responsavel_id ?? 'sem'} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-primary">{c.responsavel}</span>
                    <span className="font-mono text-sm text-text-secondary">{c.total}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    <span>{c.pendentes} em aberto</span>
                    {c.atrasadas > 0 && <span className="text-error">{c.atrasadas} em atraso</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Vazio>Sem entregas nesta competência.</Vazio>
          )}
        </Secao>
      </div>
    </div>
  )
}
