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
  'processamento-ponto': lazy(() => import('@ponto/ProcessarPontoApp')),
  // Slug ainda não existe em `sistemas_seed.sql`: cadastrar o sistema no CRM
  // com um destes antes de abrir. Os dois cobrem as duas grafias prováveis.
  'obrigacoes-acessorias': lazy(() => import('@obrigacoes/App')),
  'obrigacoes': lazy(() => import('@obrigacoes/App')),
  'calculo-adiantamento': lazy(() => import('@adiantamento/CalculoAdiantamentoApp')),
  'aeronord-convocacoes-recibos': lazy(() => import('@aeronord/AeronordApp')),
  'calculo-comissao': lazy(() => import('@comissao/CalculoComissaoApp')),
  // Slug já cadastrado em sistemas_seed.sql (id 6f9c8d11-...) apontando pro
  // iframe de https://pontoadmin.mendoncagalvao.com.br/ — passa a renderizar
  // nativo automaticamente, sem precisar mudar nada no banco.
  'ponto-admin': lazy(() => import('@pontoadmin/PontoAdminApp')),
  'guia-dp': lazy(() => import('@guiadp/GuiaDpApp')),
  'conciliacao-fiscal': lazy(() => import('@fiscal/ConciliacaoFiscalApp')),
  'abertura-de-empresa': lazy(() => import('@abertura/AberturaEmpresaApp')),
  // Slug já cadastrado em sistemas_seed.sql (setor CONTABIL) apontando pro
  // iframe de https://copilot.mendoncagalvao.com.br/ — passa a renderizar
  // nativo automaticamente, sem precisar mudar nada no banco.
  'copilot-contabil': lazy(() => import('@copilot/CopilotContabilApp')),
  'dashboard-dre': lazy(() => import('@dashdre/DashboardDreApp')),
  // Slug já cadastrado em sistemas_seed.sql (setor GERAL) apontando pro
  // iframe de https://ouvidoria.mendoncagalvao.com.br — passa a renderizar
  // nativo automaticamente, sem precisar mudar nada no banco.
  'ouvidoria-interna-rh': lazy(() => import('@ouvidoria/OuvidoriaApp')),
  // Slug já cadastrado em sistemas_seed.sql (setor CONTABIL) apontando pro
  // iframe de https://bimg.nucleodigital.cloud — passa a renderizar nativo
  // automaticamente, sem precisar mudar nada no banco.
  'bimg-business-intelligence': lazy(() => import('@bimg/BimgApp')),
  // Slug já cadastrado em sistemas_seed.sql (setor CONTABIL) apontando pro
  // iframe de https://contai.mendoncagalvao.com.br — passa a renderizar
  // nativo automaticamente, sem precisar mudar nada no banco.
  'cont-ai': lazy(() => import('@contai/ContaiApp')),
  // Slug já cadastrado em sistemas_seed.sql apontando pro iframe de
  // https://prospect.nucleodigital.cloud — passa a renderizar nativo
  // automaticamente, sem precisar mudar nada no banco. Só as páginas
  // internas (staff) foram portadas; as páginas públicas (formulário de
  // interesse, unsubscribe) continuam no site original (ver
  // src/systems/mg-prospect/MgProspectApp.tsx).
  'prospect-nucleodigital': lazy(() => import('@mgprospect/MgProspectApp')),
  // Slug já cadastrado em sistemas_seed.sql (setor FISCAL) apontando pro
  // iframe de https://fronteira.mendoncagalvao.com.br — passa a renderizar
  // nativo automaticamente, sem precisar mudar nada no banco. É a versão
  // v8 (tnunes8/sistema-fronteira-v8, ainda pendente de homologação fiscal
  // contra o v7 Django em produção) — ver src/systems/fronteira/FronteiraApp.tsx
  // pro aviso completo sobre não alterar o código original.
  'icms-fronteira': lazy(() => import('@fronteira/FronteiraApp')),
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
