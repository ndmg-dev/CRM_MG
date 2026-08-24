import { useParams } from 'react-router-dom'

// Todo sistema nativo migrado é montado em "/sistemas/:id/*" (ver
// SystemViewer.tsx) com seu próprio <Routes> interno, cujas rotas ficam
// todas no mesmo nível (sem aninhamento real). react-router-dom não resolve
// "to" relativo como um <a href> faria nesse cenário — ele sempre acrescenta
// ao pathname atual em vez de substituir o último segmento, mesmo com
// relative="path" ou to=".". Isso já causou tela preta no Ponto Admin (ver
// histórico de fix(ponto-admin) no CHANGELOG/PRs). Por isso a navegação
// interna de qualquer sistema nativo deve usar caminho absoluto ancorado
// neste :id, nunca navegação relativa do React Router.
export function useNativeSystemBase() {
  const { id } = useParams<{ id: string }>()
  return `/sistemas/${id}`
}

// Junta um sufixo ("empresas", "." para a rota índice) à base do sistema,
// sempre como caminho absoluto.
export function useNativeSystemPath() {
  const base = useNativeSystemBase()
  return (to: string) => (to === '.' ? base : `${base}/${to}`)
}
