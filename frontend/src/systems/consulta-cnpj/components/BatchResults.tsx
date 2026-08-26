import React, { useState, useEffect, useMemo } from 'react'
import Button from './Button'
import { lookupCnpj } from '../api/client'
import { formatCnpj } from '../utils/cnpj'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface BatchResultsProps {
  cnpjs: string[]
  invalidInputs: string[]
  onBack: () => void
}

interface BatchResultItem {
  cnpj: string
  status: string
  razao_social: string
  situacao?: string
  capital?: number
  socios: string[]
  detalhes: any
  has_pj_partners: boolean
  invalid?: boolean
  erro_detalhe?: string
}

export default function BatchResults({ cnpjs, invalidInputs, onBack }: BatchResultsProps) {
  const [results, setResults] = useState<BatchResultItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(true)
  const [isCanceled, setIsCanceled] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})
  const [showOnlyPj, setShowOnlyPj] = useState(true)

  useEffect(() => {
    let active = true

    const processQueue = async () => {
      for (let i = 0; i < cnpjs.length; i++) {
        if (!active || isCanceled) break

        const current = cnpjs[i]
        setCurrentIndex(i)

        try {
          const data = await lookupCnpj(current)
          setResults((prev) => [
            ...prev,
            {
              cnpj: current,
              status: 'Sucesso',
              razao_social: data.company.razao_social,
              situacao: data.company.situacao_cadastral,
              capital: data.company.capital_social,
              socios: data.company.qsa.map((s: any) => `${s.nome || s.nome_socio} (${s.qual || s.qualificacao_socio}) [${s.tipo}]`),
              detalhes: data.company,
              has_pj_partners: data.company.has_pj_partners,
            },
          ])
        } catch (error: any) {
          const detail = error.response?.data?.detail || 'Erro na consulta'
          setResults((prev) => [
            ...prev,
            {
              cnpj: current,
              status: 'Erro',
              erro_detalhe: detail,
              razao_social: '-',
              situacao: '-',
              capital: 0,
              socios: [],
              detalhes: null,
              has_pj_partners: false,
            },
          ])
        }

        await new Promise((r) => setTimeout(r, 500))
      }

      if (active) {
        setCurrentIndex(cnpjs.length)
        setIsProcessing(false)
      }
    }

    processQueue()

    return () => {
      active = false
    }
  }, [cnpjs, isCanceled])

  const progress = cnpjs.length === 0 ? 0 : Math.min(100, Math.round((currentIndex / cnpjs.length) * 100))

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const filteredItems = useMemo(() => {
    const all: BatchResultItem[] = [
      ...results,
      ...invalidInputs.map((inv) => ({
        cnpj: inv,
        status: 'Inválido',
        razao_social: '-',
        invalid: true,
        has_pj_partners: false,
        socios: [],
        detalhes: null,
      })),
    ]
    if (showOnlyPj) {
      return all.filter((r) => r.has_pj_partners)
    }
    return all
  }, [results, invalidInputs, showOnlyPj])

  const handleExportCSV = () => {
    const headers = ['CNPJ', 'Status', 'Tem Socio PJ', 'Razao Social', 'Situacao Cadastral', 'Capital Social', 'Socios']
    const csvRows = [
      headers.join(','),
      ...filteredItems.map((r) =>
        [
          r.invalid ? `"${r.cnpj.replace(/"/g, '""')}"` : formatCnpj(r.cnpj),
          r.status,
          r.has_pj_partners ? 'SIM' : 'NAO',
          `"${(r.razao_social || '').replace(/"/g, '""')}"`,
          r.situacao || '-',
          r.capital || 0,
          `"${(r.socios?.join('; ') || '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ]
    const csvContent = 'data:text/csv;charset=utf-8,﻿' + csvRows.join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `consulta-societaria-${new Date().getTime()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape')
    doc.text('Relatório de Consulta Societária em Lote', 14, 15)

    if (showOnlyPj) {
      doc.setFontSize(10)
      doc.text('(Filtro aplicado: Apenas empresas com Sócios PJ)', 14, 22)
    }

    const tableData = filteredItems.map((r) => {
      if (r.invalid) {
        return [r.cnpj, 'Inválido', 'NÃO', '-', '-', '-', '-']
      }
      const sociosStr = r.socios.join('\n')
      return [
        formatCnpj(r.cnpj),
        r.status,
        r.has_pj_partners ? 'SIM' : 'NÃO',
        r.razao_social,
        r.situacao || '-',
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.capital || 0),
        sociosStr || '-',
      ]
    })

    autoTable(doc, {
      startY: showOnlyPj ? 28 : 20,
      head: [['CNPJ', 'Status', 'Sócio PJ', 'Razão Social', 'Situação', 'Capital', 'Sócios (Resumo)']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [11, 11, 13] },
    })
    doc.save(`consulta-societaria-${new Date().getTime()}.pdf`)
  }

  return (
    <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-md)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '600', color: 'var(--accent-gold)', marginBottom: '0.25rem' }}>Processamento em Lote</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Análise automática de múltiplas empresas</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            setIsCanceled(true)
            onBack()
          }}
          style={{ height: 'fit-content' }}
        >
          Voltar
        </Button>
      </div>

      {isProcessing && (
        <div style={{ background: 'var(--bg-surface-elevated)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: '500' }}>Progresso</span>
            <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: 'var(--accent-gold)' }}>{progress}%</span>
          </div>

          <div style={{ width: '100%', height: '16px', background: 'var(--bg-deep)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-gold-muted) 0%, var(--accent-gold) 100%)',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 10px var(--accent-gold-glow)',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            <span>Consultando CNPJ {cnpjs[currentIndex] ? formatCnpj(cnpjs[currentIndex]) : '...'}</span>
            <span>
              {currentIndex} de {cnpjs.length} processados
            </span>
          </div>
        </div>
      )}

      {!isProcessing && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'var(--bg-surface-elevated)', padding: '0.5rem 1rem', borderRadius: '50px', border: '1px solid var(--border-strong)' }}>
            <input type="checkbox" checked={showOnlyPj} onChange={(e) => setShowOnlyPj(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>Exibir apenas empresas com Sócio PJ</span>
          </label>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button variant="primary" onClick={handleExportCSV}>
              Exportar CSV
            </Button>
            <Button variant="secondary" onClick={handleExportPDF}>
              Exportar PDF
            </Button>
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-strong)', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-deep)', borderBottom: '1px solid var(--border-strong)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', width: '40px' }}></th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>CNPJ</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status PJ</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Razão Social</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {showOnlyPj ? 'Nenhuma empresa desta lista possui sócio PJ.' : 'Nenhum CNPJ na fila.'}
                </td>
              </tr>
            )}
            {filteredItems.map((r, idx) => {
              const isExpanded = expandedRows[idx]
              return (
                <React.Fragment key={idx}>
                  <tr
                    onClick={() => !r.invalid && toggleRow(idx)}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: r.invalid ? 'default' : 'pointer',
                      background: isExpanded ? 'rgba(184, 155, 100, 0.05)' : 'transparent',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {!r.invalid && (
                        <span style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s ease' }}>▶</span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{r.invalid ? r.cnpj : formatCnpj(r.cnpj)}</td>
                    <td style={{ padding: '1rem' }}>
                      {r.has_pj_partners ? (
                        <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', background: 'rgba(184, 155, 100, 0.15)', color: 'var(--accent-gold)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                          TEM SÓCIO PJ
                        </span>
                      ) : (
                        <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', background: 'rgba(210, 211, 213, 0.1)', color: 'var(--text-muted)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                          SEM PJ
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: '500' }}>{r.razao_social}</td>
                  </tr>

                  {isExpanded && !r.invalid && (
                    <tr style={{ background: 'var(--bg-deep)' }}>
                      <td colSpan={4} style={{ padding: '0' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-strong)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Situação Cadastral</p>
                              <p style={{ fontWeight: '500', color: r.situacao === 'ATIVA' ? 'var(--color-success)' : 'var(--text-primary)' }}>{r.situacao}</p>
                            </div>
                            <div>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Capital Social</p>
                              <p style={{ fontWeight: '500', fontFamily: 'monospace' }}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.capital || 0)}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Natureza Jurídica</p>
                              <p style={{ fontSize: 'var(--font-size-sm)' }}>{r.detalhes?.natureza_juridica || '-'}</p>
                            </div>
                          </div>

                          <div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Quadro Societário ({r.socios.length})</p>
                            {r.socios.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {r.socios.map((s, i) => {
                                  const isPj = s.includes('[PJ]') || s.includes('[Estrangeiro]')
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        padding: '0.75rem',
                                        background: isPj ? 'rgba(184, 155, 100, 0.05)' : 'var(--bg-surface)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: isPj ? '1px solid var(--accent-gold-muted)' : '1px solid var(--border-subtle)',
                                        fontSize: 'var(--font-size-sm)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: isPj ? 'var(--accent-gold)' : 'var(--text-primary)',
                                      }}
                                    >
                                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPj ? 'var(--accent-gold)' : 'var(--text-muted)', marginRight: '0.75rem' }} />
                                      <span style={{ fontWeight: isPj ? '600' : '400' }}>{s.replace(' [PJ]', '').replace(' [PF]', '').replace(' [Estrangeiro]', '')}</span>
                                      {isPj && (
                                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: 'var(--accent-gold)', color: '#000', borderRadius: '4px', fontWeight: 'bold' }}>
                                          PJ
                                        </span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Nenhum sócio identificado.</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
