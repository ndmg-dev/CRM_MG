import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Edit, Building2, Phone, FileText, CalendarDays, Download, Bell, FileIcon, MessageSquare, Link2, ChevronDown, ChevronUp, Folder, Sparkles, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { formatCNPJ, formatDate } from '@/lib/utils'
import { REGIME_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'
import type { Documento } from '@/types'

function DocumentGroup({ clienteId, competencia, documentos, onNotify }: { clienteId: string; competencia: string; documentos: Documento[], onNotify: (faltantes: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ validados: string[], faltantes: string[] } | null>(null)
  const [showModal, setShowModal] = useState(false)

  const handleValidate = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent accordion toggle
    setIsValidating(true)
    setShowModal(true)
    try {
      const result = await api.clientes.validateCompetencia(clienteId, competencia)
      setValidationResult(result)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao validar documentos com IA')
      setShowModal(false)
    } finally {
      setIsValidating(false)
    }
  }

  const handleCobrar = () => {
    setShowModal(false)
    if (validationResult?.faltantes) {
      onNotify(validationResult.faltantes)
    }
  }

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between bg-[#222222] px-6 py-4 transition-colors hover:bg-[#2a2a2a]"
      >
        <div className="flex items-center gap-3">
          <Folder className="h-5 w-5 text-[#d4a843]" />
          <span className="font-medium text-[#f5f5f5]">
            {competencia}
          </span>
          <span className="rounded-full bg-[#111111] px-2.5 py-0.5 text-xs font-medium text-[#a0a0a0]">
            {documentos.length} arquivo{documentos.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {competencia !== 'Sem Competência' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleValidate}
              className="h-8 border-[#d4a843]/30 bg-[#d4a843]/10 text-[#d4a843] hover:bg-[#d4a843]/20 hover:text-[#e5bc55]"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Validar com IA
            </Button>
          )}
          {isOpen ? <ChevronUp className="h-5 w-5 text-[#6b6b6b]" /> : <ChevronDown className="h-5 w-5 text-[#6b6b6b]" />}
        </div>
      </div>

      {isOpen && (
        <table className="w-full text-left text-sm text-[#a0a0a0]">
          <thead className="border-b border-[#2a2a2a] bg-[#1a1a1a] text-xs uppercase">
            <tr>
              <th className="px-6 py-3 font-medium">Nome do Arquivo</th>
              <th className="px-6 py-3 font-medium">Tamanho</th>
              <th className="px-6 py-3 font-medium">Data de Envio</th>
              <th className="px-6 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2a]">
            {documentos.map((doc) => (
              <tr key={doc.id} className="hover:bg-[#252525]">
                <td className="px-6 py-4 font-medium text-[#f5f5f5] flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#6b6b6b]" />
                  {doc.nomeArquivo}
                </td>
                <td className="px-6 py-4">{(doc.tamanhoBytes / 1024).toFixed(1)} KB</td>
                <td className="px-6 py-4">{formatDate(doc.dataEnvio)}</td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => api.documentos.download(doc.id, doc.nomeArquivo)} 
                    className="inline-flex items-center text-[#d4a843] hover:text-[#e5bc55]"
                  >
                    <Download className="mr-1 h-4 w-4" /> Baixar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Validation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-[#2a2a2a] px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-medium text-[#f5f5f5]">
                <Sparkles className="h-5 w-5 text-[#d4a843]" />
                Validação Inteligente - {competencia}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#a0a0a0] hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              {isValidating ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4a843] border-t-transparent mb-4"></div>
                  <p className="text-[#a0a0a0]">A IA está analisando os arquivos...</p>
                </div>
              ) : validationResult ? (
                <div className="space-y-6">
                  {validationResult.faltantes.length === 0 && validationResult.validados.length > 0 ? (
                    <div className="rounded-lg bg-green-500/10 p-4 border border-green-500/20 text-center">
                      <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2" />
                      <p className="text-green-500 font-medium">Todos os documentos exigidos foram encontrados!</p>
                    </div>
                  ) : null}

                  {validationResult.validados.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-[#f5f5f5] mb-3">
                        <CheckCircle className="h-4 w-4 text-green-500" /> Itens Encontrados
                      </h4>
                      <ul className="space-y-2">
                        {validationResult.validados.map((item, idx) => (
                          <li key={idx} className="text-sm text-[#a0a0a0] flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.faltantes.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-[#f5f5f5] mb-3">
                        <AlertCircle className="h-4 w-4 text-red-500" /> Itens Faltantes
                      </h4>
                      <ul className="space-y-2">
                        {validationResult.faltantes.map((item, idx) => (
                          <li key={idx} className="text-sm text-red-400 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            
            <div className="flex items-center justify-end gap-3 border-t border-[#2a2a2a] bg-[#111111] px-6 py-4">
              <Button variant="outline" onClick={() => setShowModal(false)} className="border-[#2a2a2a] text-[#a0a0a0]">
                Fechar
              </Button>
              {validationResult && validationResult.faltantes.length > 0 && (
                <Button onClick={handleCobrar} className="bg-[#22c55e] text-white hover:bg-[#1ea34d]">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Cobrar Pendentes no WhatsApp
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}


export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'detalhes' | 'documentos'>('detalhes')
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  const user = useAuthStore(s => s.user)
  const canManageDocuments = user?.perfil === 'ADMIN' || user?.setor === 'CONTABIL'

  const { data: cliente, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => api.clientes.getById(id!),
    enabled: !!id,
  })

  const { data: documentos = [], isLoading: isLoadingDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['documentos', id],
    queryFn: () => api.clientes.getDocuments(id!),
    enabled: !!id && activeTab === 'documentos',
  })

  const [notifying, setNotifying] = useState(false)
  const notifyPending = async (faltantes?: string[]) => {
    try {
      setNotifying(true)
      const res = await api.clientes.notifyPending(id!, faltantes)
      toast.success(res.message)
    } catch (e: any) {
      toast.error(e.message || "Erro ao notificar")
    } finally {
      setNotifying(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      const res = await api.clientes.getPortalLink(id!)
      await navigator.clipboard.writeText(res.portalUrl)
      toast.success('Link copiado para a área de transferência!')
    } catch (error) {
      toast.error('Erro ao gerar link de upload')
    }
  }

  useEffect(() => {
    setCurrentPage(cliente?.nomeFantasia || 'Cliente')
  }, [cliente, setCurrentPage])

  if (isLoading) return <LoadingSpinner label="Carregando cliente..." />
  if (!cliente) return null

  const infoItems = [
    { icon: Building2, label: 'Razão Social', value: cliente.razaoSocial },
    { icon: Building2, label: 'Nome Fantasia', value: cliente.nomeFantasia },
    { icon: FileText, label: 'CNPJ', value: formatCNPJ(cliente.cnpj) },
    { icon: FileText, label: 'Regime Tributário', value: REGIME_LABELS[cliente.regimeTributario] },
    { icon: FileText, label: 'Status CNPJ', value: cliente.statusCnpj },
    { icon: Phone, label: 'Contato Principal', value: cliente.contatoPrincipal },
    { icon: CalendarDays, label: 'Cadastrado em', value: formatDate(cliente.dataCriacao) },
    { icon: CalendarDays, label: 'Última atualização', value: formatDate(cliente.dataAtualizacao) },
  ]

  const documentosAgrupados = documentos.reduce((acc, doc) => {
    const comp = doc.competencia || 'Sem Competência'
    if (!acc[comp]) acc[comp] = []
    acc[comp].push(doc)
    return acc
  }, {} as Record<string, typeof documentos>)

  const gruposOrdenados = Object.keys(documentosAgrupados).sort((a, b) => {
    if (a === 'Sem Competência') return 1
    if (b === 'Sem Competência') return -1
    const [monthA, yearA] = a.split('/')
    const [monthB, yearB] = b.split('/')
    return parseInt(`${yearB}${monthB}`) - parseInt(`${yearA}${monthA}`)
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={() => navigate(`/clientes/${id}/editar`)}>
          <Edit className="mr-1 h-4 w-4" />
          Editar
        </Button>
      </div>

      {/* Title card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#d4a843]/10">
            <Building2 className="h-7 w-7 text-[#d4a843]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#f5f5f5]">{cliente.nomeFantasia}</h1>
            <p className="text-sm text-[#6b6b6b]">{cliente.razaoSocial}</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              cliente.statusCnpj === 'Ativa'
                ? 'bg-[#22c55e]/10 text-[#22c55e]'
                : 'bg-[#ef4444]/10 text-[#ef4444]'
            }`}>
              {cliente.statusCnpj}
            </span>
          </div>
        </div>
      </motion.div>

        {/* Tabs navigation */}
        <div className="mb-6 flex gap-1 rounded-lg bg-[#1a1a1a] p-1 w-fit border border-[#2a2a2a]">
          <button
            onClick={() => setActiveTab('detalhes')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'detalhes' ? 'bg-[#d4a843] text-black' : 'text-[#a0a0a0] hover:text-[#f5f5f5]'
            }`}
          >
            Detalhes
          </button>
          {canManageDocuments && (
            <button
              onClick={() => setActiveTab('documentos')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'documentos' ? 'bg-[#d4a843] text-black' : 'text-[#a0a0a0] hover:text-[#f5f5f5]'
              }`}
            >
              Documentos
            </button>
          )}
        </div>

        {activeTab === 'detalhes' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#252525]">
                  <item.icon className="h-4 w-4 text-[#6b6b6b]" />
                </div>
                <div>
                  <p className="text-xs text-[#6b6b6b]">{item.label}</p>
                  <p className="text-sm font-medium text-[#f5f5f5]">{item.value}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === 'documentos' && canManageDocuments && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Arquivos Recebidos</h2>
              <div className="flex gap-2">
                <Button onClick={handleCopyLink} variant="outline" className="border-[#2a2a2a] text-[#f5f5f5] hover:bg-[#252525]">
                  <Link2 className="mr-2 h-4 w-4 text-[#d4a843]" />
                  Copiar Link
                </Button>
                <Button onClick={() => notifyPending()} disabled={notifying} className="bg-[#22c55e] text-white hover:bg-[#1ea34d]">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {notifying ? "Notificando..." : "Cobrar no WhatsApp"}
                </Button>
              </div>
            </div>

            {isLoadingDocs ? (
              <LoadingSpinner label="Carregando documentos..." />
            ) : documentos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#111111] p-10 text-center">
                <FileIcon className="mx-auto mb-4 h-10 w-10 text-[#6b6b6b]" />
                <p className="text-[#a0a0a0]">Nenhum documento recebido deste cliente ainda.</p>
              </div>
            ) : (
              <div>
                {gruposOrdenados.map(comp => (
                  <DocumentGroup 
                    key={comp} 
                    clienteId={id!}
                    competencia={comp} 
                    documentos={documentosAgrupados[comp]}
                    onNotify={notifyPending}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
    </div>
  )
}
