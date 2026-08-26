import { useState, useEffect, useCallback, useRef } from 'react'
import { lookupCnpj, getOwnershipTree } from '../api/client'

export function useCnpjLookup(cnpj: string | undefined) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async () => {
    if (!cnpj) return

    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const result = await lookupCnpj(cnpj)
      if (!controller.signal.aborted) {
        setData(result)
        setLoading(false)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err)
        setLoading(false)
      }
    }
  }, [cnpj])

  useEffect(() => {
    setData(null)
    setError(null)
    fetchData()

    return () => {
      abortRef.current?.abort()
    }
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

export function useOwnershipTree(cnpj: string | undefined, shouldFetch = false) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<any>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hasFetchedRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!cnpj) return

    if (abortRef.current) {
      abortRef.current.abort()
    }

    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const result = await getOwnershipTree(cnpj)
      if (!controller.signal.aborted) {
        setData(result)
        setLoading(false)
        hasFetchedRef.current = true
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err)
        setLoading(false)
      }
    }
  }, [cnpj])

  useEffect(() => {
    setData(null)
    setError(null)
    hasFetchedRef.current = false
  }, [cnpj])

  useEffect(() => {
    if (shouldFetch && cnpj && !hasFetchedRef.current) {
      fetchData()
    }

    return () => {
      abortRef.current?.abort()
    }
  }, [shouldFetch, cnpj, fetchData])

  return { data, loading, error, refetch: fetchData }
}
