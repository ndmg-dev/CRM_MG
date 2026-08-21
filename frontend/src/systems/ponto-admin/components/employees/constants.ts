export const DAYS = ['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo']

export const ROLES = [
  { value: 'colaborador',    label: 'Colaborador' },
  { value: 'gestor',         label: 'Gestor' },
  { value: 'administrador',  label: 'Administrador' },
]

export const SECTOR_COLORS = [
  '#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6',
  '#EC4899','#06B6D4','#84CC16','#F97316','#6366F1',
  '#14B8A6','#A855F7',
]

export type FormData = {
  name: string; email: string; phone: string; position: string
  role: string; is_external: boolean; admission_date: string
}

export const EMPTY_FORM: FormData = {
  name: '', email: '', phone: '', position: '', role: 'colaborador', is_external: false, admission_date: '',
}
