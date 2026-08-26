import StatusBadge from './StatusBadge'
import { formatCnpj } from '../utils/cnpj'

function formatCurrency(value: unknown) {
  if (value == null || value === '') return '—'
  const num = typeof value === 'string' ? parseFloat(value) : (value as number)
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  } catch {
    return dateStr
  }
}

function getSituacaoVariant(situacao?: string): 'silver' | 'success' | 'error' | 'warning' {
  if (!situacao) return 'silver'
  const upper = situacao.toUpperCase()
  if (upper === 'ATIVA') return 'success'
  if (upper === 'BAIXADA') return 'error'
  if (upper === 'SUSPENSA' || upper === 'INAPTA') return 'warning'
  return 'silver'
}

export default function CompanySummary({ company }: { company: any }) {
  if (!company) return null

  const {
    cnpj,
    razao_social,
    nome_fantasia,
    situacao_cadastral,
    uf,
    municipio,
    data_inicio_atividade,
    capital_social,
    natureza_juridica,
    cnae_fiscal_descricao,
    porte,
  } = company

  return (
    <div className="company-summary">
      <div className="company-summary__header">
        <div className="company-summary__header-info">
          <h2 className="company-summary__name">{razao_social || '—'}</h2>
          {nome_fantasia && <span className="company-summary__fantasy">{nome_fantasia}</span>}
          <span className="company-summary__cnpj">{cnpj ? formatCnpj(cnpj.toString().replace(/\D/g, '')) : '—'}</span>
        </div>
        <StatusBadge variant={getSituacaoVariant(situacao_cadastral)}>{situacao_cadastral || 'N/A'}</StatusBadge>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">UF</span>
        <span className="company-summary__value">{uf || '—'}</span>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">Município</span>
        <span className="company-summary__value">{municipio || '—'}</span>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">Abertura</span>
        <span className="company-summary__value">{formatDate(data_inicio_atividade)}</span>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">Capital Social</span>
        <span className="company-summary__value">{formatCurrency(capital_social)}</span>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">Natureza Jurídica</span>
        <span className="company-summary__value">{natureza_juridica || '—'}</span>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">Atividade Principal</span>
        <span className="company-summary__value">{cnae_fiscal_descricao || '—'}</span>
      </div>

      <div className="company-summary__field">
        <span className="company-summary__label">Porte</span>
        <span className="company-summary__value">{porte || '—'}</span>
      </div>
    </div>
  )
}
