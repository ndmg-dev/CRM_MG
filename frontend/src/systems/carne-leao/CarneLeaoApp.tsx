import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { carneLeaoApi, type CarneLeaoDocument, type CarneLeaoMonth, type CarneLeaoStats } from './api/client'
import './styles/carne-leao.css'

// Porte nativo do Carnê-Leão (Flask + vanilla JS, ver PROJETO-CARNE-LEAO —
// branch feat/google-drive-integration) para dentro do CRM. O app original
// não tem rotas de verdade (é uma tela única com abas/filtros via JS puro),
// então não usa useNativeSystemBase — só um componente com estado local
// equivalente ao que static/app.js fazia via DOM direto.

type StatusFilter = 'all' | 'ok' | 'review' | 'error' | 'pending'

type Toast = { id: number; message: string; type: 'success' | 'error' | 'info' }

type ProcessEvent = {
  type: 'start' | 'processing' | 'processed' | 'skipped' | 'error' | 'done'
  total?: number
  current?: number
  file?: string
  month?: string
  message?: string
  document?: CarneLeaoDocument
}

let toastSeq = 0

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function truncate(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text
}

function statusBadge(status: CarneLeaoDocument['status']) {
  switch (status) {
    case 'ok':
      return <span className="badge badge-ok">✅ Extraído</span>
    case 'review':
      return <span className="badge badge-review">⚠️ Revisão</span>
    case 'error':
      return <span className="badge badge-error">❌ Falha</span>
    case 'pending':
      return <span className="badge badge-pending">⏳ Pendente</span>
    default:
      return <span className="badge">{status}</span>
  }
}

function confidenceBadge(conf: CarneLeaoDocument['confidence']) {
  switch (conf) {
    case 'alta':
      return <span className="badge badge-conf-alta">Alta</span>
    case 'media':
      return <span className="badge badge-conf-media">Média</span>
    case 'baixa':
      return <span className="badge badge-conf-baixa">Baixa</span>
    default:
      return <span className="badge">—</span>
  }
}

export default function CarneLeaoApp() {
  const [months, setMonths] = useState<CarneLeaoMonth[]>([])
  const [documents, setDocuments] = useState<CarneLeaoDocument[]>([])
  const [stats, setStats] = useState<CarneLeaoStats | null>(null)

  const [currentMonth, setCurrentMonth] = useState('all')
  const [currentStatus, setCurrentStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('carne_leao_openai_api_key') || '')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, text: 'Preparando…', file: '' })
  const [log, setLog] = useState<{ text: string; className: string }[]>([])
  const abortRef = useRef<(() => void) | null>(null)

  const [selectedDoc, setSelectedDoc] = useState<CarneLeaoDocument | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editValue, setEditValue] = useState('')

  const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const pushToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const loadScan = useCallback(async () => {
    try {
      const data = await carneLeaoApi.scan()
      setMonths(data.months)
    } catch (e) {
      pushToast('Erro ao escanear pastas: ' + (e as Error).message, 'error')
    }
  }, [pushToast])

  const loadDocuments = useCallback(async () => {
    try {
      const data = await carneLeaoApi.getDocuments()
      setDocuments(data.documents || [])
    } catch {
      // banco pode estar vazio na primeira execução
    }
  }, [])

  const loadStats = useCallback(async () => {
    try {
      const data = await carneLeaoApi.getStats()
      setStats(data)
    } catch {
      // ignora
    }
  }, [])

  useEffect(() => {
    loadScan()
    loadDocuments()
    loadStats()
  }, [loadScan, loadDocuments, loadStats])

  useEffect(() => {
    localStorage.setItem('carne_leao_openai_api_key', apiKey)
  }, [apiKey])

  const startProcessing = () => {
    const key = apiKey.trim()
    if (!key) {
      pushToast('Cole sua chave de API da OpenAI acima antes de processar.', 'error')
      return
    }

    setProcessing(true)
    setLog([])
    setProgress({ current: 0, total: 0, text: 'Conectando…', file: '' })

    const abort = carneLeaoApi.process(
      key,
      (msg: ProcessEvent) => {
        switch (msg.type) {
          case 'start':
            setProgress((p) => ({ ...p, total: msg.total || 0, text: `Processando ${msg.total} documentos…` }))
            setLog((l) => [...l, { text: `Iniciando processamento de ${msg.total} arquivos…`, className: '' }])
            break
          case 'processing':
            setProgress({ current: msg.current || 0, total: msg.total || 0, text: `${msg.current} de ${msg.total}`, file: `${msg.month} → ${msg.file}` })
            break
          case 'processed': {
            setProgress((p) => ({ ...p, current: msg.current || p.current, total: msg.total || p.total, text: `${msg.current} de ${msg.total}` }))
            const doc = msg.document!
            const cls = doc.status === 'ok' ? 'log-ok' : doc.status === 'review' ? 'log-review' : 'log-error'
            const icon = doc.status === 'ok' ? '✅' : doc.status === 'review' ? '⚠️' : '❌'
            setLog((l) => [...l, { text: `${icon} ${doc.filename}`, className: cls }])
            break
          }
          case 'skipped':
            setProgress((p) => ({ ...p, current: msg.current || p.current, total: msg.total || p.total }))
            setLog((l) => [...l, { text: `⏭️ ${msg.file} (já processado)`, className: 'log-skip' }])
            break
          case 'error':
            pushToast(msg.message || 'Erro no processamento', 'error')
            setLog((l) => [...l, { text: `❌ ERRO: ${msg.message}`, className: 'log-error' }])
            break
          case 'done':
            setProgress((p) => ({ ...p, current: p.total, text: '✅ Concluído!', file: '' }))
            setLog((l) => [...l, { text: `\n✅ Processamento finalizado! ${msg.total} documentos.`, className: 'log-ok' }])
            break
        }
      },
      () => {
        setTimeout(() => {
          setProcessing(false)
          loadDocuments()
          loadStats()
          pushToast('Processamento concluído com sucesso!', 'success')
        }, 1500)
      },
      () => {
        setProcessing(false)
        loadDocuments()
        loadStats()
      }
    )
    abortRef.current = abort
  }

  useEffect(() => () => abortRef.current?.(), [])

  const exportExcel = async () => {
    try {
      pushToast('Gerando planilha...', 'info')
      const blob = await carneLeaoApi.exportExcel(documents)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'despesas_carne_leao_2024.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      pushToast('📊 Excel exportado com sucesso!', 'success')
    } catch (e) {
      pushToast('Erro ao exportar: ' + (e as Error).message, 'error')
    }
  }

  const openDrillDown = async (doc: CarneLeaoDocument) => {
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(null)
      setPreviewSrc(null)
      return
    }
    setSelectedDoc(doc)
    setEditDate(doc.date || '')
    setEditValue(doc.value != null ? String(doc.value) : '')
    setPreviewSrc(null)
    try {
      const src = await carneLeaoApi.fetchPreview(doc.id)
      setPreviewSrc(src)
    } catch {
      // preview indisponível
    }
  }

  const saveDrillDownEdit = async () => {
    if (!selectedDoc) return
    const date = editDate.trim()
    const value = editValue.trim()
    try {
      const data = await carneLeaoApi.updateDocument(selectedDoc.id, date || null, value || null)
      setDocuments((docs) => docs.map((d) => (d.id === selectedDoc.id ? data.document : d)))
      pushToast('💾 Alterações salvas!', 'success')
    } catch {
      // fallback local, igual ao app original (Vercel read-only db etc.)
      let parsedValue: number | null = null
      if (value) parsedValue = parseFloat(value.replace(/\./g, '').replace(',', '.'))
      setDocuments((docs) =>
        docs.map((d) => (d.id === selectedDoc.id ? { ...d, date: date || null, value: parsedValue, status: 'ok', manually_edited: 1 } : d))
      )
      pushToast('Erro ao salvar no servidor, mas aplicado na tela. Exporte para Excel antes de fechar!', 'info')
    }
    setSelectedDoc(null)
    setPreviewSrc(null)
    loadStats()
  }

  const monthDot = (monthNum: string) => {
    const docs = documents.filter((d) => d.month_num === monthNum)
    if (docs.length === 0) return 'dot-none'
    if (docs.every((d) => d.status === 'ok')) return 'dot-ok'
    if (docs.some((d) => d.status === 'error')) return 'dot-error'
    if (docs.some((d) => d.status === 'review')) return 'dot-review'
    if (docs.some((d) => d.status === 'pending')) return 'dot-pending'
    return 'dot-ok'
  }

  let filtered = documents
  if (currentMonth !== 'all') filtered = filtered.filter((d) => d.month_num === currentMonth)
  if (currentStatus !== 'all') filtered = filtered.filter((d) => d.status === currentStatus)
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter((d) => (d.filename || '').toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q))
  }

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="carne-leao-root">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🦁</span>
            <div>
              <h1>
                Carnê-Leão <span className="accent">2024</span>
              </h1>
              <p className="subtitle">Consolidação Inteligente de Despesas</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="api-key-group">
            <label htmlFor="apiKey">🔑 OpenAI API Key</label>
            <input
              type="password"
              id="apiKey"
              placeholder="Cole sua chave aqui…"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" title="Processar documentos com IA" onClick={startProcessing} disabled={processing}>
            <span className="btn-icon">⚡</span> Processar
          </button>
          <button className="btn btn-accent" title="Exportar planilha Excel" onClick={exportExcel}>
            <span className="btn-icon">📥</span> Exportar Excel
          </button>
        </div>
      </header>

      <div className="stats-bar">
        <div className="stat-card">
          <span className="stat-value">{stats?.total ?? '—'}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card card-ok">
          <span className="stat-value">{stats?.ok ?? '—'}</span>
          <span className="stat-label">Extraídos</span>
        </div>
        <div className="stat-card card-review">
          <span className="stat-value">{stats?.review ?? '—'}</span>
          <span className="stat-label">Revisão</span>
        </div>
        <div className="stat-card card-error">
          <span className="stat-value">{stats?.error ?? '—'}</span>
          <span className="stat-label">Falha</span>
        </div>
        <div className="stat-card card-pending">
          <span className="stat-value">{stats?.pending ?? '—'}</span>
          <span className="stat-label">Pendentes</span>
        </div>
      </div>

      <main className="main-layout">
        <aside className="sidebar">
          <h3 className="sidebar-title">📅 Meses</h3>
          <button className={`month-card${currentMonth === 'all' ? ' active' : ''}`} onClick={() => setCurrentMonth('all')}>
            <span className="month-dot dot-all"></span>
            <span className="month-name">Todos</span>
            <span className="month-count">{stats?.total ?? '—'}</span>
          </button>
          {months.map((m) => (
            <button
              key={m.month_num}
              className={`month-card${currentMonth === m.month_num ? ' active' : ''}`}
              onClick={() => setCurrentMonth(m.month_num)}
            >
              <span className={`month-dot ${monthDot(m.month_num)}`}></span>
              <span className="month-name">{m.name.replace(/^\d+\s*-\s*/, '')}</span>
              <span className="month-count">{m.total_files}</span>
            </button>
          ))}
        </aside>

        <section className="content">
          <div className="toolbar">
            <div className="toolbar-left">
              <select className="select-filter" value={currentStatus} onChange={(e) => setCurrentStatus(e.target.value as StatusFilter)}>
                <option value="all">Todos os Status</option>
                <option value="ok">✅ Extraídos</option>
                <option value="review">⚠️ Revisão</option>
                <option value="error">❌ Falha</option>
                <option value="pending">⏳ Pendentes</option>
              </select>
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Buscar arquivo…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <span className="result-count">{filtered.length} documento(s)</span>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <h3>Nenhum documento processado</h3>
              <p>
                Cole sua <strong>chave de API da OpenAI</strong> acima e clique em <strong>&quot;Processar&quot;</strong> para iniciar a extração
                inteligente dos documentos.
              </p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Arquivo</th>
                    <th>Data Pagamento</th>
                    <th>Valor (R$)</th>
                    <th>Confiança</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc) => (
                    <Fragment key={doc.id}>
                      <tr className={`row-${doc.status}`} onClick={() => openDrillDown(doc)}>
                        <td>
                          <span className="text-muted">{(doc.month || '').replace(/^\d+\s*-\s*/, '')}</span>
                        </td>
                        <td title={doc.filename}>{truncate(doc.description || doc.filename, 35)}</td>
                        <td>{doc.date || '—'}</td>
                        <td className="td-value">{formatCurrency(doc.value)}</td>
                        <td>{confidenceBadge(doc.confidence)}</td>
                        <td>{statusBadge(doc.status)}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              openDrillDown(doc)
                            }}
                          >
                            👁️ Ver
                          </button>
                        </td>
                      </tr>
                      {selectedDoc?.id === doc.id && (
                        <tr className="drill-down-row">
                          <td colSpan={7}>
                            <div className="drill-down-container">
                              <div className="preview-image-wrapper">
                                {previewSrc ? (
                                  <img className="previewImg" src={previewSrc} alt="Preview do documento" onClick={() => setFullscreenSrc(previewSrc)} />
                                ) : (
                                  <div className="preview-loading">Carregando preview…</div>
                                )}
                              </div>
                              <div className="preview-form">
                                <div className="form-header">
                                  <h3>{doc.filename || 'Documento'}</h3>
                                  <button
                                    className="btn-icon-close"
                                    title="Fechar"
                                    onClick={() => {
                                      setSelectedDoc(null)
                                      setPreviewSrc(null)
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div className="form-grid">
                                  <div className="form-field">
                                    <label>📅 Data Pagamento</label>
                                    <input type="text" placeholder="DD/MM/YYYY" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                                  </div>
                                  <div className="form-field">
                                    <label>💰 Valor Despesa</label>
                                    <input type="text" placeholder="0.00" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                                  </div>
                                  <div className="form-field full-width">
                                    <label>📝 Descrição</label>
                                    <input type="text" disabled value={doc.description || ''} />
                                  </div>
                                  <div className="form-field">
                                    <label>📋 Tipo Doc.</label>
                                    <span className="field-readonly">{doc.observation || '—'}</span>
                                  </div>
                                  <div className="form-field">
                                    <label>🎯 Confiança</label>
                                    <span className="field-readonly">{confidenceBadge(doc.confidence)}</span>
                                  </div>
                                </div>
                                <button className="btn btn-primary btn-full" onClick={saveDrillDownEdit}>
                                  💾 Salvar Alterações
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {processing && (
        <>
          <div className="modal open">
            <div className="modal-content">
              <div className="modal-header">
                <h2>⚡ Processando com OpenAI</h2>
              </div>
              <div className="progress-container">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
                </div>
                <div className="progress-info">
                  <span>{progress.text}</span>
                  <span>{progressPct}%</span>
                </div>
              </div>
              <p className="progress-file">{progress.file}</p>
              <div className="progress-log">
                {log.map((l, i) => (
                  <div key={i} className={l.className}>
                    {l.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="overlay open"></div>
        </>
      )}

      {fullscreenSrc && (
        <div className="fullscreen-modal open" onClick={() => setFullscreenSrc(null)}>
          <button className="btn-icon-close btn-close-fullscreen" title="Fechar" onClick={() => setFullscreenSrc(null)}>
            ✕
          </button>
          <img src={fullscreenSrc} alt="Documento em tela cheia" />
        </div>
      )}

      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
