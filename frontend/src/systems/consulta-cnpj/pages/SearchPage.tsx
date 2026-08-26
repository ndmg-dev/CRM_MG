import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import SearchForm from '../components/SearchForm'
import BatchSearchForm from '../components/BatchSearchForm'
import BatchResults from '../components/BatchResults'
import { formatCnpj } from '../utils/cnpj'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

export default function SearchPage() {
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [mode, setMode] = useState<'single' | 'batch_form' | 'batch_results'>('single')
  const [batchData, setBatchData] = useState<{ cnpjs: string[]; invalidInputs: string[] }>({ cnpjs: [], invalidInputs: [] })
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('consulta_cnpj_recent') || '[]')
      setRecentSearches(stored.slice(0, 5))
    } catch {
      setRecentSearches([])
    }
  }, [])

  const handleStartBatch = (cnpjs: string[], invalidInputs: string[]) => {
    setBatchData({ cnpjs, invalidInputs })
    setMode('batch_results')
  }

  return (
    <div className="search-page">
      <div className="search-page__logo">
        <Logo size="lg" />
      </div>

      <div>
        <h1 className="search-page__title">Consulta Societária</h1>
        <p className="search-page__subtitle">Análise de CNPJ e estrutura de participação societária</p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          justifyContent: 'center',
          background: 'var(--bg-surface-elevated)',
          padding: '0.5rem',
          borderRadius: '50px',
          width: 'fit-content',
          margin: '0 auto 2.5rem auto',
          border: '1px solid var(--border-strong)',
        }}
      >
        <button
          onClick={() => setMode('single')}
          style={{
            background: mode === 'single' ? 'var(--accent-gold)' : 'transparent',
            color: mode === 'single' ? '#000' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.6rem 1.5rem',
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontWeight: mode === 'single' ? '600' : '400',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Consulta Única
        </button>
        <button
          onClick={() => setMode('batch_form')}
          style={{
            background: mode === 'batch_form' || mode === 'batch_results' ? 'var(--accent-gold)' : 'transparent',
            color: mode === 'batch_form' || mode === 'batch_results' ? '#000' : 'var(--text-secondary)',
            border: 'none',
            padding: '0.6rem 1.5rem',
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            fontWeight: mode === 'batch_form' || mode === 'batch_results' ? '600' : '400',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Consulta em Lote
        </button>
      </div>

      {mode === 'single' && <SearchForm />}

      {mode === 'batch_form' && <BatchSearchForm onStartBatch={handleStartBatch} />}

      {mode === 'batch_results' && <BatchResults cnpjs={batchData.cnpjs} invalidInputs={batchData.invalidInputs} onBack={() => setMode('batch_form')} />}

      {mode === 'single' && recentSearches.length > 0 && (
        <div className="recent-searches">
          <h3 className="recent-searches__title">Consultas recentes</h3>
          <div className="recent-searches__list">
            {recentSearches.map((cnpj) => (
              <a
                key={cnpj}
                className="recent-searches__item"
                onClick={(e) => {
                  e.preventDefault()
                  navigate(toAbs(`resultado/${cnpj}`))
                }}
                href={`#${cnpj}`}
              >
                {formatCnpj(cnpj)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
