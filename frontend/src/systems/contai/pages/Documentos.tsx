import { useState } from 'react'
import { FileText, UploadCloud, Search, Inbox } from 'react-feather'
import { contaiApi } from '../api/client'
import { useContaiQuery } from '../hooks/useContaiQuery'
import { useEmpresa } from '../context/EmpresaContext'
import { ContaiLoading, ContaiError } from '../components/StatusView'

// Porta de app/web/templates/documentos.html.
//
// TODO: ContAI upload endpoints not yet stateless-JWT-clean, verify against
// ContAI_PRO before wiring in production. O Flask original ainda depende de
// sessão de servidor para: busca de CNPJ na Receita Federal
// (documentos.buscar_cnpj), cadastro de empresa (documentos.cadastrar_empresa)
// e upload de arquivos (documentos.upload, multipart/form-data). Nenhum dos
// 7 endpoints GET portados cobre essas ações — o formulário abaixo é o shell
// de UI e a tentativa de chamada, mas não está funcional até esses endpoints
// existirem em JSON+Bearer.
export default function Documentos() {
  const { empresaId, loading: empresaLoading } = useEmpresa()
  const { data: documentos, loading, error, isAuthError, reload } = useContaiQuery(
    () => contaiApi.getDocumentos(empresaId ?? undefined),
    [empresaId],
  )

  const [cnpj, setCnpj] = useState('')
  const [cnpjFeedback, setCnpjFeedback] = useState<string | null>(null)
  const [files, setFiles] = useState<FileList | null>(null)
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null)

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    if (digits.length > 12) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, '$1.$2.$3/$4-$5')
    if (digits.length > 8) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4})$/, '$1.$2.$3/$4')
    if (digits.length > 5) return digits.replace(/^(\d{2})(\d{3})(\d{0,3})$/, '$1.$2.$3')
    if (digits.length > 2) return digits.replace(/^(\d{2})(\d{0,3})$/, '$1.$2')
    return digits
  }

  // TODO: ContAI upload endpoints not yet stateless-JWT-clean — não há hoje
  // um GET /api/... equivalente à busca de CNPJ; esta função apenas ilustra
  // onde a chamada entraria e falha de forma explícita.
  async function buscarCnpj() {
    setCnpjFeedback('Busca de CNPJ ainda depende de endpoint com sessão de servidor (não portado). Ver TODO no código-fonte.')
  }

  // TODO: ContAI upload endpoints not yet stateless-JWT-clean — idem acima
  // para o envio de arquivos (multipart, endpoint POST /documentos/upload
  // no Flask original, com dependência de sessão de servidor).
  async function enviarArquivos(e: React.FormEvent) {
    e.preventDefault()
    if (!files || files.length === 0) return
    setUploadFeedback('Upload de documentos ainda depende de endpoint com sessão de servidor (não portado). Ver TODO no código-fonte.')
  }

  return (
    <div>
      <div className="contai-header">
        <div>
          <h1>Documentos</h1>
          <p>Cadastre a empresa via CNPJ e importe os extratos e planilhas para conciliação.</p>
        </div>
      </div>

      <div className="contai-card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--contai-text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={15} /> Cadastrar Empresa
        </h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }} className="contai-field">
            <label>CNPJ da Empresa</label>
            <input
              type="text"
              placeholder="00.000.000/0001-00"
              maxLength={18}
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && buscarCnpj()}
            />
          </div>
          <button type="button" className="contai-btn-gold" onClick={buscarCnpj}>
            <Search size={15} /> Buscar na Receita Federal
          </button>
        </div>
        {cnpjFeedback && (
          <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, fontSize: '0.85rem', background: 'rgba(224,82,82,0.1)', color: 'var(--contai-red)', border: '1px solid rgba(224,82,82,0.3)' }}>
            {cnpjFeedback}
          </div>
        )}
      </div>

      <div className="contai-card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--contai-text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UploadCloud size={15} /> Importar Documentos
        </h3>
        {!empresaId && !empresaLoading ? (
          <div style={{ padding: 20, background: 'rgba(212,172,107,0.07)', border: '1px solid rgba(212,172,107,0.25)', borderRadius: 10, color: 'var(--contai-gold)', fontSize: '0.88rem' }}>
            Cadastre ou selecione uma empresa acima antes de importar documentos.
          </div>
        ) : (
          <form onSubmit={enviarArquivos}>
            <label htmlFor="contai-file-input" className="contai-upload-drop" style={{ display: 'block', cursor: 'pointer', marginBottom: 16 }}>
              <UploadCloud size={36} style={{ margin: '0 auto 10px', display: 'block', color: 'var(--contai-gold)', opacity: 0.8 }} />
              <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--contai-text)' }}>Clique para selecionar arquivos</p>
              <p>PDF · Excel (.xlsx) · XML · OFX — múltiplos arquivos permitidos</p>
              {files && files.length > 0 && (
                <div style={{ marginTop: 14, background: 'rgba(172,141,90,0.15)', border: '1px solid var(--contai-gold)', color: 'var(--contai-gold)', padding: '6px 14px', borderRadius: 20, fontSize: '0.83rem', fontWeight: 600, display: 'inline-block' }}>
                  {files.length} arquivo(s) selecionado(s)
                </div>
              )}
            </label>
            <input
              id="contai-file-input"
              type="file"
              accept=".pdf,.xlsx,.xls,.xml,.ofx,.csv"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => setFiles(e.target.files)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="contai-btn-gold" disabled={!files || files.length === 0}>
                Enviar
              </button>
            </div>
          </form>
        )}
        {uploadFeedback && (
          <div style={{ marginTop: 12, padding: '10px 16px', borderRadius: 8, fontSize: '0.85rem', background: 'rgba(224,82,82,0.1)', color: 'var(--contai-red)', border: '1px solid rgba(224,82,82,0.3)' }}>
            {uploadFeedback}
          </div>
        )}
      </div>

      <div className="contai-card">
        <h3 style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--contai-text-muted)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={15} /> Documentos Importados
        </h3>

        {empresaLoading || loading ? (
          <ContaiLoading />
        ) : error ? (
          <ContaiError message={error} isAuthError={isAuthError} onRetry={reload} />
        ) : documentos && documentos.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="contai-table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {documentos.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.nome_original}</td>
                    <td><span className="contai-tag contai-tag-gold">{doc.tipo?.toUpperCase()}</span></td>
                    <td style={{ color: 'var(--contai-text-muted)' }}>{doc.status}</td>
                    <td style={{ color: 'var(--contai-text-muted)' }}>{doc.created_at ? doc.created_at.slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="contai-empty">
            <Inbox size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <p>Nenhum documento importado ainda.</p>
          </div>
        )}
      </div>
    </div>
  )
}
