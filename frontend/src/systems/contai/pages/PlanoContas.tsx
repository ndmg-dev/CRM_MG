import { Upload, Plus, Folder } from 'react-feather'
import { contaiApi } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { ContaiLoading, ContaiError } from '../components/StatusView'

const TAG_CLASS: Record<string, string> = {
  debito: 'contai-tag-red',
  credito: 'contai-tag-green',
  ativo: 'contai-tag-green',
  passivo: 'contai-tag-orange',
  receita: 'contai-tag-green',
  despesa: 'contai-tag-red',
}

export default function PlanoContas() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const { data: contas, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getPlanoContas(empresaId ?? undefined),
    [empresaId],
  )

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Plano de Contas</h1>
          <p>Gerencie a estrutura contábil da empresa</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/*
            TODO: ContAI upload endpoints not yet stateless-JWT-clean, verify
            against ContAI_PRO before wiring in production — a importação de
            PDF do plano de contas (plano_contas.importar_plano, streaming
            SSE) e a criação/edição de contas (plano_contas.save_conta) não
            estão entre os 7 endpoints GET portados. Botões abaixo ilustram o
            shell de UI sem chamar um endpoint real ainda.
          */}
          <button
            type="button"
            className="contai-btn-outline"
            onClick={() => alert('Importação de PDF ainda depende de endpoint não portado (ver TODO no código-fonte).')}
          >
            <Upload size={16} /> Importar PDF
          </button>
          <button
            type="button"
            className="contai-btn-gold"
            onClick={() => alert('Cadastro de conta ainda depende de endpoint não portado (ver TODO no código-fonte).')}
          >
            <Plus size={16} /> Nova Conta
          </button>
        </div>
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
                  <th>Código</th>
                  <th>Nome da Conta</th>
                  <th>Tipo</th>
                  <th>Natureza</th>
                </tr>
              </thead>
              <tbody>
                {contas && contas.length > 0 ? (
                  contas.map((conta) => (
                    <tr key={conta.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--contai-gold)' }}>{conta.codigo_estrutural}</td>
                      <td>{conta.descricao}</td>
                      <td>
                        {conta.tipo ? (
                          <span className={`contai-tag ${TAG_CLASS[conta.tipo.toLowerCase()] || 'contai-tag-gold'}`}>{conta.tipo}</span>
                        ) : '-'}
                      </td>
                      <td>
                        {conta.natureza ? (
                          <span className={`contai-tag ${TAG_CLASS[conta.natureza.toLowerCase()] || 'contai-tag-gold'}`}>{conta.natureza}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--contai-text-muted)' }}>
                      <Folder size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                      <p>O plano de contas desta empresa ainda está vazio.</p>
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
