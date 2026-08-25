import { Plus, Search } from 'react-feather'
import { contaiApi } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { ContaiLoading, ContaiError } from '../components/StatusView'

const TAG_CLASS: Record<string, string> = {
  fornecedor: 'contai-tag-green',
  banco: 'contai-tag-blue',
  texto_livre: 'contai-tag-orange',
}

export default function Regras() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const { data, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getRegras(empresaId ?? undefined),
    [empresaId],
  )

  const regras = data?.regras ?? []

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Motor de Regras</h1>
          <p>Configure regras automáticas para classificar compras, fornecedores e tarifas.</p>
        </div>
        {/*
          TODO: ContAI upload endpoints not yet stateless-JWT-clean, verify
          against ContAI_PRO before wiring in production — criação/edição/
          exclusão de regras (regras.save_regra, DELETE /regras/<id>) não
          está entre os 7 endpoints GET portados.
        */}
        <button
          type="button"
          className="contai-btn-gold"
          onClick={() => alert('Cadastro de regra ainda depende de endpoint não portado (ver TODO no código-fonte).')}
        >
          <Plus size={16} /> Nova Regra
        </button>
      </div>

      <div className="contai-card" style={{ padding: 0, overflow: 'hidden' }}>
        {empresaLoading || loading ? (
          <div style={{ padding: 24 }}>
            <ContaiLoading />
          </div>
        ) : error ? (
          <div style={{ padding: 24 }}>
            <ContaiError message={error} isAuthError={isAuthError} onRetry={reload} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="contai-table">
              <thead>
                <tr>
                  <th>Prioridade</th>
                  <th>Tipo</th>
                  <th>Padrão Textual</th>
                  <th>Conta de Destino</th>
                </tr>
              </thead>
              <tbody>
                {regras.length > 0 ? (
                  regras.map((regra) => (
                    <tr key={regra.id}>
                      <td>{regra.prioridade}</td>
                      <td>
                        <span className={`contai-tag ${TAG_CLASS[regra.tipo_regra?.toLowerCase()] || 'contai-tag-gold'}`}>
                          {regra.tipo_regra}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>&quot;{regra.padrao}&quot;</td>
                      <td>
                        {regra.plano_contas ? (
                          <>
                            <span style={{ fontFamily: 'monospace', color: 'var(--contai-gold)' }}>{regra.plano_contas.codigo}</span>{' '}
                            - {regra.plano_contas.descricao}
                          </>
                        ) : (
                          <span style={{ color: 'var(--contai-text-muted)' }}>Conta Indefinida</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--contai-text-muted)' }}>
                      <Search size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                      <p>Nenhuma regra de classificação cadastrada.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
