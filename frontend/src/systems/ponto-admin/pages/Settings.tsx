import { useState, useEffect, useCallback } from 'react'
import { useSettings, useSaveSettings, useGenerateKioskKey, useRevokeKioskKey } from '../hooks/useSettings'
import { useEmployees } from '../hooks/useEmployees'
import SectorsTab from '../components/employees/SectorsTab'
import CctTab from '../components/settings/CctTab'
import WorkScheduleTab from '../components/settings/WorkScheduleTab'

type ToastType = 'success' | 'error'
interface Toast { id: number; type: ToastType; message: string }

let toastId = 0

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => onDismiss(t.id)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderRadius: 'var(--radius-md)',
          background: t.type === 'success' ? 'rgba(42,157,92,0.15)' : 'rgba(226,75,74,0.15)',
          border: `0.5px solid ${t.type === 'success' ? 'rgba(42,157,92,0.4)' : 'rgba(226,75,74,0.4)'}`,
          color: t.type === 'success' ? '#2a9d5c' : '#E24B4A',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'slideUp 0.2s ease',
          minWidth: 220,
        }}>
          <span style={{ fontSize: 16 }}>{t.type === 'success' ? '✓' : '✕'}</span>
          {t.message}
        </div>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  )
}

function ToggleRow({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
      <div style={{ paddingTop: 1 }}>
        <Toggle checked={checked} onChange={onChange} />
      </div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--mg-white)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 3, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

const TABS = [
  { key: 'ponto',         label: 'Ponto' },
  { key: 'horario',       label: 'Horário de Trabalho' },
  { key: 'localizacao',   label: 'Localização' },
  { key: 'kiosk',         label: 'Kiosk' },
  { key: 'aprovacoes',    label: 'Aprovações' },
  { key: 'notificacoes',  label: 'Notificações' },
  { key: 'cadastro',      label: 'Auto-cadastro' },
  { key: 'setores',       label: 'Setores' },
  { key: 'cct',           label: 'CCT' },
] as const
type TabKey = typeof TABS[number]['key']

// Abas cujo conteúdo faz parte do dict de Setting salvo pelo botão "Salvar"
// no topo — Horário de Trabalho, Setores e CCT gerenciam suas próprias
// mutations e não usam esse botão.
const SETTINGS_TABS: TabKey[] = ['ponto', 'localizacao', 'kiosk', 'aprovacoes', 'notificacoes', 'cadastro']

export default function Settings() {
  const { data: settings } = useSettings()
  const saveMutation     = useSaveSettings()
  const genKeyMutation   = useGenerateKioskKey()
  const revokeKeyMutation = useRevokeKioskKey()
  const { data: employees = [] } = useEmployees()

  const [tab,           setTab]         = useState<TabKey>('ponto')

  const [form,         setForm]         = useState<Record<string, string>>({})
  const [bssids,       setBssids]       = useState<string[]>([])
  const [newBssid,     setNewBssid]     = useState('')
  const [kioskKey,     setKioskKey]     = useState<string | null>(null)
  const [locLoading,   setLocLoading]   = useState(false)
  const [locError,     setLocError]     = useState('')
  const [placeQuery,   setPlaceQuery]   = useState('')
  const [placeResults, setPlaceResults] = useState<{ display_name: string; lat: string; lon: string }[]>([])
  const [placeLoading, setPlaceLoading] = useState(false)
  const [toasts,       setToasts]       = useState<Toast[]>([])

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    if (!settings) return
    setForm(settings)
    const raw = settings['WIFI_BSSID_WHITELIST'] ?? ''
    setBssids(raw.split(',').map(b => b.trim()).filter(Boolean))
  }, [settings])

  function set(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: String(value) }))
  }

  function addBssid() {
    const cleaned = newBssid.trim().toUpperCase()
    if (!cleaned || bssids.includes(cleaned)) { setNewBssid(''); return }
    setBssids(prev => [...prev, cleaned])
    setNewBssid('')
  }

  function removeBssid(i: number) {
    setBssids(prev => prev.filter((_, j) => j !== i))
  }

  async function handleSave() {
    try {
      const payload = { ...form, WIFI_BSSID_WHITELIST: bssids.join(',') }
      await saveMutation.mutateAsync(payload)
      addToast('success', 'Configurações salvas com sucesso!')
    } catch {
      addToast('error', 'Erro ao salvar configurações. Tente novamente.')
    }
  }

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setLocError('Geolocalização não disponível neste browser.')
      return
    }
    setLocLoading(true)
    setLocError('')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({
          ...f,
          COMPANY_LAT: pos.coords.latitude.toFixed(7),
          COMPANY_LONG: pos.coords.longitude.toFixed(7),
        }))
        setLocLoading(false)
      },
      () => {
        setLocError('Permissão de localização negada ou timeout.')
        setLocLoading(false)
      },
      { timeout: 10_000, enableHighAccuracy: true },
    )
  }

  async function handlePlaceSearch() {
    if (!placeQuery.trim()) return
    setPlaceLoading(true)
    setPlaceResults([])
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeQuery)}&format=json&limit=5&addressdetails=0`
      const resp = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } })
      const data = await resp.json()
      setPlaceResults(data)
    } catch {
      setLocError('Erro ao buscar local. Verifique a conexão.')
    } finally {
      setPlaceLoading(false)
    }
  }

  function handlePlaceSelect(place: { display_name: string; lat: string; lon: string }) {
    setForm(f => ({
      ...f,
      COMPANY_LAT: parseFloat(place.lat).toFixed(7),
      COMPANY_LONG: parseFloat(place.lon).toFixed(7),
      COMPANY_LOCATION_NAME: place.display_name,
    }))
    setPlaceResults([])
    setPlaceQuery(place.display_name)
  }

  async function handleGenKey() {
    const result = await genKeyMutation.mutateAsync()
    setKioskKey(result.kiosk_api_key)
  }

  const wifiEnabled = form['WIFI_CHECK_ENABLED'] === 'true'
  const gpsEnabled  = form['GPS_CHECK_ENABLED']  === 'true'
  const strictMode  = form['LOCATION_STRICT_MODE'] === 'true'

  return (
    <div className="animate-in">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        {SETTINGS_TABS.includes(tab) && (
          <button className="btn-primary" onClick={handleSave} disabled={saveMutation.isPending}
            style={{ minWidth: 90 }}>
            {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: 'var(--mg-border)', paddingBottom: 0, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px',
              fontSize: 13, fontWeight: 500,
              color: tab === t.key ? 'var(--mg-gold)' : 'var(--mg-muted)',
              borderBottom: tab === t.key ? '2px solid var(--mg-gold)' : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>

        {/* ── Ponto ────────────────────────────────────────────────────── */}
        {tab === 'ponto' && (
          <div className="card">
            <div className="section-title">Ponto</div>
            <ToggleRow
              checked={form['PUNCH_LIMIT_ENABLED'] === 'true'}
              onChange={v => set('PUNCH_LIMIT_ENABLED', v)}
              label="Limitar pontos por dia"
              description="Bloqueia o registro após o ciclo diário completo — 4 pontos (entrada, saída almoço, retorno e saída), ou 8 em setores com intervalo habilitado. Funcionário precisará justificar se precisar de registros extras."
            />
          </div>
        )}

        {/* ── Horário de Trabalho ─────────────────────────────────────── */}
        {tab === 'horario' && <WorkScheduleTab />}

        {/* ── Localização ──────────────────────────────────────────────── */}
        {tab === 'localizacao' && (
          <>
            <div className="card">
              <div className="section-title">Localização e Rede</div>

              {/* Modo estrito */}
              <div style={{
                background: strictMode ? 'rgba(226,75,74,0.07)' : 'rgba(255,255,255,0.03)',
                border: `0.5px solid ${strictMode ? 'rgba(226,75,74,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: 20,
                transition: 'all 0.2s',
              }}>
                <ToggleRow
                  checked={strictMode}
                  onChange={v => set('LOCATION_STRICT_MODE', v)}
                  label="Modo estrito"
                  description={
                    strictMode
                      ? 'O ponto é BLOQUEADO se o funcionário estiver fora do local autorizado (retorna erro)'
                      : 'Violações de localização são apenas registradas — o ponto é registrado normalmente'
                  }
                />
              </div>

              {/* Wi-Fi */}
              <div style={{ marginBottom: 16 }}>
                <ToggleRow
                  checked={wifiEnabled}
                  onChange={v => set('WIFI_CHECK_ENABLED', v)}
                  label="Validação por Wi-Fi (BSSID)"
                  description="Verifica se o kiosk está na rede Wi-Fi autorizada. Tem prioridade sobre GPS quando disponível."
                />

                {wifiEnabled && (
                  <div style={{ marginLeft: 46 }}>
                    {/* Lista de BSSIDs */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {bssids.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--mg-muted)' }}>
                          Nenhum BSSID cadastrado
                        </span>
                      )}
                      {bssids.map((b, i) => (
                        <span key={i} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'rgba(201,150,12,0.10)',
                          border: '0.5px solid rgba(201,150,12,0.30)',
                          borderRadius: 4, padding: '3px 10px',
                          fontSize: 12, fontFamily: 'monospace', color: 'var(--mg-gold)',
                        }}>
                          {b}
                          <button
                            onClick={() => removeBssid(i)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'rgba(201,150,12,0.6)', fontSize: 14, lineHeight: 1,
                              padding: 0,
                            }}
                          >×</button>
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="form-input"
                        value={newBssid}
                        onChange={e => setNewBssid(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addBssid()}
                        placeholder="AA:BB:CC:DD:EE:FF"
                        style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}
                      />
                      <button className="btn-ghost" onClick={addBssid} style={{ flexShrink: 0, padding: '8px 14px' }}>
                        + Adicionar
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 6 }}>
                      O BSSID é o endereço MAC do roteador Wi-Fi. Consulte as configurações do seu roteador.
                    </div>
                  </div>
                )}
              </div>

              {/* GPS */}
              <div>
                <ToggleRow
                  checked={gpsEnabled}
                  onChange={v => set('GPS_CHECK_ENABLED', v)}
                  label="Validação por GPS"
                  description="Verifica se o kiosk está dentro do raio definido ao redor da empresa. Requer que o browser permita geolocalização."
                />

                {gpsEnabled && (
                  <div style={{ marginLeft: 46 }}>
                    {/* Busca de local por nome */}
                    <div style={{ marginBottom: 12 }}>
                      <label className="form-label">Nome do local (aparece nos relatórios)</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          className="form-input"
                          value={placeQuery || form['COMPANY_LOCATION_NAME'] || ''}
                          onChange={e => { setPlaceQuery(e.target.value); setForm(f => ({ ...f, COMPANY_LOCATION_NAME: e.target.value })) }}
                          onKeyDown={e => e.key === 'Enter' && handlePlaceSearch()}
                          placeholder="Ex: Empresa XYZ, Av. Paulista 1234, São Paulo"
                        />
                        <button className="btn-ghost" onClick={handlePlaceSearch} disabled={placeLoading}
                          style={{ padding: '8px 14px', flexShrink: 0 }}>
                          {placeLoading ? '...' : '🔍 Buscar'}
                        </button>
                      </div>
                      {placeResults.length > 0 && (
                        <div style={{
                          border: 'var(--mg-border)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--mg-surface)', marginTop: 4, overflow: 'hidden',
                        }}>
                          {placeResults.map((p, i) => (
                            <button key={i} onClick={() => handlePlaceSelect(p)}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left',
                                padding: '8px 12px', fontSize: 12, color: 'var(--mg-white)',
                                background: 'none', border: 'none', cursor: 'pointer',
                                borderBottom: i < placeResults.length - 1 ? 'var(--mg-border)' : 'none',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              {p.display_name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 4 }}>
                        Busque pelo endereço para preencher as coordenadas automaticamente, ou insira o nome manualmente.
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px', gap: 10, alignItems: 'end', marginBottom: 8 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Latitude</label>
                        <input className="form-input" value={form['COMPANY_LAT'] ?? ''}
                          onChange={e => set('COMPANY_LAT', e.target.value)}
                          placeholder="-19.9191" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Longitude</label>
                        <input className="form-input" value={form['COMPANY_LONG'] ?? ''}
                          onChange={e => set('COMPANY_LONG', e.target.value)}
                          placeholder="-43.9386" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Raio (metros)</label>
                        <input className="form-input" type="number" min={10}
                          value={form['ALLOWED_RADIUS_METERS'] ?? '100'}
                          onChange={e => set('ALLOWED_RADIUS_METERS', e.target.value)} />
                      </div>
                    </div>
                    <button
                      className="btn-ghost"
                      onClick={handleGetLocation}
                      disabled={locLoading}
                      style={{ padding: '8px 14px', fontSize: 12, marginBottom: 8 }}
                    >
                      {locLoading ? 'Obtendo...' : '📍 Usar localização atual do browser'}
                    </button>

                    {locError && (
                      <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 8 }}>{locError}</div>
                    )}
                    {form['COMPANY_LAT'] && form['COMPANY_LONG'] && (
                      <div style={{ fontSize: 11, color: 'var(--mg-muted)' }}>
                        Coordenadas salvas: {form['COMPANY_LAT']}, {form['COMPANY_LONG']}
                        {' '}— raio de {form['ALLOWED_RADIUS_METERS'] ?? 100}m
                      </div>
                    )}
                    {(!form['COMPANY_LAT'] || !form['COMPANY_LONG']) && (
                      <div style={{ fontSize: 11, color: 'var(--mg-gold)' }}>
                        ⚠ Nenhuma coordenada configurada — GPS não validará
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status resumido */}
              {(wifiEnabled || gpsEnabled) && (
                <div style={{
                  marginTop: 16, paddingTop: 14, borderTop: 'var(--mg-border)',
                  fontSize: 11, color: 'var(--mg-muted)', lineHeight: 1.7,
                }}>
                  <strong style={{ color: 'var(--mg-white)', fontSize: 12 }}>Fluxo de validação:</strong>
                  {wifiEnabled && <div>1. Wi-Fi: verifica BSSID — autorizado → ponto liberado; não autorizado → {strictMode ? 'bloqueado' : 'registrado como WIFI_DESCONHECIDO'}</div>}
                  {gpsEnabled  && <div>{wifiEnabled ? '2.' : '1.'} GPS: {form['COMPANY_LAT'] ? `raio de ${form['ALLOWED_RADIUS_METERS'] ?? 100}m — fora → ${strictMode ? 'bloqueado' : 'registrado como FORA_DO_LOCAL'}` : 'coordenadas não configuradas (ignorado)'}</div>}
                  {!wifiEnabled && !gpsEnabled && <div>Nenhuma validação ativa — todos os pontos são aprovados.</div>}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Aprovação de correções ────────────────────────────────────── */}
        {tab === 'aprovacoes' && (
          <div className="card">
            <div className="section-title">Aprovação de correções de ponto</div>

            <div className="form-group">
              <label className="form-label">Modo de aprovação</label>
              <select
                className="form-input"
                value={form['CORRECTIONS_APPROVAL_MODE'] ?? 'disabled'}
                onChange={e => set('CORRECTIONS_APPROVAL_MODE', e.target.value)}
                style={{ maxWidth: 360 }}
              >
                <option value="disabled">Livre — qualquer gestor com permissão aprova tudo</option>
                <option value="by_sector">Por setor — coordenador aprova apenas seu setor</option>
              </select>
            </div>

            {(form['CORRECTIONS_APPROVAL_MODE'] ?? 'disabled') === 'by_sector' && (
              <div style={{
                fontSize: 12, color: 'var(--mg-muted)', lineHeight: 1.6,
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'rgba(201,150,12,0.06)', border: '0.5px solid rgba(201,150,12,0.2)',
              }}>
                <strong style={{ color: 'var(--mg-gold)' }}>Modo por setor ativo.</strong>
                {' '}Usuários definidos como coordenador ou assistente de um setor só podem aprovar correções
                dos funcionários daquele setor. Usuários com permissão "Correções (aprovar)" que <em>não</em> são
                coordenadores de nenhum setor funcionam como aprovadores globais (ex.: RH).
                Usuários com permissão "Correções (somente leitura)" visualizam tudo sem poder agir.
              </div>
            )}
          </div>
        )}

        {/* ── Notificações ──────────────────────────────────────────────── */}
        {tab === 'notificacoes' && (
          <div className="card">
            <div className="section-title">Notificações</div>
            <ToggleRow
              checked={form['WHATSAPP_WEEKLY'] === 'true'}
              onChange={v => set('WHATSAPP_WEEKLY', v)}
              label="Resumo semanal via WhatsApp (sexta às 17h)"
            />
            {form['WHATSAPP_WEEKLY'] === 'true' && (
              <div className="form-group" style={{ marginLeft: 46, marginBottom: 20, maxWidth: 260 }}>
                <label className="form-label">Número de WhatsApp (com DDD e país)</label>
                <input className="form-input" type="text" placeholder="5511999999999"
                  value={form['WHATSAPP_NUMBER'] ?? ''}
                  onChange={e => set('WHATSAPP_NUMBER', e.target.value.trim())} />
              </div>
            )}
            <ToggleRow
              checked={form['EMAIL_MONTHLY'] === 'true'}
              onChange={v => set('EMAIL_MONTHLY', v)}
              label="Relatório mensal via e-mail (dia 1 às 8h)"
            />
          </div>
        )}

        {/* ── Auto-cadastro ─────────────────────────────────────────────── */}
        {tab === 'cadastro' && (
          <div className="card">
            <div className="section-title">Auto-cadastro de funcionários</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Domínio de e-mail permitido</label>
              <input className="form-input" type="text" placeholder="suaempresa.com.br"
                value={form['REGISTRATION_EMAIL_DOMAIN'] ?? ''}
                onChange={e => set('REGISTRATION_EMAIL_DOMAIN', e.target.value.trim())}
                style={{ maxWidth: 320 }} />
              <div style={{ fontSize: 11, color: 'var(--mg-muted)', marginTop: 6, lineHeight: 1.5 }}>
                Só e-mails deste domínio poderão se cadastrar pelo link de auto-cadastro (ex: <code>suaempresa.com.br</code>, sem o @).{' '}
                <strong style={{ color: 'var(--mg-white)' }}>Em branco = auto-cadastro desabilitado</strong> — configure antes de distribuir o link.
              </div>
            </div>
          </div>
        )}

        {/* ── Kiosk ─────────────────────────────────────────────────────── */}
        {tab === 'kiosk' && (
          <div className="card">
            <div className="section-title">Kiosk</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mg-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Anti-spoofing
              </div>
              <ToggleRow
                checked={form['CHALLENGE_ENABLED'] !== 'false'}
                onChange={v => set('CHALLENGE_ENABLED', v)}
                label="Desafio de vivacidade (movimento)"
                description={
                  form['CHALLENGE_ENABLED'] !== 'false'
                    ? 'Funcionário precisa virar a cabeça em 2 direções ao bater o ponto. Impede uso de foto.'
                    : 'Desativado — captura frontal direta. Recomendado quando câmera tem dificuldade de detectar rostos.'
                }
              />
              {form['CHALLENGE_ENABLED'] !== 'false' && (
                <div className="form-group" style={{ marginLeft: 46, marginBottom: 0 }}>
                  <label className="form-label">Ângulo mínimo de rotação (°)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      className="form-input" type="range" min={5} max={45} step={5}
                      value={form['CHALLENGE_MIN_ANGLE'] ?? '15'}
                      onChange={e => set('CHALLENGE_MIN_ANGLE', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--mg-gold)', minWidth: 36, textAlign: 'right' }}>
                      {form['CHALLENGE_MIN_ANGLE'] ?? '15'}°
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mg-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Modo de captura
              </div>
              <ToggleRow
                checked={form['KIOSK_AUTO_CAPTURE'] === 'true'}
                onChange={v => set('KIOSK_AUTO_CAPTURE', v)}
                label="Captura automática"
                description={
                  form['KIOSK_AUTO_CAPTURE'] === 'true'
                    ? 'O kiosk detecta o rosto e registra automaticamente após o tempo configurado'
                    : 'O funcionário pressiona o botão "Bater ponto" manualmente'
                }
              />
              {form['KIOSK_AUTO_CAPTURE'] === 'true' && (
                <div className="form-group" style={{ marginLeft: 46, marginBottom: 0 }}>
                  <label className="form-label">Tempo com rosto enquadrado antes de registrar (s)</label>
                  <input
                    className="form-input" type="number" min={1} max={10}
                    value={form['KIOSK_AUTO_CAPTURE_DELAY'] ?? '3'}
                    onChange={e => set('KIOSK_AUTO_CAPTURE_DELAY', e.target.value)}
                    style={{ maxWidth: 80 }}
                  />
                </div>
              )}
            </div>

            <div style={{ borderTop: 'var(--mg-border)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--mg-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Chave de API
              </div>
              <p style={{ fontSize: 13, color: 'var(--mg-muted)', marginBottom: 12 }}>
                Usada pelo kiosk para autenticar batidas de ponto.
              </p>
              {kioskKey && (
                <div style={{
                  background: 'var(--mg-gold-dim)', border: '0.5px solid var(--mg-gold-border)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 12,
                  fontFamily: 'monospace', marginBottom: 12, wordBreak: 'break-all', color: 'var(--mg-gold)',
                }}>
                  {kioskKey}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={handleGenKey} disabled={genKeyMutation.isPending}>
                  Gerar nova chave
                </button>
                <button className="btn-danger" onClick={() => revokeKeyMutation.mutate()} disabled={revokeKeyMutation.isPending}>
                  Revogar chave
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Setores ───────────────────────────────────────────────────── */}
        {tab === 'setores' && <SectorsTab employees={employees} />}

        {/* ── CCT ───────────────────────────────────────────────────────── */}
        {tab === 'cct' && <CctTab />}

      </div>
    </div>
  )
}
