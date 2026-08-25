import { contaiApi } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { ContaiLoading, ContaiError } from '../components/StatusView'

export default function Configuracoes() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const { data, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getConfiguracoes(empresaId ?? undefined),
    [empresaId],
  )

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Configurações</h1>
          <p>Sessão atual e informações do sistema</p>
        </div>
      </div>

      {empresaLoading || loading ? (
        <ContaiLoading />
      ) : error ? (
        <ContaiError message={error} isAuthError={isAuthError} onRetry={reload} />
      ) : (
        <div className="contai-card" style={{ maxWidth: 480 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 20, color: 'var(--contai-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Usuário Logado
          </h3>
          {data?.user ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
                {data.user.avatar ? (
                  <img
                    src={data.user.avatar}
                    alt={data.user.name}
                    style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--contai-gold)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--contai-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      color: 'var(--contai-gold)',
                    }}
                  >
                    {data.user.name ? data.user.name[0].toUpperCase() : '?'}
                  </div>
                )}
                <div>
                  <p style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>{data.user.name}</p>
                  <p style={{ color: 'var(--contai-text-muted)', fontSize: '0.85rem', margin: 0 }}>{data.user.email}</p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--contai-border)', paddingTop: 20 }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--contai-text-muted)' }}>
                  Domínio: <span style={{ color: 'var(--contai-gold)' }}>@mendoncagalvao.com.br</span>
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--contai-text-muted)', marginTop: 8 }}>
                  A sessão deste sistema é a mesma do CRM — para encerrá-la, saia do CRM.
                </p>
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--contai-text-muted)', fontSize: '0.88rem' }}>Nenhuma informação de usuário disponível.</p>
          )}
        </div>
      )}
    </div>
  )
}
