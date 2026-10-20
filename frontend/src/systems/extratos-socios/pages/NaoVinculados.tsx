import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { extratosApi, extratosQueryOptions } from '../lib/api'
import { fmtCNPJ, fmtDateTime, MESES_CURTOS } from '../lib/format'
import { Card, Loading, ErrorMsg, Empty } from '../components/ui'

export default function NaoVinculados() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['extratos', 'nao-vinculados'],
    queryFn: () => extratosApi.naoVinculados(),
    ...extratosQueryOptions,
  })

  return (
    <div>
      <div className="ex-page-head">
        <div>
          <h2 className="ex-page-title">Extratos não vinculados</h2>
          <p className="ex-page-sub">Extratos cujo CNPJ não casou com nenhum cliente do CRM — para conciliação manual.</p>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <Loading />
        ) : isError ? (
          <ErrorMsg error={error} />
        ) : !data || data.length === 0 ? (
          <Empty>Nenhum extrato pendente de vínculo. 🎉</Empty>
        ) : (
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>CNPJ</th>
                  <th>Período</th>
                  <th>Arquivo</th>
                  <th>Processado em</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {data.map((e) => (
                  <tr key={e.id}>
                    <td className="ex-mono">{fmtCNPJ(e.cnpj)}</td>
                    <td>
                      {MESES_CURTOS[e.mes - 1]}/{e.ano}
                    </td>
                    <td className="ex-truncate" title={e.arquivoOrigem || ''}>
                      {e.arquivoOrigem || '—'}
                    </td>
                    <td>{fmtDateTime(e.processadoEm)}</td>
                    <td>
                      {e.driveUrl ? (
                        <a className="ex-link" href={e.driveUrl} target="_blank" rel="noopener noreferrer">
                          abrir <ExternalLink size={13} />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
