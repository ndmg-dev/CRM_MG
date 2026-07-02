import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#ef4444]/10">
            <AlertTriangle className="h-7 w-7 text-[#ef4444]" />
          </div>
          <h3 className="text-lg font-semibold text-[#f5f5f5]">Algo deu errado</h3>
          <p className="max-w-md text-sm text-[#6b6b6b]">
            {this.state.error?.message || 'Ocorreu um erro inesperado. Tente recarregar a página.'}
          </p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Recarregar Página
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
