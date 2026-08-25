import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Toaster as SonnerToaster, toast } from 'sonner'
import {
  Lightbulb, MapPin, FileText, Building2, PencilLine, Coins,
  Send, Paperclip, Eye, Check, Link2,
} from 'lucide-react'

import './styles.css'

// Portado de ndmg-dev/ABRIR_EMPRESA (templates/index.html + static/js/script.js)
// sem alterar nada do repo original — o site público de lá continua no ar
// exatamente como está, porque é o link que a equipe manda direto pro
// cliente preencher (sem login). Esta versão aqui é só uma conveniência
// extra pra quando um funcionário preenche pelo próprio CRM: as
// submissões vão pro mesmo lugar (Supabase + e-mail via Brevo), só que
// passando pelo proxy do backend do CRM (exige login), não direto do
// navegador — ver app/api/v1/endpoints/abertura_empresa_proxy.py.
const LINK_PUBLICO = 'https://abrirempresa.mendoncagalvao.com.br'

const ESTADOS = [
  ['AC', 'Acre (AC)'], ['AL', 'Alagoas (AL)'], ['AP', 'Amapá (AP)'], ['AM', 'Amazonas (AM)'],
  ['BA', 'Bahia (BA)'], ['CE', 'Ceará (CE)'], ['DF', 'Distrito Federal (DF)'], ['ES', 'Espírito Santo (ES)'],
  ['GO', 'Goiás (GO)'], ['MA', 'Maranhão (MA)'], ['MT', 'Mato Grosso (MT)'], ['MS', 'Mato Grosso do Sul (MS)'],
  ['MG', 'Minas Gerais (MG)'], ['PA', 'Pará (PA)'], ['PB', 'Paraíba (PB)'], ['PR', 'Paraná (PR)'],
  ['PE', 'Pernambuco (PE)'], ['PI', 'Piauí (PI)'], ['RJ', 'Rio de Janeiro (RJ)'], ['RN', 'Rio Grande do Norte (RN)'],
  ['RS', 'Rio Grande do Sul (RS)'], ['RO', 'Rondônia (RO)'], ['RR', 'Roraima (RR)'], ['SC', 'Santa Catarina (SC)'],
  ['SP', 'São Paulo (SP)'], ['SE', 'Sergipe (SE)'], ['TO', 'Tocantins (TO)'],
] as const

const TOTAL_STEPS = 10

interface FormData {
  estado_sede: string
  razao_social_1: string
  razao_social_2: string
  razao_social_3: string
  nome_fantasia: string
  cep: string
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  inscricao_imobiliaria: string
  area_m2: string
  ramo_descricao: string
  valor_capital: string
  data_limite: string
  email: string
  telefone: string
}

const INITIAL_DATA: FormData = {
  estado_sede: '', razao_social_1: '', razao_social_2: '', razao_social_3: '', nome_fantasia: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  inscricao_imobiliaria: '', area_m2: '', ramo_descricao: '',
  valor_capital: '', data_limite: '', email: '', telefone: '',
}

const SELECT_LABELS: Record<string, Record<string, string>> = {
  tipo_integralizacao: {
    ato: 'Integralizado No Ato (À Vista)',
    prazo: 'A Integralizar (Em Prazo Futuro)',
  },
  meio_integralizacao: {
    dinheiro: 'Moeda Corrente (Dinheiro)',
    bens: 'Bens (Móveis / Imóveis)',
  },
}

function formatBRLFromCents(cents: number): string {
  const str = String(cents).padStart(3, '0')
  const reais = str.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const centavos = str.slice(-2)
  return `R$ ${reais},${centavos}`
}

function formatBRLDisplay(raw: string): string {
  const num = parseFloat(raw)
  if (isNaN(num)) return raw
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function maskCEP(v: string): string {
  v = v.replace(/\D/g, '').slice(0, 8)
  if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5)
  return v
}

function maskTelefone(v: string): string {
  const x = v.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/)
  if (!x) return v
  return !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '')
}

function maskInscricao(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 15)
  let out = digits
  if (out.length > 4) out = out.slice(0, 4) + '.' + out.slice(4)
  if (out.length > 9) out = out.slice(0, 9) + '.' + out.slice(9)
  if (out.length > 13) out = out.slice(0, 13) + '.' + out.slice(13)
  return out
}

async function submitToCrmProxy(formData: globalThis.FormData): Promise<{ status: string; id: string }> {
  const token = localStorage.getItem('crm_token')
  const res = await fetch('/api/v1/abertura-empresa-proxy/submit', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  })

  // Mesmo tratamento de sessão expirada do resto do CRM (ver src/lib/api.ts)
  // — diferente do formulário público original, este proxy exige login do
  // CRM, então um 401 aqui é real (sessão expirou no meio do preenchimento).
  if (res.status === 401) {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    toast.error('Sua sessão expirou. Faça login novamente para enviar — os dados preenchidos serão perdidos.')
    setTimeout(() => { window.location.href = '/login' }, 2000)
    throw new Error('Sessão expirada')
  }

  if (!res.ok) throw new Error(`Erro ${res.status} ao enviar formulário`)
  return res.json()
}

export default function AberturaEmpresaApp() {
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL_DATA)
  const [tipoIntegralizacao, setTipoIntegralizacao] = useState<string[]>([])
  const [meioIntegralizacao, setMeioIntegralizacao] = useState<string[]>([])
  const [docIdentidade, setDocIdentidade] = useState<File | null>(null)
  const [docResidencia, setDocResidencia] = useState<File | null>(null)
  const [docCertidao, setDocCertidao] = useState<File | null>(null)
  const [docBens, setDocBens] = useState<File | null>(null)
  const [capitalDisplay, setCapitalDisplay] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null)
  const [linkCopiado, setLinkCopiado] = useState(false)
  const [menuSlot, setMenuSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setMenuSlot(document.getElementById('system-menu-slot'))
  }, [])

  const setField = (name: keyof FormData) => (value: string) => setData((d) => ({ ...d, [name]: value }))

  async function onCepBlur() {
    const cep = data.cep.replace(/\D/g, '')
    if (cep.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const viacep = await res.json()
      if (viacep.erro) {
        toast.error('CEP não encontrado.')
        return
      }
      if (!viacep.logradouro) {
        toast.error('Este CEP é genérico. Use o CEP específico da rua.')
        setField('cep')('')
        return
      }
      setData((d) => ({ ...d, rua: viacep.logradouro, bairro: viacep.bairro, cidade: viacep.localidade, uf: viacep.uf }))
    } catch {
      console.error('Erro ao buscar CEP')
    }
  }

  function onCapitalChange(raw: string) {
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '') || '0'
    const cents = parseInt(digits, 10)
    setCapitalDisplay(formatBRLFromCents(cents))
    setField('valor_capital')((cents / 100).toFixed(2))
  }

  const isStepValid = useMemo(() => {
    switch (currentStep) {
      case 1:
        return !!(data.estado_sede && data.razao_social_1.trim() && data.razao_social_2.trim() && data.razao_social_3.trim())
      case 2:
        return !!data.nome_fantasia.trim()
      case 3:
        return !!(data.cep.trim() && data.rua.trim() && data.numero.trim() && data.bairro.trim() && data.cidade.trim() && data.uf.trim())
      case 4:
        return !!data.inscricao_imobiliaria.trim()
      case 5:
        return !!data.area_m2.trim()
      case 6:
        return !!data.ramo_descricao.trim()
      case 7: {
        const tipoOk = tipoIntegralizacao.length > 0
        const meioOk = meioIntegralizacao.length > 0
        const bensOk = !meioIntegralizacao.includes('bens') || !!docBens
        return !!(data.valor_capital) && tipoOk && meioOk && bensOk
      }
      case 8:
        return !!(data.email.trim() && data.telefone.trim())
      case 9:
        return !!(docIdentidade && docResidencia && docCertidao)
      case 10:
        return true
      default:
        return false
    }
  }, [currentStep, data, tipoIntegralizacao, meioIntegralizacao, docBens, docIdentidade, docResidencia, docCertidao])

  function goNext() {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1)
    } else {
      void handleSubmit()
    }
  }

  function goPrev() {
    if (currentStep > 1) setCurrentStep((s) => s - 1)
  }

  function toggleCheckbox(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function handleSubmit() {
    const formData = new globalThis.FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value) formData.append(key, value)
    })
    if (tipoIntegralizacao.length) formData.append('tipo_integralizacao', tipoIntegralizacao.join(' + '))
    if (meioIntegralizacao.length) formData.append('meio_integralizacao', meioIntegralizacao.join(' + '))
    if (docIdentidade) formData.append('doc_identidade', docIdentidade)
    if (docResidencia) formData.append('doc_residencia', docResidencia)
    if (docCertidao) formData.append('doc_certidao', docCertidao)
    if (docBens) formData.append('doc_bens', docBens)

    setSubmitting(true)
    try {
      const result = await submitToCrmProxy(formData)
      if (result.status === 'success') {
        setSubmitted({ id: result.id })
      } else {
        throw new Error('Erro na submissão')
      }
    } catch {
      toast.error('Erro ao enviar formulário. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(LINK_PUBLICO)
      setLinkCopiado(true)
      toast.success('Link copiado — envie para o cliente.')
      setTimeout(() => setLinkCopiado(false), 2500)
    } catch {
      toast.error(`Não foi possível copiar. Link: ${LINK_PUBLICO}`)
    }
  }

  if (submitted) {
    return (
      <div className="abertura-root">
        <div id="wizard-container">
          <div className="success-screen">
            <div className="success-icon"><Check size={32} /></div>
            <h2>Solicitação Enviada!</h2>
            <p>Seus dados foram encaminhados para o setor societário da<br /><strong>Mendonça Galvão Contadores Associados</strong>.</p>
            <p>Em breve nossa equipe entrará em contato.</p>
            <div className="success-id">ID: {submitted.id}</div>
            <br /><br />
            <button onClick={() => window.location.reload()} className="btn-next" style={{ margin: 'auto' }}>Nova Solicitação</button>
          </div>
          <footer><span>Núcleo Digital</span> — Mendonça Galvão Contadores Associados. Todos os direitos reservados.</footer>
        </div>
      </div>
    )
  }

  return (
    <div className="abertura-root">
      <SonnerToaster theme="dark" position="bottom-right" richColors />

      {menuSlot && createPortal(
        <button type="button" className={`btn-share-link ${linkCopiado ? 'copied' : ''}`} onClick={copiarLink}
          title="Copiar link do formulário público para enviar aos clientes">
          <Link2 size={16} /><span>{linkCopiado ? 'Link copiado!' : 'Copiar link'}</span>
        </button>,
        menuSlot,
      )}

      <div id="wizard-container">
        <header>
          <div className="header-logo">
            <img src="/logo.png" alt="Mendonça Galvão"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <h1>Mendonça Galvão</h1>
          <p>Formulário de Abertura de Empresa</p>
          <div className="step-meta">
            <span className="step-label">Etapa {currentStep} de {TOTAL_STEPS}</span>
          </div>
          <div className="step-indicator">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
              <div key={n} className={`step-dot ${n === currentStep ? 'active' : n < currentStep ? 'done' : ''}`} />
            ))}
          </div>
        </header>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }} />
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          {currentStep === 1 && (
            <div className="step active">
              <h2><span className="step-number">1</span>Razão Social</h2>
              <div className="info-box">
                <span className="info-icon"><Lightbulb size={18} /></span>
                <div>
                  <strong>Dica:</strong> Insira até 3 opções de nome em ordem de preferência.
                  Não utilize nomes de pessoas que <em>não</em> fazem parte da sociedade.
                  O nome deve ser único — por isso pedimos três opções.
                </div>
              </div>
              <div className="form-group">
                <label>Estado da Sede</label>
                <select value={data.estado_sede} onChange={(e) => setField('estado_sede')(e.target.value)} required>
                  <option value="">Selecione o estado…</option>
                  {ESTADOS.map(([uf, label]) => <option key={uf} value={uf}>{label}</option>)}
                </select>
                <span className="field-hint">✦ Estado da Junta Comercial onde a empresa será registrada</span>
              </div>
              <div className="form-group">
                <label>Opção 1 — Preferencial</label>
                <input type="text" value={data.razao_social_1} onChange={(e) => setField('razao_social_1')(e.target.value)}
                  required placeholder="Ex: Mendonça Tech Solutions LTDA" />
                <span className="field-hint">✦ Inclua o tipo societário no final: LTDA, S/A, EIRELI, etc.</span>
              </div>
              <div className="form-group">
                <label>Opção 2</label>
                <input type="text" value={data.razao_social_2} onChange={(e) => setField('razao_social_2')(e.target.value)}
                  required placeholder="Segunda opção de nome" />
              </div>
              <div className="form-group">
                <label>Opção 3</label>
                <input type="text" value={data.razao_social_3} onChange={(e) => setField('razao_social_3')(e.target.value)}
                  required placeholder="Terceira opção de nome" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step active">
              <h2><span className="step-number">2</span>Nome Fantasia</h2>
              <div className="info-box">
                <span className="info-icon"><Lightbulb size={18} /></span>
                <div>
                  O <strong>Nome Fantasia</strong> é como a empresa será conhecida pelo público —
                  aparece em fachadas, sites e materiais de marketing.
                  Pode ser diferente da Razão Social e <em>não</em> precisa incluir LTDA/S/A.
                </div>
              </div>
              <div className="form-group">
                <label>Nome Comercial / Marca</label>
                <input type="text" value={data.nome_fantasia} onChange={(e) => setField('nome_fantasia')(e.target.value)}
                  required placeholder="Como sua empresa será conhecida pelo público?" />
                <span className="field-hint">✦ Ex: se a razão social é "Silva &amp; Filhos LTDA", o nome fantasia pode ser "Casa Silva"</span>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step active">
              <h2><span className="step-number">3</span>Endereço Completo</h2>
              <div className="info-box">
                <span className="info-icon"><MapPin size={18} /></span>
                <div>
                  Digite o <strong>CEP</strong> e os campos de rua, bairro, cidade e UF serão
                  preenchidos automaticamente. Use o endereço onde a empresa funcionará.<br />
                  <strong>Atenção:</strong> o CEP não pode ser geral (CEP único da cidade) —
                  informe o CEP específico da rua do imóvel.
                </div>
              </div>
              <div className="form-group">
                <label>CEP</label>
                <input type="text" value={data.cep} onChange={(e) => setField('cep')(maskCEP(e.target.value))}
                  onBlur={onCepBlur} required maxLength={9} placeholder="00000-000" />
                <span className="field-hint">✦ O CEP não pode ser geral — use o CEP específico da rua do imóvel</span>
              </div>
              <div className="form-group">
                <label>Rua / Logradouro</label>
                <input type="text" value={data.rua} onChange={(e) => setField('rua')(e.target.value)}
                  required placeholder="Preenchido automaticamente pelo CEP" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Número</label>
                  <input type="text" value={data.numero} onChange={(e) => setField('numero')(e.target.value)} required placeholder="Nº" />
                </div>
                <div className="form-group">
                  <label>Complemento <span className="optional-tag">opcional</span></label>
                  <input type="text" value={data.complemento} onChange={(e) => setField('complemento')(e.target.value)} placeholder="Apto, Sala, Bloco..." />
                </div>
              </div>
              <div className="form-group">
                <label>Bairro</label>
                <input type="text" value={data.bairro} onChange={(e) => setField('bairro')(e.target.value)}
                  required placeholder="Preenchido automaticamente pelo CEP" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 16 }}>
                <div className="form-group">
                  <label>Cidade</label>
                  <input type="text" value={data.cidade} required placeholder="Cidade" readOnly />
                </div>
                <div className="form-group">
                  <label>UF</label>
                  <input type="text" value={data.uf} required placeholder="UF" readOnly />
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step active">
              <h2><span className="step-number">4</span>Inscrição Imobiliária</h2>
              <div className="info-box">
                <span className="info-icon"><FileText size={18} /></span>
                <div>
                  A <strong>Inscrição Imobiliária</strong> é o código do imóvel no cadastro da prefeitura.
                  Você encontra esse número no <strong>carnê de IPTU</strong> do imóvel ou consultando
                  o site da prefeitura com o endereço completo.
                </div>
              </div>
              <div className="form-group">
                <label>Número da Inscrição</label>
                <input type="text" value={data.inscricao_imobiliaria}
                  onChange={(e) => setField('inscricao_imobiliaria')(maskInscricao(e.target.value))}
                  required placeholder="Ex: 0123.4567.890.0001" maxLength={16} inputMode="numeric" autoComplete="off" />
                <span className="field-hint">✦ Geralmente está na primeira página do carnê de IPTU, chamado de "Inscrição" ou "Código do Imóvel"</span>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div className="step active">
              <h2><span className="step-number">5</span>Detalhes do Imóvel</h2>
              <div className="info-box">
                <span className="info-icon"><Building2 size={18} /></span>
                <div>
                  Informe a <strong>área total</strong> do espaço que será utilizado pela empresa.
                  Esse dado é exigido pela prefeitura para emissão do Alvará de Funcionamento.
                </div>
              </div>
              <div className="form-group">
                <label>Área (m²)</label>
                <input type="number" value={data.area_m2} onChange={(e) => setField('area_m2')(e.target.value)}
                  required min={1} placeholder="Ex: 45" />
                <span className="field-hint">✦ Informe a área do espaço destinado à empresa, não a área total do imóvel</span>
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <div className="step active">
              <h2><span className="step-number">6</span>Atividade Econômica (CNAE)</h2>
              <div className="info-box">
                <span className="info-icon"><PencilLine size={18} /></span>
                <div>
                  Descreva sua <strong>atividade principal e secundária</strong>, de forma detalhada,
                  com suas próprias palavras — nossa equipe irá identificar o CNAE correto para você.
                </div>
              </div>
              <div className="form-group">
                <label>Descreva seu ramo de atuação</label>
                <textarea value={data.ramo_descricao} onChange={(e) => setField('ramo_descricao')(e.target.value)}
                  required placeholder="Ex: Prestação de serviços de desenvolvimento de software sob encomenda, consultoria em TI e suporte técnico…" />
                <span className="field-hint">✦ Seja específico — quanto mais detalhes, melhor</span>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="step active">
              <h2><span className="step-number">7</span>Capital Social</h2>
              <div className="info-box">
                <span className="info-icon"><Coins size={18} /></span>
                <div>O <strong>Capital Social</strong> é o valor investido pelos sócios para iniciar a empresa.</div>
              </div>
              <div className="form-group">
                <label>Valor Nominal (R$)</label>
                <input type="text" value={capitalDisplay} onChange={(e) => onCapitalChange(e.target.value)}
                  required placeholder="R$ 0,00" inputMode="numeric" autoComplete="off" />
              </div>
              <div className="form-group">
                <label>Integralização <span className="optional-tag">selecione uma ou ambas</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                  <label style={{ textTransform: 'none', fontSize: '0.9rem', letterSpacing: 0, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={tipoIntegralizacao.includes('ato')}
                      onChange={() => toggleCheckbox(tipoIntegralizacao, setTipoIntegralizacao, 'ato')} />
                    Integralizado no ato (à vista)
                  </label>
                  <label style={{ textTransform: 'none', fontSize: '0.9rem', letterSpacing: 0, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={tipoIntegralizacao.includes('prazo')}
                      onChange={() => toggleCheckbox(tipoIntegralizacao, setTipoIntegralizacao, 'prazo')} />
                    A integralizar (em prazo futuro)
                  </label>
                </div>
                <span className="field-hint">✦ "Integralizado no ato" significa que os sócios já aportaram o valor quando sair o CNPJ</span>
              </div>
              {tipoIntegralizacao.includes('prazo') && (
                <div className="form-group">
                  <label>Data Limite para Integralização</label>
                  <input type="date" value={data.data_limite} onChange={(e) => setField('data_limite')(e.target.value)} required />
                </div>
              )}
              <div className="form-group">
                <label>Meio de Integralização <span className="optional-tag">selecione uma ou ambas</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                  <label style={{ textTransform: 'none', fontSize: '0.9rem', letterSpacing: 0, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={meioIntegralizacao.includes('dinheiro')}
                      onChange={() => toggleCheckbox(meioIntegralizacao, setMeioIntegralizacao, 'dinheiro')} />
                    Moeda Corrente (dinheiro)
                  </label>
                  <label style={{ textTransform: 'none', fontSize: '0.9rem', letterSpacing: 0, fontWeight: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={meioIntegralizacao.includes('bens')}
                      onChange={() => toggleCheckbox(meioIntegralizacao, setMeioIntegralizacao, 'bens')} />
                    Bens (Móveis / Imóveis)
                  </label>
                </div>
              </div>
              {meioIntegralizacao.includes('bens') && (
                <div className="form-group">
                  <label>Documentos dos Bens</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.zip"
                    onChange={(e) => setDocBens(e.target.files?.[0] || null)} />
                  <span className="field-hint">✦ Anexe os documentos com as informações dos bens (nota fiscal, escritura, CRLV, laudo de avaliação). Se forem vários, envie um único PDF ou ZIP</span>
                </div>
              )}
            </div>
          )}

          {currentStep === 8 && (
            <div className="step active">
              <h2><span className="step-number">8</span>Informações de Contato</h2>
              <div className="info-box">
                <span className="info-icon"><Send size={18} /></span>
                <div>Usaremos esses dados para <strong>compor o CNPJ</strong>.</div>
              </div>
              <div className="form-group">
                <label>E-mail Corporativo</label>
                <input type="email" value={data.email} onChange={(e) => setField('email')(e.target.value)}
                  required placeholder="contato@suaempresa.com.br" />
                <span className="field-hint">✦ Preferência por e-mail com domínio próprio da empresa</span>
              </div>
              <div className="form-group">
                <label>Telefone / WhatsApp</label>
                <input type="tel" value={data.telefone} onChange={(e) => setField('telefone')(maskTelefone(e.target.value))}
                  required placeholder="(00) 00000-0000" />
                <span className="field-hint">✦ Incluir DDD</span>
              </div>
            </div>
          )}

          {currentStep === 9 && (
            <div className="step active">
              <h2><span className="step-number">9</span>Documentação (Upload)</h2>
              <div className="info-box">
                <span className="info-icon"><Paperclip size={18} /></span>
                <div>
                  <strong>Formatos aceitos:</strong> PDF, JPG, PNG — limite de 5 MB por arquivo.<br />
                  Envie documentos <strong>legíveis e sem recortes</strong>. Documentos de identidade
                  devem conter foto e assinatura visíveis.
                </div>
              </div>
              <div className="form-group">
                <label>RG / CNH / CPF (com foto)</label>
                <input type="file" required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocIdentidade(e.target.files?.[0] || null)} />
                <span className="field-hint">✦ Documento com foto do(s) sócio(s). Se forem vários sócios, envie um único arquivo ZIP ou PDF combinado</span>
              </div>
              <div className="form-group">
                <label>Comprovante de Residência</label>
                <input type="file" required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocResidencia(e.target.files?.[0] || null)} />
                <span className="field-hint">✦ Conta de luz, água, telefone ou bancária — emitida nos últimos 90 dias</span>
              </div>
              <div className="form-group">
                <label>Certidão de Nascimento / Casamento</label>
                <input type="file" required accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocCertidao(e.target.files?.[0] || null)} />
                <span className="field-hint">✦ Para sócios casados: certidão de casamento com o regime de bens</span>
              </div>
            </div>
          )}

          {currentStep === 10 && (
            <ReviewStep data={data} tipoIntegralizacao={tipoIntegralizacao} meioIntegralizacao={meioIntegralizacao}
              docIdentidade={docIdentidade} docResidencia={docResidencia} docCertidao={docCertidao} docBens={docBens} />
          )}

          <div className="button-group">
            <button type="button" className="btn-prev" disabled={currentStep === 1} onClick={goPrev}>← Anterior</button>
            <button type="button" className="btn-next" disabled={!isStepValid || submitting} onClick={goNext}>
              {submitting ? 'Enviando…' : currentStep === TOTAL_STEPS ? 'Confirmar e Enviar ✓' : 'Próximo →'}
            </button>
          </div>
        </form>

        <footer><span>Núcleo Digital</span> — Mendonça Galvão Contadores Associados. Todos os direitos reservados.</footer>
      </div>
    </div>
  )
}

function ReviewStep({ data, tipoIntegralizacao, meioIntegralizacao, docIdentidade, docResidencia, docCertidao, docBens }: {
  data: FormData
  tipoIntegralizacao: string[]
  meioIntegralizacao: string[]
  docIdentidade: File | null
  docResidencia: File | null
  docCertidao: File | null
  docBens: File | null
}) {
  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Razão Social', rows: [
        ['Estado da Sede', data.estado_sede],
        ['Opção 1 — Preferencial', data.razao_social_1],
        ['Opção 2', data.razao_social_2],
        ['Opção 3', data.razao_social_3],
        ['Nome Fantasia', data.nome_fantasia],
      ],
    },
    {
      title: 'Endereço', rows: [
        ['CEP', data.cep],
        ['Rua', data.rua],
        ['Número', data.numero],
        ['Complemento', data.complemento],
        ['Bairro', data.bairro],
        ['Cidade / UF', [data.cidade, data.uf].filter(Boolean).join(' — ')],
      ],
    },
    {
      title: 'Imóvel', rows: [
        ['Inscrição Imobiliária', data.inscricao_imobiliaria],
        ['Área (m²)', data.area_m2],
      ],
    },
    { title: 'Atividade Econômica (CNAE)', rows: [['Ramo de Atuação', data.ramo_descricao]] },
    {
      title: 'Capital Social', rows: [
        ['Valor (R$)', data.valor_capital ? formatBRLDisplay(data.valor_capital) : ''],
        ['Integralização', tipoIntegralizacao.map((v) => SELECT_LABELS.tipo_integralizacao[v] || v).join(' + ')],
        ['Data Limite', data.data_limite],
        ['Meio', meioIntegralizacao.map((v) => SELECT_LABELS.meio_integralizacao[v] || v).join(' + ')],
      ],
    },
    { title: 'Contato', rows: [['E-mail', data.email], ['Telefone', data.telefone]] },
  ]

  const fileRows: [string, string][] = [
    ['Identidade', docIdentidade?.name || ''],
    ['Residência', docResidencia?.name || ''],
    ['Certidão', docCertidao?.name || ''],
    ['Documentos dos Bens', docBens?.name || ''],
  ]

  return (
    <div className="step active">
      <h2><span className="step-number">✓</span>Revisão da Solicitação</h2>
      <div className="info-box">
        <span className="info-icon"><Eye size={18} /></span>
        <div>Confira abaixo todas as informações antes de enviar. Se precisar corrigir algo, use o botão <strong>Anterior</strong> para voltar.</div>
      </div>
      <div>
        {sections.map((section) => {
          const rows = section.rows.filter(([, v]) => v)
          if (rows.length === 0) return null
          return (
            <div key={section.title} className="preview-section">
              <div className="preview-section-title">{section.title}</div>
              {rows.map(([label, value]) => (
                <div key={label} className="preview-row">
                  <span className="preview-label">{label}</span>
                  <span className="preview-value">{value}</span>
                </div>
              ))}
            </div>
          )
        })}
        {fileRows.some(([, v]) => v) && (
          <div className="preview-section">
            <div className="preview-section-title">Documentos</div>
            {fileRows.filter(([, v]) => v).map(([label, name]) => (
              <div key={label} className="preview-row">
                <span className="preview-label">{label}</span>
                <span className="preview-value"><Paperclip size={12} style={{ marginRight: 6 }} />{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
