import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertTriangle, ExternalLink, Info } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function SystemViewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setCurrentPage = useUIStore((s) => s.setCurrentPage)

  const { data: sistemas = [] } = useQuery({
    queryKey: ['sistemas'],
    queryFn: () => api.sistemas.getAll(),
  })

  const sistema = sistemas.find((s) => s.id === id)
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [iframeError, setIframeError] = useState(false)

  useEffect(() => {
    setCurrentPage(sistema?.nome || 'Sistema')
  }, [sistema, setCurrentPage])

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

  if (!sistema) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="mb-4 h-12 w-12 text-[#ef4444]" />
        <p className="text-lg text-[#a0a0a0]">Sistema não encontrado</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/sistemas')}>
          Voltar aos Sistemas
        </Button>
      </div>
    )
  }

  const hasValidUrl = sistema.url && sistema.url !== '#'

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/sistemas')} className="text-[#a0a0a0] hover:text-[#f5f5f5]">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
          <div className="h-5 w-px bg-[#2a2a2a]" />
          <span className="text-sm font-medium text-[#f5f5f5]">{sistema.nome}</span>
        </div>

        {hasValidUrl && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-xs text-[#6b6b6b] sm:flex">
              <Info className="h-4 w-4" />
              <span>O sistema não carregou?</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => window.open(sistema.url, '_blank')}
              className="border-[#2a2a2a] bg-[#1a1a1a] text-[#f5f5f5] hover:bg-[#252525] hover:text-white"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir em nova aba
            </Button>
          </div>
        )}
      </div>

      {/* Iframe container */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-[#2a2a2a] bg-[#111111]">
        {!hasValidUrl ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <AlertTriangle className="h-10 w-10 text-[#f59e0b]" />
            <p className="text-[#a0a0a0]">URL do sistema não configurada</p>
            <p className="text-sm text-[#6b6b6b]">
              A URL deste sistema precisa ser definida pelo administrador.
            </p>
          </div>
        ) : (
          <>
            {/* Loading overlay */}
            {!iframeLoaded && !iframeError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#111111]">
                <Loader2 className="h-8 w-8 animate-spin text-[#d4a843]" />
              </div>
            )}

            {/* Error fallback */}
            {iframeError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#111111]">
                <AlertTriangle className="h-10 w-10 text-[#ef4444]" />
                <p className="text-[#a0a0a0]">Erro ao carregar o sistema</p>
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
