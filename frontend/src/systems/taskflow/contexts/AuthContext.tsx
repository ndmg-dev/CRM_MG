import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface DbUser {
  role?: string
  [key: string]: any
}

interface AuthSession {
  dbUser?: DbUser
  [key: string]: any
}

interface AuthContextValue {
  user: any
  session: AuthSession | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
})

/**
 * Versão nativa do AuthContext original (frontend/src/contexts/AuthContext.jsx
 * do repo TASK_MANANGER). O CRM já garante que o usuário está autenticado
 * antes de montar o sistema (ver TaskFlowApp) — este contexto não expõe
 * signInWithGoogle/signOut nem tela de login própria, só o `user`/`session`
 * (usado pelo Topbar pra decidir se mostra "Admin") e serve de base pra
 * realtime subscriptions do Supabase (useTickets).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDbUser = async (sessionUser: any) => {
      if (!sessionUser) return
      try {
        const { data } = await supabase.from('users').select('*').eq('id', sessionUser.id).single()
        if (data) {
          setSession((prev) => (prev ? { ...prev, dbUser: data } : prev))
        }
      } catch (e) {
        console.error(e)
      }
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        loadDbUser(session?.user)
      })
      .catch(() => {
        setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      loadDbUser(session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={{ user, session, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
