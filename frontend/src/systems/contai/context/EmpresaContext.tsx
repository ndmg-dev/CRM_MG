import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { contaiApi } from '../api/client'

interface EmpresaContextValue {
  /** empresa ativa na sessão do ContAI (obtida via GET /api/integracoes). */
  empresaId: string | null
  empresaNome: string | null
  loading: boolean
  /** true quando a consulta inicial falhou por 401 (sessão inválida). */
  isAuthError: boolean
}

const EmpresaContext = createContext<EmpresaContextValue>({
  empresaId: null,
  empresaNome: null,
  loading: true,
  isAuthError: false,
})

/**
 * Resolve a empresa ativa uma única vez ao montar o sistema, para que as
 * páginas possam passar `empresa_id` explicitamente em toda chamada — a API
 * do ContAI aceita cair no fallback de sessão do Flask, mas isso não existe
 * numa SPA que fala direto com a API (ver nota em api/client.ts), então cada
 * request feita a partir daqui inclui o id assim que ele é conhecido.
 *
 * Os 7 endpoints portados não incluem uma listagem de empresas do usuário —
 * apenas GET /api/integracoes devolve a empresa "ativa" atual — então a troca
 * de empresa (equivalente ao seletor em sidebar_empresas.js) não é possível
 * a partir desta API ainda; ver TODO em components/GlobalChatPanel.tsx.
 */
export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAuthError, setIsAuthError] = useState(false)

  useEffect(() => {
    let cancelled = false
    contaiApi
      .getIntegracoes()
      .then((data) => {
        if (cancelled) return
        const empresa = data.empresa
        if (empresa && 'id' in empresa) {
          setEmpresaId(empresa.id)
          setEmpresaNome(empresa.nome)
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
  }, [])

  return (
    <EmpresaContext.Provider value={{ empresaId, empresaNome, loading, isAuthError }}>
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  return useContext(EmpresaContext)
}
