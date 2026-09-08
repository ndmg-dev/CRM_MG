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

// --- Fase 2: coletores (cadvisor / node-exporter / docker-socket-proxy) ---

export interface HostInfo {
  loadAvg: { '1m': number | null; '5m': number | null; '15m': number | null }
  cpuCount: number | null
  memory: { totalBytes: number | null; usedBytes: number | null; pct: number | null }
  disk: { totalBytes: number | null; usedBytes: number | null; pct: number | null; inodesPct: number | null }
  uptimeSeconds: number | null
}

export interface ContainerRow {
  name: string
  image: string | null
  state: string | null
  status: string | null
  createdEpoch: number | null
  cpuPct: number | null
  memBytes: number | null
  memLimitBytes: number | null
  memPct: number | null
  project: string | null
  service: string | null
  resource: string | null
}

export interface ContainersResponse {
  generatedAt: number
  hasCpuRates: boolean
  counts: { total: number; running: number; stopped: number; unhealthy: number }
  containers: ContainerRow[]
}

interface DiskBucket {
  count: number
  sizeBytes: number
  reclaimableBytes?: number
  dangling?: number
}

export interface DiskInfo {
  filesystem: { totalBytes: number | null; usedBytes: number | null; availBytes: number | null; pct: number | null }
  docker: {
    totalBytes: number
    reclaimableBytes: number
    images: DiskBucket
    containers: DiskBucket
    volumes: DiskBucket
    buildCache: DiskBucket
  }
}

// --- Fase 2: Coolify ---

export interface CoolifyApp {
  uuid: string | null
  name: string | null
  status: string | null
  fqdn: string | null
  gitRepository: string | null
  gitBranch: string | null
  lastOnlineAt: string | null
  updatedAt: string | null
}

export interface CoolifyDeployment {
  uuid: string | null
  application: string | null
  applicationUuid: string | null
  status: string | null
  commit: string | null
  commitMessage: string | null
  isWebhook: boolean | null
  createdAt: string | null
  finishedAt: string | null
}

export interface DeploysResponse {
  running: CoolifyDeployment[]
  applications: CoolifyApp[]
  services: { uuid: string | null; name: string | null; status: string | null }[]
  counts: { deploying: number; applications: number; appsDegraded: number; servicesDegraded: number }
}

export type InsightSeverity = 'critical' | 'warning' | 'info'

export interface Insight {
  id: string
  severity: InsightSeverity
  title: string
  detail: string
  value: string | null
  // Presentes quando o poller (Fase 3) já registrou o evento:
  status?: 'aberto' | 'reconhecido' | 'resolvido'
  since?: string
  acknowledgedBy?: string | null
}

export interface HistoryPoint {
  t: number
  cpu: number | null
  ramPct: number | null
  diskPct: number | null
  netIn: number | null
  netOut: number | null
}

export interface HistoryResponse {
  range: '7d' | '30d' | '90d' | '1y'
  points: HistoryPoint[]
  sampleCount: number
}

export interface InsightCounts {
  critical: number
  warning: number
  info: number
}

export interface InsightsResponse {
  generatedAt: string
  insights: Insight[]
  counts: InsightCounts
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
  insightCounts: InsightCounts
}
