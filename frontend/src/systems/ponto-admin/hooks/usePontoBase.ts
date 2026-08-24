import { useParams } from 'react-router-dom'

// react-router-dom (v7) não resolve caminhos relativos como um <a href> faria
// — "to" sempre é acrescentado ao pathname atual (nunca substitui o último
// segmento), mesmo com relative="path" ou to=".". Então navegação relativa
// entre as páginas irmãs deste sistema (todas montadas direto em
// "/sistemas/:id/*") quebra assim que o usuário sai da rota índice: "." vira
// um no-op e qualquer outro alvo vira aninhamento (".../justifications" ->
// clicar em "Funcionários" gera ".../justifications/employees" em vez de
// ".../employees"). Por isso toda navegação aqui usa caminho absoluto
// ancorado no :id da rota externa.
export function usePontoBase() {
  const { id } = useParams<{ id: string }>()
  return `/sistemas/${id}`
}

// Junta um sufixo ("employees", "login", "." para a rota índice) à base do
// sistema, sempre como caminho absoluto.
export function usePontoPath() {
  const base = usePontoBase()
  return (to: string) => (to === '.' ? base : `${base}/${to}`)
}
