import PartnerTypeBadge from './PartnerTypeBadge'
import EmptyState from './EmptyState'

function getPartnerType(partner: any): 'PJ' | 'PF' | 'Estrangeiro' {
  const cpfCnpj = partner.cnpj_cpf_do_socio || partner.cnpj_cpf || ''
  const cleaned = cpfCnpj.replace(/\D/g, '')
  if (partner.tipo === 'PJ' || partner.tipo === 'Pessoa Jurídica' || cleaned.length === 14) {
    return 'PJ'
  }
  if (partner.tipo === 'Estrangeiro' || partner.identificador_de_socio === 3) {
    return 'Estrangeiro'
  }
  return 'PF'
}

function getPartnerCnpj(partner: any): string {
  const cpfCnpj = partner.cnpj_cpf_do_socio || partner.cnpj_cpf || ''
  return cpfCnpj.replace(/\D/g, '')
}

interface PartnerTableProps {
  partners?: any[]
  onPartnerClick: (cnpj: string) => void
}

export default function PartnerTable({ partners = [], onPartnerClick }: PartnerTableProps) {
  if (!partners || partners.length === 0) {
    return <EmptyState icon="👥" title="Nenhum sócio encontrado" description="Não foram encontrados sócios para este CNPJ na base de dados." />
  }

  return (
    <div className="partner-table-container">
      <table className="partner-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>Qualificação</th>
            <th>Representante Legal</th>
          </tr>
        </thead>
        <tbody>
          {partners.map((partner, index) => {
            const type = getPartnerType(partner)
            const isPJ = type === 'PJ'
            const cnpj = isPJ ? getPartnerCnpj(partner) : null

            return (
              <tr key={`${partner.nome_socio || partner.nome || ''}-${index}`} className={isPJ ? 'partner-row--pj' : ''}>
                <td>
                  {isPJ && cnpj ? (
                    <a
                      className="partner-name--pj"
                      onClick={(e) => {
                        e.preventDefault()
                        onPartnerClick(cnpj)
                      }}
                      href={`#${cnpj}`}
                      title={`Consultar ${cnpj}`}
                    >
                      {partner.nome_socio || partner.nome || '—'}
                    </a>
                  ) : (
                    partner.nome_socio || partner.nome || '—'
                  )}
                </td>
                <td>
                  <PartnerTypeBadge tipo={type} cnpj={cnpj} />
                </td>
                <td>{partner.qualificacao_socio || partner.qualificacao || partner.qual || '—'}</td>
                <td>{partner.nome_representante_legal || partner.representante_legal || partner.nome_rep_legal || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
