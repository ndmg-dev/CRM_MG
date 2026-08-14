import { supabase } from '../integrations/supabase/client'
import type { Departamento, SessaoObrigacoes } from '../types'

/**
 * Lê o perímetro da sessão a partir do JWT emitido pelo GoTrue.
 *
 * REGRA: tenant, empresa e perímetro saem SEMPRE de `app_metadata`, que só o
 * servidor escreve (o custom access token hook os injeta). Nunca de
 * `user_metadata` — esse é gravável pelo próprio usuário via /auth/v1/user,
 * e um cliente do portal poderia se declarar colaborador.
 *
 * Isto é conveniência de UI, não autorização: quem realmente decide o que cada
 * sessão enxerga é o RLS no banco. A tela só usa isto para não desenhar botão
 * que o servidor recusaria.
 */
export async function lerSessao(): Promise<SessaoObrigacoes | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return null

  const meta = (data.session.user.app_metadata ?? {}) as Record<string, unknown>
  const perimetro = meta.perimetro
  const tenantId = meta.tenant_id

  if (typeof tenantId !== 'string') return null
  if (perimetro !== 'COLABORADOR' && perimetro !== 'CLIENTE') return null

  return {
    perimetro,
    tenantId,
    empresaId: typeof meta.empresa_id === 'string' ? meta.empresa_id : undefined,
    papel: typeof meta.papel === 'string' ? meta.papel : 'LEITURA',
    departamentos: Array.isArray(meta.departamentos)
      ? (meta.departamentos.filter((d): d is Departamento =>
          d === 'FISCAL' || d === 'CONTABIL' || d === 'PESSOAL'))
      : [],
  }
}

/** O colaborador só administra o que o RBAC do JWT permite. ADMIN vê tudo. */
export function podeDepartamento(sessao: SessaoObrigacoes | null, dep: Departamento): boolean {
  if (!sessao || sessao.perimetro !== 'COLABORADOR') return false
  return sessao.papel === 'ADMIN' || sessao.departamentos.includes(dep)
}
