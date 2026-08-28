// Resiliência a deploy do frontend para abas já abertas.
//
// A cada deploy, os arquivos de chunk do Vite ganham hash novo e os antigos
// deixam de existir (o nginx responde 404 em /assets/*). Uma aba que já estava
// aberta antes do deploy ainda referencia os hashes antigos — ao navegar para
// uma rota lazy (`import()`), o carregamento falha e a tela fica branca.
//
// Aqui detectamos essa falha específica e recarregamos a página UMA vez para
// pegar o build novo. Guarda contra loop: só recarrega se não houve um reload
// por esse motivo nos últimos RELOAD_GUARD_MS. Se continuar falhando depois do
// reload (offline, erro real de código), o erro propaga normalmente e cai no
// ErrorBoundary/console como antes — não fica recarregando em círculo.

const RELOAD_GUARD_KEY = 'crm:chunk-reload-at'
const RELOAD_GUARD_MS = 15_000

function recentlyReloaded(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY)
    return raw ? Date.now() - Number(raw) < RELOAD_GUARD_MS : false
  } catch {
    return false
  }
}

function reloadOnce(): void {
  if (recentlyReloaded()) return
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()))
  } catch {
    /* sessionStorage indisponível (aba anônima etc.) — recarrega mesmo assim */
  }
  window.location.reload()
}

// Mensagens de falha de import dinâmico variam entre navegadores. Casamos só o
// texto específico de chunk — nada mais dispara reload.
const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|'?ChunkLoadError'?|Loading chunk \S+ failed|Loading CSS chunk/i

export function installChunkErrorHandler(): void {
  // Evento oficial do Vite para falha de preload de chunk.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnce()
  })

  // Fallback para import() que falha fora do caminho de preload.
  window.addEventListener('unhandledrejection', (event) => {
    const reason = (event as PromiseRejectionEvent).reason
    const message: unknown = typeof reason === 'string' ? reason : reason?.message
    if (typeof message === 'string' && CHUNK_ERROR_RE.test(message)) {
      reloadOnce()
    }
  })
}
