import { useState } from 'react'
import Button from './Button'
import { cleanCnpj, isCnpj } from '../utils/cnpj'

interface BatchSearchFormProps {
  onStartBatch: (cnpjs: string[], invalidInputs: string[]) => void
}

export default function BatchSearchForm({ onStartBatch }: BatchSearchFormProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const rawList = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)

    const validCnpjs: string[] = []
    const invalidInputs: string[] = []

    rawList.forEach((item) => {
      const cleaned = cleanCnpj(item)
      if (isCnpj(cleaned)) {
        validCnpjs.push(cleaned)
      } else {
        invalidInputs.push(item)
      }
    })

    if (validCnpjs.length === 0) {
      setError('Nenhum CNPJ válido encontrado na lista.')
      return
    }

    if (validCnpjs.length > 200) {
      setError('Por favor, limite a consulta a no máximo 200 CNPJs por vez.')
      return
    }

    setError('')
    onStartBatch(validCnpjs, invalidInputs)
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem', width: '100%' }}>
        <label style={{ display: 'block', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
          Cole os CNPJs abaixo (um por linha ou separados por vírgula):
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Exemplo:\n00.000.000/0001-91\n11.222.333/0001-44'}
          style={{
            width: '100%',
            height: '120px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)',
            padding: '1rem',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'inherit',
            resize: 'vertical',
          }}
        />
      </div>

      <div className="search-form__input-group" style={{ gridTemplateColumns: '1fr' }}>
        <Button type="submit" variant="primary" disabled={!text.trim()} style={{ width: '100%' }}>
          Iniciar Consulta em Lote
        </Button>
      </div>

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)', textAlign: 'left', marginTop: '0.5rem' }}>{error}</p>
      )}

      <p className="search-form__helper" style={{ marginTop: '1rem' }}>
        As consultas serão processadas em fila para evitar bloqueios.
      </p>
    </form>
  )
}
