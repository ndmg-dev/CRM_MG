import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CnpjInput from './CnpjInput'
import Button from './Button'
import { cleanCnpj, isCnpj } from '../utils/cnpj'
import { useNativeSystemPath } from '@/hooks/useNativeSystemBase'

export default function SearchForm() {
  const [cnpjValue, setCnpjValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const toAbs = useNativeSystemPath()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleaned = cleanCnpj(cnpjValue)

    if (!isCnpj(cleaned)) {
      setError('CNPJ deve conter 14 dígitos.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const stored = JSON.parse(localStorage.getItem('consulta_cnpj_recent') || '[]')
      const updated = [cleaned, ...stored.filter((s: string) => s !== cleaned)].slice(0, 5)
      localStorage.setItem('consulta_cnpj_recent', JSON.stringify(updated))
    } catch {
      // localStorage pode não estar disponível
    }

    navigate(toAbs(`resultado/${cleaned}`))
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-form__input-group">
        <CnpjInput value={cnpjValue} onChange={setCnpjValue} error={error} />
        <Button type="submit" variant="primary" loading={loading} disabled={!cnpjValue.trim()}>
          Consultar
        </Button>
      </div>
      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'left' }}>{error}</p>
      )}
      <p className="search-form__helper">Detecta sócios PJ e constrói a árvore de participação societária automaticamente.</p>
    </form>
  )
}
