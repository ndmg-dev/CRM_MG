import { useEffect, useState } from 'react'
import { notificationsApi } from '../../lib/api'
import { Mail, PlayCircle } from 'lucide-react'

interface AutomationPanelProps {
  onToast?: (t: { type: 'success' | 'error'; msg: string }) => void
}

export default function AutomationPanel({ onToast }: AutomationPanelProps) {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<any>(null)

  useEffect(() => {
    notificationsApi
      .getStatus()
      .then(({ data }) => setStatus(data))
      .catch((err) => onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao ler status' }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const executar = async (dryRun: boolean) => {
    setRunning(true)
    setPreview(null)
    try {
      const { data } = await notificationsApi.run(dryRun)
      setPreview(data)
      onToast?.({
        type: 'success',
        msg: dryRun
          ? `Simulação: ${data.avisos?.length || 0} aviso(s) seriam enviados`
          : `${data.enviados || 0} e-mail(s) enviado(s)`,
      })
    } catch (err: any) {
      onToast?.({ type: 'error', msg: err?.response?.data?.error || 'Falha ao executar a varredura' })
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="skeleton" style={{ height: 300, width: '100%' }} />
  if (!status) return null

  const linhas: [string, string, boolean][] = [
    ['Notificações', status.notificacoes_ativas ? 'Ativas' : 'Desativadas', status.notificacoes_ativas],
    ['Agendador', status.scheduler_ativo ? `Diário às ${status.horario} (${status.timezone})` : 'Desativado', status.scheduler_ativo],
    ['Brevo', status.email_configurado ? `Conectado — envia como ${status.remetente}` : 'Chave de API ausente', status.email_configurado],
    ['Antecedência', `${status.dias_de_antecedencia?.join(', ')} dia(s) antes do prazo`, true],
    ['Atrasados', status.avisa_atrasados ? 'Avisa quando o prazo estoura' : 'Não avisa', status.avisa_atrasados],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={18} style={{ color: 'var(--color-accent-gold)' }} />
          Avisos de prazo por e-mail
        </h3>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {linhas.map(([rotulo, valor, ok]) => (
              <tr key={rotulo} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', width: 160 }}>{rotulo}</td>
                <td style={{ padding: '10px 0', color: ok ? 'var(--color-text-primary)' : 'var(--color-warning)' }}>
                  {valor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!status.email_configurado && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 12,
              background: 'var(--color-warning-soft)',
              color: 'var(--color-warning)',
            }}
          >
            Defina BREVO_API_KEY no ambiente do backend para habilitar o envio.
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button className="btn-secondary" onClick={() => executar(true)} disabled={running}>
            Simular (não envia)
          </button>
          <button className="btn-primary" onClick={() => executar(false)} disabled={running || !status.email_configurado}>
            <PlayCircle size={16} />
            {running ? 'Executando...' : 'Executar agora'}
          </button>
        </div>
      </div>

      {preview && (
        <div className="glass" style={{ padding: 24, borderRadius: 'var(--radius-lg)' }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            Resultado — {preview.tickets_analisados} ticket(s) na janela de prazo
            {preview.dry_run ? ' (simulação)' : ''}
          </h4>
          {preview.avisos?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preview.avisos.map((a: any, i: number) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    padding: '8px 12px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 6,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ color: 'var(--color-text-primary)' }}>{a.ticket}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    {a.para} · {a.dias_restantes < 0 ? 'atrasado' : `${a.dias_restantes}d`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Nenhum aviso pendente no momento.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
