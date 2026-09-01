// Shapes que o backend do CRM (app/api/v1/endpoints/vps_monitor.py) já
// devolve prontos — bytes/epoch convertidos, série no formato recharts.

export interface VmIpv4 {
  id: number
  address: string
  ptr: string
}

export interface Vm {
  id: number
  hostname: string
  state: string
  actions_lock: string
  plan: string
  cpus: number
  memory: number // MB
  disk: number // MB
  bandwidth: number // MB/mês
  firewall_group_id: number | null
  ipv4: VmIpv4[]
  ipv6: VmIpv4[]
  ns1: string
  ns2: string
  template?: { name: string; description: string }
  created_at: string
}

export interface MetricPoint {
  t: number // epoch ms
  iso: string
  cpu: number | null
  ram: number | null
  ramPct: number | null
  disk: number | null
  diskPct: number | null
  netIn: number | null
  netOut: number | null
  uptime: number | null
}

export interface MetricsResponse {
  range: '24h' | '7d' | '30d'
  memBytes: number | null
  diskBytes: number | null
  bandwidthBytes: number | null
  points: MetricPoint[]
}

export interface SnapshotView {
  exists: boolean
  id?: number
  createdAt?: string
  expiresAt?: string
  restoreTime?: number
}

export interface Backup {
  id: number
  size: number
  restore_time: number
  location: string
  created_at: string
}

export interface BackupsResponse {
  data: Backup[]
  meta: { current_page: number; per_page: number; total: number }
}

export interface VpsAction {
  id: number
  name: string
  state: string
  created_at: string
  updated_at: string
}

export interface ActionsResponse {
  data: VpsAction[]
  meta?: { current_page: number; per_page: number; total: number }
}

export interface FirewallRule {
  id: number
  action: string
  protocol: string
  port: string
  source: string
  source_detail: string
}

export interface FirewallGroup {
  id: number
  name: string
  is_synced: boolean
  rules: FirewallRule[]
  created_at: string
  updated_at: string
}

export interface FirewallResponse {
  data: FirewallGroup[]
  meta: { current_page: number; per_page: number; total: number }
}

export interface Monarx {
  records: number
  malicious: number
  compromised: number
  scanned_files: number
  scan_started_at: string | null
  scan_ended_at: string | null
}

export interface Overview {
  generatedAt: string
  vm: Vm | null
  memBytes: number | null
  diskBytes: number | null
  bandwidthBytes: number | null
  latest: MetricPoint | null
  spark24h: MetricPoint[]
  snapshot: SnapshotView
  backupsCount: number
  lastBackupAt: string | null
  monarx: Monarx | null
}
