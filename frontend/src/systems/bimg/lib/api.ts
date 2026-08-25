// Cliente HTTP para o backend do BIMG (FastAPI próprio, fora do backend-fastapi
// do CRM — ver README da migração). O Next.js original usava um rewrite
// (`/api/v1/:path*` → `http://backend:8000/api/v1/:path*`) para esconder a URL
// real do backend atrás de um caminho relativo. Uma SPA servida por Nginx não
// tem esse mecanismo, então falamos direto com a API pela URL configurada em:
//
//   VITE_BIMG_API_URL=https://<host-do-backend-bimg>/api/v1
//
// O backend do BIMG já libera CORS com allow_origins=["*"], então a chamada
// direta do browser funciona sem proxy adicional.
const API_BASE = import.meta.env.VITE_BIMG_API_URL || 'http://localhost:8000/api/v1'

if (!import.meta.env.VITE_BIMG_API_URL) {
  console.warn(
    '[bimg] VITE_BIMG_API_URL não configurada — usando fallback de desenvolvimento (http://localhost:8000/api/v1).'
  )
}

export async function bimgFetchAPI(endpoint: string) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { cache: 'no-store' })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export function bimgApiUrl(path: string) {
  return `${API_BASE}${path}`
}
