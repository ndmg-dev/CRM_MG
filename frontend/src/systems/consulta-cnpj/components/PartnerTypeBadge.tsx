interface PartnerTypeBadgeProps {
  tipo: 'PJ' | 'PF' | 'Estrangeiro'
  cnpj?: string | null
}

export default function PartnerTypeBadge({ tipo, cnpj }: PartnerTypeBadgeProps) {
  const typeMap = {
    PJ: { label: 'PJ', className: 'partner-type-badge partner-type-badge--pj' },
    PF: { label: 'PF', className: 'partner-type-badge partner-type-badge--pf' },
    Estrangeiro: { label: 'EST', className: 'partner-type-badge partner-type-badge--estrangeiro' },
  }

  const config = typeMap[tipo] || typeMap.PF

  return (
    <span className={config.className} title={tipo === 'PJ' && cnpj ? `CNPJ: ${cnpj}` : tipo}>
      {config.label}
    </span>
  )
}
