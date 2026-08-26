import axios from 'axios'
import { cleanCnpj } from '../utils/cnpj'

/**
 * API própria do Consulta Societária (repo CONSULTA-SOCIETARIO), sem
 * autenticação (decisão do sistema original). Aponta pra origem real do
 * backend FastAPI em vez de `/api` relativo — mesmo padrão do Documentação
 * Contábil (ver documentacao-contabil/api/client.ts).
 */
const api = axios.create({
  baseURL: (import.meta.env.VITE_CNPJ_API_URL || 'https://consultacnpj.mendoncagalvao.com.br') + '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export async function lookupCnpj(cnpj: string) {
  const cleaned = cleanCnpj(cnpj)
  const response = await api.get(`/cnpj/${cleaned}`)
  return response.data
}

export async function getOwnershipTree(cnpj: string) {
  const cleaned = cleanCnpj(cnpj)
  const response = await api.get(`/cnpj/${cleaned}/ownership`)
  return response.data
}

export default api
