import { useEffect, useState, useCallback } from 'react'
import { ContaiApiError } from '../api/client'

interface ContaiQueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  /** true quando o erro veio de um 401 (token ausente/inválido/domínio errado) */
  isAuthError: boolean
  reload: () => void
}

/**
 * Hook de data-fetching padrão das páginas do ContAI: carrega, expõe estado
 * de loading/erro e distingue 401 (sessão inválida) dos demais erros —
 * este sistema embarcado não tem tela de login própria, então um 401 aqui
 * vira uma mensagem inline, nunca um redirect (diferente do restante do CRM,
 * ver src/lib/api.ts).
 */
export function useContaiQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): ContaiQueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthError, setIsAuthError] = useState(false)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setIsAuthError(false)

    fetcher()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar o ContAI.'
        setError(message)
        setIsAuthError(err instanceof ContaiApiError && err.status === 401)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  useEffect(() => load(), [load])

  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { data, loading, error, isAuthError, reload }
}
