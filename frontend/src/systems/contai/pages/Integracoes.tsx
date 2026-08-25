import { Layers, Download } from 'react-feather'
import { contaiApi } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { ContaiLoading, ContaiError } from '../components/StatusView'

export default function Integracoes() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const { data, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getIntegracoes(empresaId ?? undefined),
    [empresaId],
  )

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Integrações</h1>
          <p>Conecte o ContAI com seus sistemas contábeis.</p>
        </div>
      </div>

      {empresaLoading || loading ? (
        <ContaiLoading />
      ) : error ? (
        <ContaiError message={error} isAuthError={isAuthError} onRetry={reload} />
      ) : (
        <>
          {data?.empresa && 'id' in data.empresa && (
            <p style={{ color: 'var(--contai-text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              Empresa ativa: <strong style={{ color: 'var(--contai-gold)' }}>{data.empresa.nome}</strong>
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
            <div className="contai-card" style={{ display: 'flex', flexDirection: 'column', gap: 20, borderTop: '4px solid var(--contai-orange)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ background: 'rgba(246,139,31,0.1)', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={24} color="var(--contai-orange)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Domínio Sistemas</h3>
                  <span className="contai-tag contai-tag-green" style={{ marginTop: 4, display: 'inline-block' }}>EM BREVE (API)</span>
                </div>
              </div>
              <p style={{ color: 'var(--contai-text-muted)', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                A integração direta via API Onvio está em manutenção. Utilize o fluxo de exportação de arquivos na aba de
                Conciliação para importar dados no Domínio.
              </p>
              <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid var(--contai-border)' }}>
                <button disabled style={{ width: '100%', padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'var(--contai-text-muted)', cursor: 'not-allowed', border: '1px solid var(--contai-border)' }}>
                  Integração via API Indisponível
                </button>
              </div>
            </div>

            <div className="contai-card" style={{ opacity: 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.05)', width: 48, height: 48, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download size={24} color="#777" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>SIEG</h3>
                  <span className="contai-tag" style={{ background: 'rgba(255,255,255,0.05)', color: '#777', marginTop: 4, display: 'inline-block' }}>
                    EM DESENVOLVIMENTO
                  </span>
                </div>
              </div>
              <p style={{ color: '#666', fontSize: '0.88rem' }}>
                Sincronização automática de XMLs de Notas Fiscais diretamente da SEFAZ e prefeituras.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
