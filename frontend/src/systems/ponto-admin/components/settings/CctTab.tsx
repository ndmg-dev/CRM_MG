import { useState } from 'react'
import { Modal } from '../Modal'
import {
  useCctCategories, useCreateCctCategory,
  useCctParameterSets, useCreateCctParameterSet,
  type CctParameterSetCreate, type DsrLossRule, type FtmarHandling,
} from '../../hooks/useCct'

// Valores típicos de CLT usados só como ponto de partida do formulário — o
// admin ajusta conforme a CCT real da categoria.
const DEFAULT_SET: CctParameterSetCreate = {
  effective_from: new Date().toLocaleDateString('en-CA'),
  effective_until: null,
  weekly_hours: 44,
  work_days_per_week: 6,
  lunch_break_minutes_gt6h: 60,
  lunch_break_minutes_4to6h: 15,
  interval_reduction_allowed: false,
  interval_reduction_minimum: null,
  tolerance_per_punch_minutes: 5,
  tolerance_daily_max_minutes: 10,
  night_shift_start: '22:00',
  night_shift_end: '05:00',
  night_shift_percent: 20,
  night_shift_prorogation: false,
  overtime_weekday_percent: 50,
  overtime_sunday_holiday_percent: 100,
  holiday_worked_rule: 'em_dobro',
  time_bank_enabled: false,
  time_bank_compensation_months: null,
  dsr_loss_rule: 'falta_ou_atraso',
  rounding_rule: 'ao_minuto',
  ftmar_handling: 'pendencia_manual',
}

const DSR_LOSS_OPTIONS: { value: DsrLossRule; label: string }[] = [
  { value: 'falta_ou_atraso',      label: 'Falta ou atraso perde o DSR' },
  { value: 'apenas_falta_integral', label: 'Só falta integral perde o DSR' },
]

const FTMAR_OPTIONS: { value: FtmarHandling; label: string }[] = [
  { value: 'pendencia_manual',           label: 'Vira pendência manual (RH decide)' },
  { value: 'falta_parcial_automatica',   label: 'Vira falta parcial automática' },
]

function fmtDate(d: string | null) {
  if (!d) return 'atual'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function CctTab() {
  const { data: categories = [], isLoading } = useCctCategories()
  const createCategory = useCreateCctCategory()

  const [selectedId, setSelectedId] = useState('')
  const activeId = selectedId || categories[0]?.id || ''
  const activeCategory = categories.find(c => c.id === activeId) ?? null

  const { data: parameterSets = [], isLoading: loadingSets } = useCctParameterSets(activeId || null)
  const createSet = useCreateCctParameterSet(activeId || null)

  const [categoryModal, setCategoryModal] = useState(false)
  const [categoryForm, setCategoryForm] = useState({ name: '', union_reference: '' })
  const [categoryErr, setCategoryErr] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  const [setModal, setSetModal] = useState(false)
  const [setForm, setSetForm] = useState<CctParameterSetCreate>(DEFAULT_SET)
  const [setErr, setSetErr] = useState('')
  const [savingSet, setSavingSet] = useState(false)

  function openCategoryModal() {
    setCategoryForm({ name: '', union_reference: '' })
    setCategoryErr('')
    setCategoryModal(true)
  }

  async function handleSaveCategory() {
    if (!categoryForm.name.trim()) { setCategoryErr('Nome é obrigatório'); return }
    setSavingCategory(true); setCategoryErr('')
    try {
      const created = await createCategory.mutateAsync({
        name: categoryForm.name.trim(),
        union_reference: categoryForm.union_reference.trim() || null,
      })
      setSelectedId(created.id)
      setCategoryModal(false)
    } catch (e) {
      setCategoryErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingCategory(false)
    }
  }

  function openSetModal() {
    setSetForm(DEFAULT_SET)
    setSetErr('')
    setSetModal(true)
  }

  async function handleSaveSet() {
    if (!setForm.effective_from) { setSetErr('Informe o início da vigência'); return }
    if (setForm.effective_until && setForm.effective_until < setForm.effective_from) {
      setSetErr('Fim da vigência não pode ser antes do início'); return
    }
    setSavingSet(true); setSetErr('')
    try {
      await createSet.mutateAsync(setForm)
      setSetModal(false)
    } catch (e) {
      setSetErr(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingSet(false)
    }
  }

  function set<K extends keyof CctParameterSetCreate>(key: K, value: CctParameterSetCreate[K]) {
    setSetForm(f => ({ ...f, [key]: value }))
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" onClick={openCategoryModal}>+ Nova categoria</button>
      </div>

      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--mg-muted)' }}>Carregando...</div>
      )}

      {!isLoading && categories.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--mg-muted)' }}>
          Nenhuma categoria de CCT cadastrada. Crie uma categoria (ex.: "Comerciários", "Administrativo")
          e depois registre a(s) vigência(s) de parâmetros dela.
        </div>
      )}

      {!isLoading && categories.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <select
                className="form-input"
                value={activeId}
                onChange={e => setSelectedId(e.target.value)}
                style={{ fontSize: 14, fontWeight: 500, maxWidth: 360, flex: '1 1 200px' }}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.union_reference ? ` — ${c.union_reference}` : ''}
                  </option>
                ))}
              </select>
              {activeCategory && (
                <button className="btn-primary" style={{ fontSize: 12, padding: '4px 12px', marginLeft: 'auto' }}
                  onClick={openSetModal}>
                  + Nova vigência
                </button>
              )}
            </div>
          </div>

          {activeCategory && (
            <div className="card">
              <div className="section-title">Histórico de vigências</div>
              <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Uma vigência nunca é editada depois de criada — corrigir um valor sempre cria uma
                vigência nova, pra não alterar silenciosamente o cálculo de um período já fechado.
              </div>

              {loadingSets && <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: 20 }}>Carregando...</div>}

              {!loadingSets && parameterSets.length === 0 && (
                <div style={{ color: 'var(--mg-muted)', textAlign: 'center', padding: '20px 0', fontSize: 13 }}>
                  Nenhuma vigência cadastrada ainda para esta categoria.
                </div>
              )}

              {!loadingSets && parameterSets.length > 0 && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Vigência</th>
                      <th>Carga semanal</th>
                      <th>Dias/semana</th>
                      <th>Feriado trabalhado</th>
                      <th>Perda de DSR</th>
                      <th>FTMAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parameterSets.map(ps => (
                      <tr key={ps.id}>
                        <td style={{ fontSize: 12 }}>{fmtDate(ps.effective_from)} – {fmtDate(ps.effective_until)}</td>
                        <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>{ps.weekly_hours}h</td>
                        <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>{ps.work_days_per_week}</td>
                        <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>{ps.holiday_worked_rule === 'em_dobro' ? 'Em dobro' : ps.holiday_worked_rule}</td>
                        <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>
                          {DSR_LOSS_OPTIONS.find(o => o.value === ps.dsr_loss_rule)?.label ?? ps.dsr_loss_rule}
                        </td>
                        <td style={{ color: 'var(--mg-muted)', fontSize: 12 }}>
                          {FTMAR_OPTIONS.find(o => o.value === ps.ftmar_handling)?.label ?? ps.ftmar_handling}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal nova categoria */}
      <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="Nova categoria de CCT" maxWidth={420}>
        <div className="form-group">
          <label className="form-label">Nome</label>
          <input className="form-input" autoFocus value={categoryForm.name}
            onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Comerciários" />
        </div>
        <div className="form-group">
          <label className="form-label">Referência do sindicato (opcional)</label>
          <input className="form-input" value={categoryForm.union_reference}
            onChange={e => setCategoryForm(f => ({ ...f, union_reference: e.target.value }))}
            placeholder="Ex: SINTRAJUD-SP" />
        </div>
        {categoryErr && <div style={{ fontSize: 12, color: 'var(--mg-red)', marginBottom: 12 }}>{categoryErr}</div>}
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => setCategoryModal(false)}>Cancelar</button>
          <button className="btn-primary" disabled={savingCategory} onClick={handleSaveCategory}>
            {savingCategory ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </Modal>

      {/* Modal nova vigência */}
      <Modal open={setModal} onClose={() => setSetModal(false)} title={`Nova vigência — ${activeCategory?.name ?? ''}`} maxWidth={620}>
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>

          <div className="section-title" style={{ fontSize: 12 }}>Vigência</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Início</label>
              <input className="form-input" type="date" value={setForm.effective_from}
                onChange={e => set('effective_from', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fim (vazio = vigente)</label>
              <input className="form-input" type="date" value={setForm.effective_until ?? ''}
                onChange={e => set('effective_until', e.target.value || null)} />
            </div>
          </div>

          <div className="section-title" style={{ fontSize: 12 }}>Jornada</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Carga horária semanal</label>
              <input className="form-input" type="number" min={1} value={setForm.weekly_hours}
                onChange={e => set('weekly_hours', parseInt(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dias de trabalho por semana</label>
              <input className="form-input" type="number" min={1} max={7} value={setForm.work_days_per_week}
                onChange={e => set('work_days_per_week', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="section-title" style={{ fontSize: 12 }}>Intervalo (almoço)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Minutos — jornada &gt; 6h</label>
              <input className="form-input" type="number" min={0} value={setForm.lunch_break_minutes_gt6h}
                onChange={e => set('lunch_break_minutes_gt6h', parseInt(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Minutos — jornada 4-6h</label>
              <input className="form-input" type="number" min={0} value={setForm.lunch_break_minutes_4to6h}
                onChange={e => set('lunch_break_minutes_4to6h', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={setForm.interval_reduction_allowed}
              onChange={e => set('interval_reduction_allowed', e.target.checked)} />
            <span className="form-label" style={{ margin: 0 }}>Permite redução do intervalo (acordo/convenção)</span>
          </label>
          {setForm.interval_reduction_allowed && (
            <div className="form-group" style={{ marginBottom: 16, marginLeft: 26, maxWidth: 220 }}>
              <label className="form-label">Mínimo permitido (min)</label>
              <input className="form-input" type="number" min={0} value={setForm.interval_reduction_minimum ?? ''}
                onChange={e => set('interval_reduction_minimum', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          )}

          <div className="section-title" style={{ fontSize: 12 }}>Tolerância</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Por batida (min)</label>
              <input className="form-input" type="number" min={0} value={setForm.tolerance_per_punch_minutes}
                onChange={e => set('tolerance_per_punch_minutes', parseInt(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Máximo diário acumulado (min)</label>
              <input className="form-input" type="number" min={0} value={setForm.tolerance_daily_max_minutes}
                onChange={e => set('tolerance_daily_max_minutes', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className="section-title" style={{ fontSize: 12 }}>Adicional noturno</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Início</label>
              <input className="form-input" type="time" value={setForm.night_shift_start}
                onChange={e => set('night_shift_start', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Fim</label>
              <input className="form-input" type="time" value={setForm.night_shift_end}
                onChange={e => set('night_shift_end', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Percentual (%)</label>
              <input className="form-input" type="number" min={0} step="0.1" value={setForm.night_shift_percent}
                onChange={e => set('night_shift_percent', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
            <input type="checkbox" checked={setForm.night_shift_prorogation}
              onChange={e => set('night_shift_prorogation', e.target.checked)} />
            <span className="form-label" style={{ margin: 0 }}>Prorrogação da hora noturna reduzida</span>
          </label>

          <div className="section-title" style={{ fontSize: 12 }}>Horas extras</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Dia útil (%)</label>
              <input className="form-input" type="number" min={0} step="0.1" value={setForm.overtime_weekday_percent}
                onChange={e => set('overtime_weekday_percent', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Domingo/feriado (%)</label>
              <input className="form-input" type="number" min={0} step="0.1" value={setForm.overtime_sunday_holiday_percent}
                onChange={e => set('overtime_sunday_holiday_percent', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          <div className="section-title" style={{ fontSize: 12 }}>Banco de horas</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={setForm.time_bank_enabled}
              onChange={e => set('time_bank_enabled', e.target.checked)} />
            <span className="form-label" style={{ margin: 0 }}>Banco de horas habilitado</span>
          </label>
          {setForm.time_bank_enabled && (
            <div className="form-group" style={{ marginBottom: 16, marginLeft: 26, maxWidth: 220 }}>
              <label className="form-label">Prazo de compensação (meses)</label>
              <input className="form-input" type="number" min={1} value={setForm.time_bank_compensation_months ?? ''}
                onChange={e => set('time_bank_compensation_months', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          )}

          <div className="section-title" style={{ fontSize: 12 }}>Regras</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Feriado trabalhado</label>
              <select className="form-input" value={setForm.holiday_worked_rule} disabled>
                <option value="em_dobro">Em dobro</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Arredondamento</label>
              <select className="form-input" value={setForm.rounding_rule} disabled>
                <option value="ao_minuto">Ao minuto</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Perda de DSR</label>
              <select className="form-input" value={setForm.dsr_loss_rule}
                onChange={e => set('dsr_loss_rule', e.target.value as DsrLossRule)}>
                {DSR_LOSS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Falta parcial não justificada (FTMAR)</label>
              <select className="form-input" value={setForm.ftmar_handling}
                onChange={e => set('ftmar_handling', e.target.value as FtmarHandling)}>
                {FTMAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {setErr && <div style={{ fontSize: 12, color: 'var(--mg-red)', margin: '4px 0 12px' }}>{setErr}</div>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => setSetModal(false)}>Cancelar</button>
          <button className="btn-primary" disabled={savingSet} onClick={handleSaveSet}>
            {savingSet ? 'Salvando...' : 'Salvar vigência'}
          </button>
        </div>
      </Modal>
    </>
  )
}
