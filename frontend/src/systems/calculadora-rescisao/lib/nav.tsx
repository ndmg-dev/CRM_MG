import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode, AnchorHTMLAttributes } from 'react'

/**
 * Shim de navegação interno da Calculadora.
 *
 * O CRM já roda dentro de um <BrowserRouter> e o react-router v7 não permite
 * um <Router> aninhado. Este shim reproduz a pequena superfície de navegação
 * usada pela calculadora (useNavigate / useLocation / Link) por meio de estado,
 * sem qualquer Router adicional.
 */

interface CalcNavContextValue {
  pathname: string
  navigate: (to: string | number) => void
}

const CalcNavContext = createContext<CalcNavContextValue>({
  pathname: '/calc',
  navigate: () => {},
})

export function CalcNavProvider({ children, initial = '/calc' }: { children: ReactNode; initial?: string }) {
  const [stack, setStack] = useState<string[]>([initial])
  const pathname = stack[stack.length - 1]

  const navigate = useCallback((to: string | number) => {
    setStack((prev) => {
      if (typeof to === 'number') {
        // navigate(-1) e similares: volta na pilha
        const next = prev.slice(0, Math.max(1, prev.length + to))
        return next.length ? next : ['/calc']
      }
      return [...prev, to]
    })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  }, [])

  return <CalcNavContext.Provider value={{ pathname, navigate }}>{children}</CalcNavContext.Provider>
}

export function useNavigate() {
  return useContext(CalcNavContext).navigate
}

export function useLocation() {
  const { pathname } = useContext(CalcNavContext)
  return { pathname }
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const { navigate } = useContext(CalcNavContext)
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        onClick?.(e)
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
