import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import toast from 'react-hot-toast'
import type { RegimeTributario } from '@/types'

const DOCUMENT_CATEGORIES = [
  {
    nome: "Fiscal",
    itens: [
      "Notas Fiscais de Entrada",
      "Notas Fiscais de Saída",
      "Notas Fiscais de Serviço",
      "Arquivos XML",
      "Redução Z / Mapa Resumo"
    ]
  },
  {
    nome: "Contábil / Financeiro",
    itens: [
      "Extratos Bancários",
      "Comprovantes de Pagamento",
      "Comprovantes de Recebimento",
      "Relatório de Caixa",
      "Contratos de Empréstimos / Financiamentos"
    ]
  },
  {
    nome: "Pessoal / RH",
    itens: [
      "Folha de Pagamento",
      "Recibos de Férias e Rescisões",
      "Atestados Médicos",
      "Guias de Impostos e Contribuições"
    ]
  }
];

const formatCNPJInput = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18)
}

const formatPhoneInput = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/g, '($1) $2')
    .replace(/(\d)(\d{4})$/, '$1-$2')
    .substring(0, 15)
}

export default function ClientForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  useEffect(() => { setCurrentPage(isEditing ? 'Editar Cliente' : 'Novo Cliente') }, [isEditing, setCurrentPage])

  const { data: existing, isLoading } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => api.clientes.getById(id!),
    enabled: isEditing,
  })

  const [form, setForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    regimeTributario: 'SIMPLES_NACIONAL' as RegimeTributario,
    statusCnpj: 'Ativa',
    contatoPrincipal: '',
    telefoneWhatsapp: '',
    documentosExigidos: '',
  })

  useEffect(() => {
    if (existing) {
      setForm({
        razaoSocial: existing.razaoSocial,
        nomeFantasia: existing.nomeFantasia,
        cnpj: existing.cnpj,
        regimeTributario: existing.regimeTributario,
        statusCnpj: existing.statusCnpj,
        contatoPrincipal: existing.contatoPrincipal || '',
        telefoneWhatsapp: existing.telefoneWhatsapp ? formatPhoneInput(existing.telefoneWhatsapp) : '',
        documentosExigidos: existing.documentosExigidos || '',
      })
    }
  }, [existing])

  const mutation = useMutation({
    mutationFn: (data: typeof form) => isEditing ? api.clientes.update(id!, data as any) : api.clientes.create(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success(isEditing ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!')
      navigate('/clientes')
    },
    onError: () => toast.error('Erro ao salvar cliente.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.razaoSocial || !form.cnpj) {
      toast.error('Preencha os campos obrigatórios.')
      return
    }
    const cleanCnpj = form.cnpj.replace(/\D/g, '')
    if (cleanCnpj.length !== 14) {
      toast.error('CNPJ deve conter 14 dígitos.')
      return
    }
    
    const submitData = { ...form, cnpj: cleanCnpj, telefoneWhatsapp: form.telefoneWhatsapp.replace(/\D/g, '') }
    mutation.mutate(submitData as any)
  }

  if (isEditing && isLoading) return <LoadingSpinner label="Carregando..." />

  const inputClass = "w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-colors focus:border-gold focus:ring-1 focus:ring-gold/30"
  const labelClass = "mb-1.5 block text-sm font-medium text-text-secondary"

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-xl font-bold text-text-primary">{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Razão Social *</label>
            <input className={inputClass} value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} placeholder="Nome da empresa" />
          </div>
          <div>
            <label className={labelClass}>Nome Fantasia</label>
            <input className={inputClass} value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} placeholder="Nome fantasia" />
          </div>
          <div>
            <label className={labelClass}>CNPJ *</label>
            <input className={inputClass} value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJInput(e.target.value) })} placeholder="00.000.000/0000-00" maxLength={18} />
          </div>
          <div>
            <label className={labelClass}>Telefone / WhatsApp</label>
            <input className={inputClass} value={form.telefoneWhatsapp} onChange={(e) => setForm({ ...form, telefoneWhatsapp: formatPhoneInput(e.target.value) })} placeholder="(00) 00000-0000" maxLength={15} />
          </div>
          <div>
            <label className={labelClass}>Contato Principal</label>
            <input className={inputClass} value={form.contatoPrincipal} onChange={(e) => setForm({ ...form, contatoPrincipal: e.target.value })} placeholder="Nome do contato" />
          </div>
          <div>
            <label className={labelClass}>Regime Tributário</label>
            <select className={inputClass} value={form.regimeTributario} onChange={(e) => setForm({ ...form, regimeTributario: e.target.value as RegimeTributario })}>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="LUCRO_REAL">Lucro Real</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Status CNPJ</label>
            <select className={inputClass} value={form.statusCnpj} onChange={(e) => setForm({ ...form, statusCnpj: e.target.value })}>
              <option value="Ativa">Ativa</option>
              <option value="Inapta">Inapta</option>
              <option value="Suspensa">Suspensa</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-text-secondary">Documentos Exigidos Mensalmente</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const allItems = DOCUMENT_CATEGORIES.flatMap(c => c.itens);
                  setForm({ ...form, documentosExigidos: allItems.join('\n') });
                }}
                className="text-xs font-medium text-gold hover:text-gold-light transition-colors"
              >
                Selecionar Todos
              </button>
              <span className="text-border-emphasis">|</span>
              <button
                type="button"
                onClick={() => setForm({ ...form, documentosExigidos: '' })}
                className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-lg border border-border bg-sidebar p-5 mt-1.5">
            {DOCUMENT_CATEGORIES.map(categoria => (
              <div key={categoria.nome}>
                <h3 className="mb-3 text-sm font-medium text-gold">{categoria.nome}</h3>
                <div className="space-y-3">
                  {categoria.itens.map(item => {
                    const isChecked = form.documentosExigidos.split('\n').map(i => i.trim()).includes(item);
                    return (
                      <label key={item} className="flex items-start gap-3 cursor-pointer group">
                        <div className="flex h-5 items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border-emphasis bg-card text-gold focus:ring-1 focus:ring-gold focus:ring-offset-background transition-colors"
                            checked={isChecked}
                            onChange={(e) => {
                              let current = form.documentosExigidos.split('\n').map(i => i.trim()).filter(Boolean);
                              if (e.target.checked) {
                                current.push(item);
                              } else {
                                current = current.filter(i => i !== item);
                              }
                              setForm({ ...form, documentosExigidos: current.join('\n') });
                            }}
                          />
                        </div>
                        <span className="text-sm text-text-secondary group-hover:text-text-primary leading-snug">{item}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">Selecione os documentos esperados. A IA usará essa lista de referência para validar os envios do cliente.</p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" type="button" onClick={() => navigate('/clientes')}>Cancelar</Button>
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="mr-1 h-4 w-4" />
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
