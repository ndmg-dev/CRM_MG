import { useEffect, useState, useRef, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertTriangle, ExternalLink, Info } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { getSystemComponent } from '@/systems/registry'

export default function SystemViewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const { data: sistemas = [] } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const sistema = sistemas.find((s) => s.id === id)
  // Sistema migrado para código nativo (undefined => mantém o iframe antigo)
  const InternalSystem = getSystemComponent(sistema?.slug)
  const setFullBleedSystem = useUIStore((s) => s.setFullBleedSystem)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    setCurrentPage(sistema?.nome || 'Sistema')
  }, [sistema, setCurrentPage])

  // Sistema migrado abre em página cheia (esconde o Header do CRM)
  useEffect(() => {
    setFullBleedSystem(!!InternalSystem)
    return () => {
      setFullBleedSystem(false)
      // Sai do modo quiosque (TV) se o usuário navegar pra fora daqui.
      useUIStore.getState().setKioskMode(false)
    }
  }, [InternalSystem, setFullBleedSystem])

  // PostMessage listener with strict origin validation
  useEffect(() => {
    if (!sistema?.allowedOrigin) return

    const handler = (event: MessageEvent) => {
      if (event.origin !== sistema.allowedOrigin) {
        console.warn(`Blocked postMessage from unauthorized origin: ${event.origin}`)
        return
      }
      // Handle authorized messages here
      console.log('Received message from:', event.origin, event.data)
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [sistema?.allowedOrigin])

  // System usage tracking
  const trackingRef = useRef(false)
  useEffect(() => {
    if (!sistema?.id || trackingRef.current) return
    trackingRef.current = true
    api.tracking.entrar(sistema.id).catch(() => {})

    return () => {
      if (sistema?.id) {
        api.tracking.sair(sistema.id).catch(() => {})
      }
    }
  }, [sistema?.id])

  if (!sistema) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="mb-4 h-12 w-12 text-error" />
        <p className="text-lg text-text-secondary">Sistema não encontrado</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/sistemas')}>
          Voltar aos Sistemas
        </Button>
      </div>
    )
  }

  // Sistema migrado para código nativo? Renderiza direto (iframe abaixo
  // permanece intacto como fallback para sistemas não migrados / flag off).
  if (InternalSystem) {
    return (
      <Suspense
        fallback={
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gold" />
          </div>
        }
      >
        <InternalSystem />
      </Suspense>
    )
  }

  const hasValidUrl = sistema.url && sistema.url !== '#'

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sistemas')} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
          <div className="h-5 w-px bg-divider" />
          <span className="text-sm font-medium text-text-primary">{sistema.nome}</span>
        </div>

        {hasValidUrl && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-text-muted sm:flex">
              <Info className="h-4 w-4" />
              <span>O sistema não carregou?</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(sistema.url, '_blank')}
              className="border-border bg-card text-text-primary hover:bg-surface-hover hover:text-white"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir em nova aba
            </Button>
          </div>
        )}
      </div>

      {/* Iframe container */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-sidebar">
        {!hasValidUrl ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <AlertTriangle className="h-10 w-10 text-warning" />
            <p className="text-text-secondary">URL do sistema não configurada</p>
            <p className="text-sm text-text-muted">
              A URL deste sistema precisa ser definida pelo administrador.
            </p>
          </div>
        ) : (
          <>
            {/* Loading overlay */}
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-sidebar">
                <Loader2 className="h-8 w-8 animate-spin text-gold" />
              </div>
            )}

            {/* Error fallback */}
            {iframeError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-sidebar">
                <AlertTriangle className="h-10 w-10 text-error" />
                <p className="text-text-secondary">Erro ao carregar o sistema</p>
                <Button variant="secondary" size="sm" onClick={() => { setIframeError(false); setIframeLoaded(false) }}>
                  Tentar novamente
                </Button>
              </div>
            )}

            <iframe
              src={sistema.url}
              title={sistema.nome}
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              onLoad={() => setIframeLoaded(true)}
              onError={() => setIframeError(true)}
            />
          </>
        )}
      </div>
    </div>
  )
}
