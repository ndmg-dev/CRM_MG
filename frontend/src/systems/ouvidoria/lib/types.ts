// Espelha os ENUMs e colunas do banco da Ouvidoria (ver
// integrations/supabase/migrations/00001_sso_and_rls.sql e o schema.sql /
// migration_v2.sql do repo original ndmg-dev/ouvidoria-mg). Mantido como um
// arquivo só, sem geração automática de tipos — o schema é pequeno e estável.

export type UserRole = 'user' | 'admin'

export type ComplaintStatus =
  | 'aberta'
  | 'em_analise'
  | 'em_tratativa'
  | 'aguardando_usuario'
  | 'concluida'
  | 'arquivada'

export type ComplaintPriority = 'baixa' | 'media' | 'alta' | 'urgente'

export type ComplaintCategory =
  | 'reclamacao'
  | 'sugestao'
  | 'elogio'
  | 'denuncia'
  | 'duvida'
  | 'solicitacao'
  | 'outro'

export type ComplaintType =
  | 'assedio_moral'
  | 'assedio_sexual'
  | 'discriminacao'
  | 'condicoes_trabalho'
  | 'remuneracao'
  | 'beneficios'
  | 'gestao'
  | 'comunicacao'
  | 'politicas_internas'
  | 'relacionamento'
  | 'outro'

export type MessageSender = 'user' | 'admin' | 'system'

export type KnowledgeDocStatus = 'active' | 'inactive' | 'processing'

export interface OuvidoriaUser {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  domain: string
  department: string | null
  is_active: boolean
  auth_user_id: string | null
  last_login_at: string | null
  created_at: string
  updated_at: string
}

// Subconjunto de `users` usado em joins (nome/avatar, às vezes email/role).
export interface UserSummary {
  full_name: string
  avatar_url?: string | null
  email?: string
  role?: UserRole
}

export interface Complaint {
  id: string
  protocol: string
  user_id: string | null
  title: string
  description: string
  category: ComplaintCategory
  type: ComplaintType
  department: string | null
  priority: ComplaintPriority
  status: ComplaintStatus
  is_confidential: boolean
  assigned_to: string | null
  ai_suggested_priority: string | null
  ai_suggested_category: string | null
  ai_summary: string | null
  resolved_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  users?: UserSummary | null
}

export interface ComplaintMessage {
  id: string
  complaint_id: string
  sender_id: string
  sender_type: MessageSender
  content: string
  is_deleted: boolean
  created_at: string
  updated_at: string
  users?: UserSummary | null
}

export interface ComplaintInternalNote {
  id: string
  complaint_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  users?: UserSummary | null
}

export interface ComplaintAttachment {
  id: string
  complaint_id: string
  uploaded_by: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  session_title: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface KnowledgeDocument {
  id: string
  title: string
  description: string | null
  file_name: string | null
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  content: string | null
  status: KnowledgeDocStatus
  category: string | null
  tags: string[] | null
  uploaded_by: string | null
  chunk_count: number | null
  last_indexed_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  created_at: string
  updated_at: string
  users?: UserSummary | null
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  users?: UserSummary | null
}

export interface DashboardStats {
  total: number
  abertas: number
  em_analise: number
  em_tratativa: number
  concluidas: number
  aguardando: number
}

export interface AdminDashboardStats extends DashboardStats {
  by_category: Record<string, number>
  by_priority: Record<string, number>
  by_department: Record<string, number>
  recent: Complaint[]
  sla: { tma_hours: number | null; tmr_hours: number | null }
}
