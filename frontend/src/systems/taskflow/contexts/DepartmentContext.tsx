import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { departmentsApi } from '../lib/api'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'ndmg:department'

interface DepartmentContextValue {
  departments: any[]
  current: any
  currentId: string | null
  loading: boolean
  error: string | null
  selectDepartment: (id: string | null) => void
  refresh: () => Promise<void>
  hasDepartment: boolean
}

const DepartmentContext = createContext<DepartmentContextValue | null>(null)

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<any[]>([])
  const [currentId, setCurrentId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDepartments = useCallback(async () => {
    if (!user) {
      setDepartments([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data } = await departmentsApi.getMine()
      setDepartments(data || [])
      setError(null)

      // Mantém o último setor escolhido se ele ainda for acessível
      const saved = localStorage.getItem(STORAGE_KEY)
      const valid = (data || []).some((d: any) => d.id === saved)
      setCurrentId(valid ? saved : data?.[0]?.id ?? null)
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchDepartments()
  }, [fetchDepartments])

  const selectDepartment = useCallback((id: string | null) => {
    setCurrentId(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }, [])

  const current = useMemo(
    () => departments.find((d) => d.id === currentId) || null,
    [departments, currentId]
  )

  const value: DepartmentContextValue = {
    departments,
    current,
    currentId,
    loading,
    error,
    selectDepartment,
    refresh: fetchDepartments,
    hasDepartment: departments.length > 0,
  }

  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>
}

export function useDepartments() {
  const context = useContext(DepartmentContext)
  if (!context) {
    throw new Error('useDepartments deve ser usado dentro de DepartmentProvider')
  }
  return context
}
