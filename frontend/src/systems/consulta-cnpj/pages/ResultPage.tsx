import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCnpjLookup, useOwnershipTree } from '../hooks/useCnpjLookup'
import CompanySummary from '../components/CompanySummary'
import PartnerTable from '../components/PartnerTable'
import OwnershipTree from '../components/OwnershipTree'
import QueryMetadata from '../components/QueryMetadata'
import ErrorAlert from '../components/ErrorAlert'
import LoadingSkeleton from '../components/LoadingSkeleton'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

function hasPjPartners(partners: any[]) {
  if (!partners || !Array.isArray(partners)) return false
  return partners.some((p) => {
    const cpfCnpj = (p.cnpj_cpf_do_socio || p.cnpj_cpf || '').replace(/\D/g, '')
    return p.tipo === 'PJ' || p.tipo === 'Pessoa Jurídica' || cpfCnpj.length === 14
  })
}

export default function ResultPage() {
  const { cnpj } = useParams<{ cnpj: string }>()
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()

  const { data, loading: lookupLoading, error: lookupError, refetch: refetchLookup } = useCnpjLookup(cnpj)

  const company = data?.company || data?.empresa || data
  const partners = data?.partners || data?.socios || data?.qsa || company?.qsa || []
  const metadata = data?.metadata || data?.meta || null
  const pjPartnersExist = data?.has_pj_partners || hasPjPartners(partners)

  const { data: treeData, loading: treeLoading, error: treeError, refetch: refetchTree } = useOwnershipTree(cnpj, pjPartnersExist)

  const tree = treeData?.tree || treeData
  const treeHasUnresolved = treeData?.metadata?.unresolved_count > 0 || tree?.metadata?.unresolved_count > 0

  const handlePartnerClick = useCallback(
    (partnerCnpj: string) => {
      navigate(toAbs(`resultado/${partnerCnpj}`))
    },
    [navigate, toAbs],
  )

  const backLink = (
    <a
      className="results-page__back"
      href={`#${toAbs('.')}`}
      onClick={(e) => {
        e.preventDefault()
        navigate(toAbs('.'))
      }}
    >
      ← Voltar para consulta
    </a>
  )

  if (lookupLoading) {
    return (
      <div className="results-page">
        {backLink}
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="table" />
      </div>
    )
  }

  if (lookupError) {
    return (
      <div className="results-page">
        {backLink}
        <ErrorAlert
          title="Erro na consulta"
          message={(lookupError as any)?.response?.data?.detail || (lookupError as any)?.message || 'Não foi possível consultar o CNPJ informado. Verifique o número e tente novamente.'}
          onRetry={refetchLookup}
        />
      </div>
    )
  }

  if (!company) {
    return (
      <div className="results-page">
        {backLink}
        <ErrorAlert title="CNPJ não encontrado" message="Não foram encontrados dados para o CNPJ informado." />
      </div>
    )
  }

  return (
    <div className="results-page">
      {backLink}

      {metadata && <QueryMetadata metadata={metadata} />}

      <div className="results-page__sections">
        <section>
          <CompanySummary company={company} />
        </section>

        <section>
          <h2 className="section-title">
            <span className="section-title__icon">👥</span>
            Quadro Societário
            {partners.length > 0 && (
              <span className="section-title__count">
                ({partners.length} {partners.length === 1 ? 'sócio' : 'sócios'})
              </span>
            )}
          </h2>
          <PartnerTable partners={partners} onPartnerClick={handlePartnerClick} />
        </section>

        {pjPartnersExist && (
          <div className="pj-warning">
            <span className="pj-warning__icon" aria-hidden="true">⚡</span>
            <span>
              Foram detectados sócios do tipo <strong>Pessoa Jurídica (PJ)</strong>. A árvore de participação societária abaixo exibe a estrutura completa.
            </span>
          </div>
        )}

        {(pjPartnersExist || treeData) && (
          <section>
            <h2 className="section-title">
              <span className="section-title__icon">🌳</span>
              Árvore de Participação
            </h2>

            {treeLoading && <LoadingSkeleton variant="card" />}

            {treeError && (
              <ErrorAlert
                title="Erro ao carregar árvore"
                message={(treeError as any)?.response?.data?.detail || (treeError as any)?.message || 'Não foi possível carregar a árvore de participação societária.'}
                onRetry={refetchTree}
              />
            )}

            {tree && !treeLoading && !treeError && (
              <>
                <OwnershipTree tree={tree} onNavigate={handlePartnerClick} />

                {treeHasUnresolved && (
                  <div className="pj-warning" style={{ marginTop: 'var(--space-md)' }}>
                    <span className="pj-warning__icon" aria-hidden="true">⚠</span>
                    <span>Alguns CNPJs na árvore de participação não puderam ser resolvidos. Isso pode ocorrer quando a empresa não está disponível na base de dados.</span>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
