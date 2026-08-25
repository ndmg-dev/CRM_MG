import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { contaiApi, type ContaiEmpresa } from '../api/client'

const STORAGE_KEY = 'contai_empresa_id'

interface EmpresaContextValue {
  empresaId: string | null
  empresaNome: string | null
  empresas: ContaiEmpresa[]
  loading: boolean
  /** true quando a consulta inicial falhou por 401 (sessão inválida). */
  isAuthError: boolean
  setEmpresa: (empresa: ContaiEmpresa) => void
}

const EmpresaContext = createContext<EmpresaContextValue>({
  empresaId: null,
  empresaNome: null,
  empresas: [],
  loading: true,
  isAuthError: false,
  setEmpresa: () => {},
})

/**
 * Resolve a empresa ativa a partir de `GET /empresas/lista` (rota antiga, mas
 * já compatível com Bearer via login_required) e mantém a escolha do usuário
 * em localStorage, escopada a este sistema (`contai_empresa_id`). Toda
 * chamada aos 7 endpoints JSON passa esse id explicitamente via query param
 * — a API não tem sessão persistente entre requests stateless.
 */
export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaId, setEmpresaId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [empresaNome, setEmpresaNome] = useState<string | null>(null)
  const [empresas, setEmpresas] = useState<ContaiEmpresa[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthError, setIsAuthError] = useState(false)

  const setEmpresa = useCallback((empresa: ContaiEmpresa) => {
    localStorage.setItem(STORAGE_KEY, empresa.id)
    setEmpresaId(empresa.id)
    setEmpresaNome(empresa.nome)
  }, [])

  useEffect(() => {
    let cancelled = false
    contaiApi
      .listEmpresas()
      .then((lista) => {
        if (cancelled) return
        setEmpresas(lista)

        const savedId = localStorage.getItem(STORAGE_KEY)
        const saved = savedId ? lista.find((e) => e.id === savedId) : undefined
        if (saved) {
          setEmpresaId(saved.id)
          setEmpresaNome(saved.nome)
        } else if (lista.length === 1) {
          // Só uma empresa cadastrada: seleciona automaticamente, sem exigir
          // um clique a mais do usuário.
          setEmpresa(lista[0])
        } else {
          // Sem escolha salva (ou ela não existe mais na lista): limpa pra
          // não mandar um empresa_id inválido pra API.
          localStorage.removeItem(STORAGE_KEY)
          setEmpresaId(null)
        }
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setIsAuthError(err?.status === 401)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [setEmpresa])

  return (
    <EmpresaContext.Provider value={{ empresaId, empresaNome, empresas, loading, isAuthError, setEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  return useContext(EmpresaContext)
}
