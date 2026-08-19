import { useMemo, useState } from 'react';
import { X, Info } from 'lucide-react';
import logoHeader from '@comissao/assets/logo-header.png';
import logoFooter from '@comissao/assets/logo-footer.png';
import { calculateOvertimeFromBase, formatCurrency, parseLocaleFloat, ValidationError, type OvertimeResult } from '@comissao/lib/calculator';
import { appendRecord, loadRecords, summarizeRecords, type OvertimeRecord } from '@comissao/lib/storage';

type LogEntry = { message: string; isError: boolean };

const initialForm = {
  nome: '',
  base: '',
  horasMes: '220',
  percentual: '150',
  horasExtras: '',
};

export default function CalculoComissaoApp() {
  const [tab, setTab] = useState<'calculadora' | 'relatorios'>('calculadora');
  const [form, setForm] = useState(initialForm);
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<OvertimeResult | null>(null);
  const [log, setLog] = useState<LogEntry[]>([{ message: 'Os detalhes dos cálculos aparecerão aqui.', isError: false }]);
  const [mostrarRegras, setMostrarRegras] = useState(false);
  const [busca, setBusca] = useState('');
  const [records, setRecords] = useState<OvertimeRecord[]>(() => loadRecords());

  const setField = (field: keyof typeof initialForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCalcular = () => {
    setErroCampo(null);

    if (!form.nome.trim()) {
      setErroCampo('nome');
      setLog((l) => [{ message: 'Informe o nome do colaborador.', isError: true }, ...l]);
      return;
    }
    for (const [field, label] of [
      ['base', 'a Base de Cálculo'],
      ['horasMes', 'as Horas do Mês'],
      ['percentual', 'o Percentual da Rubrica'],
      ['horasExtras', 'as Horas Extras'],
    ] as const) {
      if (!form[field].trim()) {
        setErroCampo(field);
        setLog((l) => [{ message: `Informe ${label}.`, isError: true }, ...l]);
        return;
      }
    }

    try {
      const result = calculateOvertimeFromBase(
        form.nome.trim(),
        parseLocaleFloat(form.base),
        parseLocaleFloat(form.horasMes),
        parseLocaleFloat(form.horasExtras),
        parseLocaleFloat(form.percentual)
      );
      setResultado(result);
      appendRecord(result);
      setRecords(loadRecords());
      setLog((l) => [
        {
          message: `${result.employeeName}: base ${formatCurrency(result.baseAmount)}, hora base ${formatCurrency(result.hourlyBase, 4)}, HE ${result.overtimeRatePercent.toFixed(0)}% × ${result.overtimeHours.toFixed(2)}h → total ${formatCurrency(result.overtimeTotal)}`,
          isError: false,
        },
        ...l,
      ]);
    } catch (e) {
      const message = e instanceof ValidationError ? e.message : 'Ocorreu um erro inesperado no cálculo.';
      setLog((l) => [{ message, isError: true }, ...l]);
    }
  };

  const handleNovoCalculo = () => {
    setForm(initialForm);
    setErroCampo(null);
    setResultado(null);
    setLog([{ message: 'Os detalhes dos cálculos aparecerão aqui.', isError: false }]);
  };

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? records.filter((r) => r.employeeName.toLowerCase().includes(termo)) : records;
  }, [records, busca]);

  const resumo = useMemo(() => summarizeRecords(registrosFiltrados), [registrosFiltrados]);

  const inputClass = (field: keyof typeof initialForm) =>
    `w-full rounded-[10px] border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${
      erroCampo === field ? 'border-destructive' : 'border-input-border'
    }`;

  return (
    <div className="comissao-root min-h-screen bg-background flex items-center justify-center py-8 px-4">
      <div className="w-full max-w-[860px] rounded-[22px] bg-card p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-1 mb-4">
          <img src={logoHeader} alt="Mendonça Galvão" className="h-16 w-auto object-contain mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Cálculo Comissional</h1>
          <p className="text-sm text-muted-foreground">
            Calculadora de Horas Extras por base de rubrica (Memória de Cálculo).
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-full bg-[#181818] p-1 mb-4">
          <button
            type="button"
            onClick={() => setTab('calculadora')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
              tab === 'calculadora' ? 'bg-[#262626] text-primary' : 'text-muted-foreground hover:bg-[#202020]'
            }`}
          >
            Calculadora
          </button>
          <button
            type="button"
            onClick={() => setTab('relatorios')}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
              tab === 'relatorios' ? 'bg-[#262626] text-primary' : 'text-muted-foreground hover:bg-[#202020]'
            }`}
          >
            Relatórios
          </button>
        </div>

        {tab === 'calculadora' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
              {/* Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Nome do Colaborador</label>
                  <input
                    className={inputClass('nome')}
                    placeholder="Digite o nome completo"
                    value={form.nome}
                    onChange={(e) => setField('nome', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Base de Cálculo (R$)</label>
                  <input
                    className={inputClass('base')}
                    placeholder="Ex: 2738,70"
                    value={form.base}
                    onChange={(e) => setField('base', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Horas do Mês</label>
                  <input
                    className={inputClass('horasMes')}
                    placeholder="Ex: 220"
                    value={form.horasMes}
                    onChange={(e) => setField('horasMes', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Percentual da Rubrica (%)</label>
                  <input
                    className={inputClass('percentual')}
                    placeholder="Ex: 150"
                    value={form.percentual}
                    onChange={(e) => setField('percentual', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Horas Extras</label>
                  <input
                    className={inputClass('horasExtras')}
                    placeholder="Ex: 20"
                    value={form.horasExtras}
                    onChange={(e) => setField('horasExtras', e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Cálculo segue a Memória de Cálculo de Rubricas (base / horas × %).
                  </p>
                  <button
                    type="button"
                    onClick={() => setMostrarRegras(true)}
                    className="shrink-0 text-xs font-medium text-primary hover:bg-[#2A2A2A] rounded-md px-2 py-1"
                  >
                    Ver Regras
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCalcular}
                    className="flex-1 h-9 rounded-md bg-input text-sm text-foreground hover:bg-[#2A2A2A] transition-colors"
                  >
                    Calcular
                  </button>
                  <button
                    type="button"
                    onClick={handleNovoCalculo}
                    className="flex-1 h-9 rounded-md bg-primary text-sm font-semibold text-[#111111] hover:bg-primary-hover transition-colors"
                    title="Limpa todos os campos, resumo e log."
                  >
                    Novo Cálculo
                  </button>
                </div>
              </div>

              {/* Log */}
              <div className="rounded-[14px] bg-card-secondary p-3 flex flex-col min-h-[220px]">
                <h3 className="text-sm font-bold text-foreground mb-2">Log de Cálculo</h3>
                <div className="flex-1 overflow-y-auto rounded-md bg-[#111111] p-3 space-y-1.5 text-[11px] leading-relaxed">
                  {log.map((entry, i) => (
                    <p key={i} className={entry.isError ? 'text-[#ff6666]' : 'text-muted-foreground'}>
                      {entry.message}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumo */}
            <div className="rounded-2xl bg-[#202020] p-4">
              <h3 className="text-center text-[15px] font-bold text-foreground mb-2">Resumo do Cálculo</h3>
              <div className="h-px bg-[#333333] mb-2" />
              <p className="text-sm text-foreground py-0.5">
                Hora Base: {resultado ? formatCurrency(resultado.hourlyBase, 4) : '-'}
              </p>
              <p className="text-sm text-foreground py-0.5">
                {resultado
                  ? `Valor da Hora Extra (${resultado.overtimeRatePercent.toFixed(0)}%): ${formatCurrency(resultado.hourlyOvertime, 4)}`
                  : 'Valor da Hora Extra: -'}
              </p>
              <p className="text-[13px] font-bold text-primary py-0.5">
                {resultado
                  ? `Total de Horas Extras (${resultado.overtimeHours.toFixed(2)}h): ${formatCurrency(resultado.overtimeTotal)}`
                  : 'Total de Horas Extras: -'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-[15px] font-bold text-foreground">Relatórios de Horas Extras</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtrar por nome:</span>
              <input
                className="w-52 rounded-lg border border-input-border bg-input px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Nome contém..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="rounded-lg bg-[#151515] overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#303030]">
                  <tr>
                    {['Data/Hora', 'Nome', 'Horas HE', 'Hora Base', '% HE', 'Base (R$)', 'Total HE'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-bold text-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                        Nenhum registro encontrado.
                      </td>
                    </tr>
                  ) : (
                    registrosFiltrados.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="px-3 py-1.5 whitespace-nowrap text-foreground">
                          {new Date(r.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-1.5 text-foreground">{r.employeeName}</td>
                        <td className="px-3 py-1.5 text-center text-foreground">{r.overtimeHours.toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right text-foreground">{formatCurrency(r.hourlyBase, 4)}</td>
                        <td className="px-3 py-1.5 text-center text-foreground">{r.overtimeRatePercent.toFixed(2)}%</td>
                        <td className="px-3 py-1.5 text-right text-foreground">{formatCurrency(r.baseAmount)}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-primary">{formatCurrency(r.overtimeTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Registros: {resumo.count} | Total de Horas Extras: {resumo.totalOvertimeHours.toFixed(2)}h | Total Pago em HE: {formatCurrency(resumo.totalOvertimeValue)}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-center pt-4">
          <img src={logoFooter} alt="Núcleo Digital" className="h-8 w-auto object-contain opacity-80" />
        </div>
      </div>

      {/* Regras modal */}
      {mostrarRegras && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMostrarRegras(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Regras de Cálculo
              </h3>
              <button type="button" onClick={() => setMostrarRegras(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p>Lógica baseada na Memória de Cálculo de Rubricas:</p>
              <p>1) Base de Cálculo = soma dos proventos que entram na rubrica (ex.: triênios, comissões, complementos).</p>
              <p>2) Hora Base = Base de Cálculo ÷ Horas do Mês (ex.: 220).</p>
              <p>3) Valor da Hora Extra = Hora Base × (Percentual da rubrica ÷ 100).</p>
              <p className="pl-3">• HE 50% → 150% da hora (ex.: 150).<br />• HE 100% → 200% da hora (ex.: 200).</p>
              <p>4) Total de Horas Extras = Valor da Hora Extra × Horas Extras.</p>
            </div>
            <button
              type="button"
              onClick={() => setMostrarRegras(false)}
              className="mt-4 w-full h-9 rounded-md bg-primary text-sm font-semibold text-[#111111] hover:bg-primary-hover transition-colors"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
