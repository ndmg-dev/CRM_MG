import { useState, useCallback } from 'react';
import { User, FileDown, Square, CheckSquare } from 'lucide-react';
import { formatCurrency, formatCPF, formatPercent } from '@adiantamento/lib/payroll-calc';
import { generateSingleReceiptPdf } from '@adiantamento/lib/pdf-generator';
import { AuditFormulaRow } from './AuditFormulaRow';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { EmployeeAdvance, EmployeePayroll, CalcConfig } from '@adiantamento/lib/types';

interface EmployeeAdvanceCardProps {
  employee: EmployeeAdvance;
  competencia: string;
  config: CalcConfig;
  onUpdate: (updated: EmployeePayroll) => void;
  onToggleSelect: (id: string) => void;
}

type EditableFieldKey = 'liquido' | 'proventos' | 'descAdiantamento' | 'bruto' | 'planoSaude' | 'inss' | 'irrf';

export function EmployeeAdvanceCard({ employee, competencia, config, onUpdate, onToggleSelect }: EmployeeAdvanceCardProps) {
  const [editingField, setEditingField] = useState<EditableFieldKey | null>(null);

  const handleChange = useCallback((field: EditableFieldKey, raw: string) => {
    const val = parseFloat(raw) || 0;
    const newEdited = new Set(employee.editedFields);
    newEdited.add(field);
    const newOrigins = { ...employee.fieldOrigins, [field]: 'manual' as const };
    const updated: EmployeePayroll = { ...employee, [field]: val, editedFields: newEdited, fieldOrigins: newOrigins };
    onUpdate(updated);
  }, [employee, onUpdate]);

  const isPe = config.baseMode === 'pe';


  const hasEdits = employee.editedFields.size > 0;
  const borderClass = employee.confidence === 'missing'
    ? 'border-red-400/15'
    : employee.confidence === 'review'
      ? 'border-amber-400/15'
      : '';

  return (
    <div className={`glass-panel rounded-2xl p-5 premium-shadow transition-all duration-300 hover:gold-glow group ${borderClass}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleSelect(employee.id)}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            {employee.selected
              ? <CheckSquare className="h-5 w-5 text-primary" />
              : <Square className="h-5 w-5" />
            }
          </button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">{employee.nome}</h4>
            <p className="text-xs text-muted-foreground">CPF: {formatCPF(employee.cpf)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConfidenceBadge level={employee.confidence} />
          {hasEdits && (
            <span className="text-[10px] font-medium text-amber-400/70 border border-amber-400/15 rounded-lg px-2 py-0.5">
              Editado
            </span>
          )}
        </div>
      </div>

      <div className={`grid gap-3 mb-4 ${isPe ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'}`}>
        {isPe ? (
          <>
            <EditableField
              label="Bruto"
              value={employee.bruto}
              origin={employee.fieldOrigins['bruto']}
              editing={editingField === 'bruto'}
              onEdit={() => setEditingField('bruto')}
              onCommit={(v) => { handleChange('bruto', v); setEditingField(null); }}
            />
            <EditableField
              label="Plano de Saúde"
              value={employee.planoSaude}
              origin={employee.fieldOrigins['planoSaude']}
              editing={editingField === 'planoSaude'}
              onEdit={() => setEditingField('planoSaude')}
              onCommit={(v) => { handleChange('planoSaude', v); setEditingField(null); }}
            />
            <EditableField
              label="INSS"
              value={employee.inss}
              origin={employee.fieldOrigins['inss']}
              editing={editingField === 'inss'}
              onEdit={() => setEditingField('inss')}
              onCommit={(v) => { handleChange('inss', v); setEditingField(null); }}
            />
            <EditableField
              label="IRRF"
              value={employee.irrf}
              origin={employee.fieldOrigins['irrf']}
              editing={editingField === 'irrf'}
              onEdit={() => setEditingField('irrf')}
              onCommit={(v) => { handleChange('irrf', v); setEditingField(null); }}
            />
          </>
        ) : (
          <>
            <EditableField
              label="Líquido"
              value={employee.liquido}
              origin={employee.fieldOrigins['liquido']}
              editing={editingField === 'liquido'}
              onEdit={() => setEditingField('liquido')}
              onCommit={(v) => { handleChange('liquido', v); setEditingField(null); }}
            />
            <EditableField
              label="Total Proventos"
              value={employee.proventos}
              origin={employee.fieldOrigins['proventos']}
              editing={editingField === 'proventos'}
              onEdit={() => setEditingField('proventos')}
              onCommit={(v) => { handleChange('proventos', v); setEditingField(null); }}
            />
          </>
        )}

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-primary font-bold">Adiantamento {formatPercent(config.percent)}</label>
          <div className="rounded-lg px-2 py-1.5 text-sm font-mono font-bold gold-text">
            {formatCurrency(employee.valorAdiantamento)}
          </div>
        </div>
      </div>


      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => generateSingleReceiptPdf(employee, competencia, config)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300 border border-transparent hover:border-primary/15"
        >
          <FileDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Baixar recibo</span>
        </button>
      </div>

      <AuditFormulaRow employee={employee} config={config} />
    </div>
  );
}

interface EditableFieldProps {
  label: string;
  value: number;
  origin?: string;
  editing: boolean;
  onEdit: () => void;
  onCommit: (raw: string) => void;
}

function EditableField({ label, value, origin, editing, onEdit, onCommit }: EditableFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
        {origin && (
          <span className={`text-[8px] font-mono ${origin === 'manual' ? 'text-amber-400/60' : 'text-emerald-400/50'}`}>
            {origin === 'manual' ? '✎' : '⬇'}
          </span>
        )}
      </div>
      {editing ? (
        <input
          type="number"
          step="0.01"
          defaultValue={value.toFixed(2)}
          onBlur={(e) => onCommit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          autoFocus
          className="w-full input-glass rounded-lg px-2 py-1.5 text-sm font-mono"
        />
      ) : (
        <button
          onClick={onEdit}
          className="w-full text-left rounded-lg px-2 py-1.5 text-sm font-mono text-foreground hover:bg-primary/5 transition-colors"
        >
          {formatCurrency(value)}
        </button>
      )}
    </div>
  );
}
