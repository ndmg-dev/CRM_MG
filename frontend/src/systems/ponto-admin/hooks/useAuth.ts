export const ALL_PERMISSIONS = [
  'dashboard', 'reports', 'ferias_create', 'employees', 'justifications',
  'corrections', 'corrections_readonly', 'calendar', 'settings', 'audit',
] as const

export type Permission = typeof ALL_PERMISSIONS[number]

export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard:           'Dashboard',
  reports:             'Relatórios',
  ferias_create:       'Criar Férias',
  employees:           'Funcionários',
  justifications:      'Justificativas',
  corrections:         'Correções de ponto (aprovar)',
  corrections_readonly:'Correções de ponto (somente leitura)',
  calendar:            'Calendário',
  settings:            'Configurações',
  audit:               'Audit Log',
}

function decodeJWT(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return {} }
}

export interface AuthInfo {
  isAdmin: boolean
  role: string
  permissions: Permission[]
  userId?: string
  can: (p: Permission) => boolean
  /** Setor que este usuário coordena — restringe a visão em Relatórios,
   * Justificativas e Correções a esse setor. `null` = não é coordenador.
   * Só para UX (pré-filtrar seletores); o backend sempre revalida de verdade. */
  coordinatedSectorId?: string
  coordinatedSectorName?: string
}

export function useAuth(): AuthInfo {
  const token = localStorage.getItem('mg_token')
  if (!token) {
    return { isAdmin: false, role: 'guest', permissions: [], can: () => false }
  }

  const payload = decodeJWT(token)
  const role    = (payload.role as string) ?? 'admin'   // tokens legados = admin
  const isAdmin = role === 'admin'

  const permissions: Permission[] = isAdmin
    ? [...ALL_PERMISSIONS]
    : ((payload.permissions as string[]) ?? []).filter(
        (p): p is Permission => ALL_PERMISSIONS.includes(p as Permission)
      )

  return {
    isAdmin,
    role,
    permissions,
    userId: payload.user_id as string | undefined,
    can: (p: Permission) => isAdmin || permissions.includes(p),
    coordinatedSectorId: payload.coordinated_sector_id as string | undefined,
    coordinatedSectorName: payload.coordinated_sector_name as string | undefined,
  }
}
