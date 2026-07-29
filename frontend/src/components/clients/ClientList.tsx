import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Search, Building2, Link2 } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/EmptyState'
import PageHeader from '@/components/common/PageHeader'
import { formatCNPJ, formatDate } from '@/lib/utils'
import { REGIME_LABELS } from '@/lib/constants'
import toast from 'react-hot-toast'

export default function ClientList() {
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)
  useEffect(() => { setCurrentPage('Clientes') }, [setCurrentPage])

  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const user = useAuthStore(s => s.user)
  const canManageDocuments = user?.perfil === 'ADMIN' || user?.setor === 'CONTABIL'

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => api.clientes.getAll(search || undefined),
  })

  const clientes = data?.content || []

  const handleCopyLink = async (e: React.MouseEvent, clienteId: string) => {
    e.stopPropagation()
    try {
      const res = await api.clientes.getPortalLink(clienteId)
      await navigator.clipboard.writeText(res.portalUrl)
      toast.success('Link copiado para a área de transferência!')
    } catch (error) {
      toast.error('Erro ao gerar link de upload')
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Gerencie o cadastro de empresas atendidas"
        actions={
          <Button onClick={() => navigate('/clientes/novo')}>
            <Plus className="mr-1 h-4 w-4" />
            Novo Cliente
          </Button>
        }
      />

      {/* Search */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar por razão social, nome fantasia ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSpinner label="Carregando clientes..." />
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum cliente cadastrado"
          description="Adicione seu primeiro cliente para começar a gerenciar."
          actionLabel="Novo Cliente"
          onAction={() => navigate('/clientes/novo')}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-hidden rounded-lg border border-border"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Razão Social</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Nome Fantasia</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">CNPJ</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Regime</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Criado em</th>
                {canManageDocuments && <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-text-muted">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-surface ${
                    i < clientes.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <td className="px-5 py-3.5 text-sm font-medium text-text-primary">{c.razaoSocial}</td>
                  <td className="px-5 py-3.5 text-sm text-text-secondary">{c.nomeFantasia}</td>
                  <td className="px-5 py-3.5 font-mono text-sm text-text-secondary">{formatCNPJ(c.cnpj)}</td>
                  <td className="px-5 py-3.5 text-sm text-text-secondary">{REGIME_LABELS[c.regimeTributario]}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.statusCnpj === 'Ativa'
                        ? 'bg-success/10 text-success'
                        : 'bg-error/10 text-error'
                    }`}>
                      {c.statusCnpj}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-text-muted">{formatDate(c.dataCriacao)}</td>
                  {canManageDocuments && (
                    <td className="px-5 py-3.5 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => handleCopyLink(e, c.id)}
                        title="Copiar link de upload"
                        className="text-gold hover:text-gold-light hover:bg-gold/10"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  )
}
