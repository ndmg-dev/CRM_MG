import axios, { AxiosError } from 'axios'

/**
 * API própria do Gerador de Notas Explicativas (renomeado no CRM como
 * "Documentação Contábil"), hospedada à parte — sem autenticação própria
 * (decisão documentada no repo original; não reutiliza o Bearer do CRM nem
 * adiciona nenhuma auth nova). Aponta para a origem real do backend em vez
 * de `/api` relativo, já que aqui não há proxy do Vite/Nginx do CRM na
 * frente dessa API.
 */
export const api = axios.create({
  baseURL: (import.meta.env.VITE_DOCCONTABIL_API_URL || 'https://doccontabil.mendoncagalvao.com.br') + '/api',
  timeout: 120_000,
})

interface ApiErrorBody {
  detail?: string
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof AxiosError) {
    const detalhe = (erro.response?.data as ApiErrorBody | undefined)?.detail
    if (detalhe) return detalhe
    if (erro.response?.status === 429) {
      return 'Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.'
    }
    return erro.message
  }
  if (erro instanceof Error) return erro.message
  return 'Erro inesperado'
}
