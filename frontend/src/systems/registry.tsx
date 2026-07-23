import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * Registry de sistemas migrados para código nativo dentro do CRM.
 *
 * Chave: `slug` do Sistema (ver src/types Sistema.slug).
 * Valor: componente React (lazy) que renderiza o sistema real.
 *
 * O SystemViewer consulta este registry: se houver componente para o slug,
 * renderiza o código real; caso contrário, mantém o iframe como fallback
 * para os sistemas ainda não migrados.
 */
export const systemRegistry: Record<string, LazyExoticComponent<ComponentType>> = {
  'calculadora-rescisao': lazy(() => import('@calc/CalculadoraRescisaoApp')),
  // Slug em produção (seed) é 'central-de-suporte'; o alias curto cobre ambientes antigos.
  'central-de-suporte': lazy(() => import('@suporte/App')),
  'central-suporte': lazy(() => import('@suporte/App')),
  'agendamento-ferias': lazy(() => import('@ferias/App')),
}

/**
 * Flag de reversão: defina VITE_NATIVE_SYSTEMS=off no .env para desativar
 * todos os sistemas nativos e voltar ao iframe antigo (que permanece intacto
 * no SystemViewer como fallback).
 */
const NATIVE_SYSTEMS_ENABLED = import.meta.env.VITE_NATIVE_SYSTEMS !== 'off'

export function getSystemComponent(slug: string | undefined) {
  if (!NATIVE_SYSTEMS_ENABLED || !slug) return undefined
  return systemRegistry[slug]
}
