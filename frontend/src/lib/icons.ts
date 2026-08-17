import {
  Building2,
  Calculator,
  BarChart3,
  Headphones,
  Bot,
  Sparkles,
  Cpu,
  ClipboardList,
  SearchCode,
  Database,
  FileSignature,
  KanbanSquare,
  ListTodo,
  GitMerge,
  PieChart,
  Users,
  BarChart2,
  Activity,
  Map,
  Truck,
  Percent,
  Megaphone,
  Briefcase,
  Store,
  FileText,
  Palmtree,
  Clock,
  LayoutDashboard,
  ShieldAlert,
  CalendarDays,
  Coins,
  FileSearch,
  BadgeAlert,
  FileCheck,
  Fingerprint,
  HandCoins,
  Mail,
  UserMinus,
  BookOpen,
  Target,
  UserCircle,
  Terminal,
  FileCode,
  Notebook,
  BookText,
  Rocket,
  Wallet,
  Receipt,
  ScrollText,
  Landmark,
  Scale,
  Wrench,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ICON_MAP: Record<string, LucideIcon> = {
  // Base
  'building-2': Building2,
  'calculator': Calculator,
  'bar-chart-3': BarChart3,
  'headphones': Headphones,
  'bot': Bot,
  'sparkles': Sparkles,
  'cpu': Cpu,
  'clipboard-list': ClipboardList,

  // Expanded for specific systems
  'search-code': SearchCode,
  'database': Database,
  'file-signature': FileSignature,
  'kanban': KanbanSquare,
  'list-todo': ListTodo,
  'git-merge': GitMerge,
  'pie-chart': PieChart,
  'users': Users,
  'bar-chart-2': BarChart2,
  'activity': Activity,
  'map': Map,
  'truck': Truck,
  'percent': Percent,
  'megaphone': Megaphone,
  'briefcase': Briefcase,
  'store': Store,
  'file-text': FileText,
  'palmtree': Palmtree,
  'clock': Clock,
  'layout-dashboard': LayoutDashboard,
  'shield-alert': ShieldAlert,
  'calendar-days': CalendarDays,
  'coins': Coins,
  'file-search': FileSearch,
  'badge-alert': BadgeAlert,
  'file-check': FileCheck,
  'fingerprint': Fingerprint,
  'hand-coins': HandCoins,
  'mail': Mail,
  'user-minus': UserMinus,

  // Confirmados em uso no cadastro de sistemas mas ausentes até aqui —
  // caíam todos no fallback genérico (ver getSystemIcon).
  'book-open': BookOpen,
  'target': Target,
  'user-circle': UserCircle,

  // Reserva para nomes plausíveis de futuros cadastros — reduz a chance de
  // um novo sistema colidir com o fallback antes de alguém notar.
  'terminal': Terminal,
  'file-code': FileCode,
  'notebook': Notebook,
  'book-text': BookText,
  'rocket': Rocket,
  'wallet': Wallet,
  'receipt': Receipt,
  'scroll-text': ScrollText,
  'landmark': Landmark,
  'scale': Scale,
  'wrench': Wrench,
  'bell': Bell,
}

/**
 * Ícones usados quando `icone` não bate com nenhuma chave de `ICON_MAP` —
 * cadastro com valor incorreto, ou um nome que ainda não foi mapeado aqui.
 * Nunca é um único ícone genérico: isso fazia sistemas diferentes ficarem
 * visualmente idênticos na sidebar e no hub. A escolha é determinística por
 * `id` (mesmo sistema sempre cai no mesmo ícone, estável entre reloads),
 * mas distinta entre sistemas diferentes.
 */
const FALLBACK_POOL: LucideIcon[] = [
  Building2,
  Briefcase,
  FileText,
  Database,
  Activity,
  PieChart,
  Users,
  ClipboardList,
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * Resolve o ícone de um sistema. Preferir esta função a indexar `ICON_MAP`
 * direto — o índice direto sempre caía no mesmo `Building2` para qualquer
 * valor não mapeado.
 */
export function getSystemIcon(icone: string | undefined, id: string): LucideIcon {
  if (icone && ICON_MAP[icone]) return ICON_MAP[icone]
  return FALLBACK_POOL[hashString(id) % FALLBACK_POOL.length]
}
