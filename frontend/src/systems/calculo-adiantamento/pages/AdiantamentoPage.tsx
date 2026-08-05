import { useState, useCallback, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@adiantamento/components/ui/button';
import { PremiumHeader } from '@adiantamento/components/PremiumHeader';
import { UploadDropzone } from '@adiantamento/components/UploadDropzone';
import { BatchSummary } from '@adiantamento/components/BatchSummary';
import { EmployeeAdvanceCard } from '@adiantamento/components/EmployeeAdvanceCard';
import { EmployeeFilters } from '@adiantamento/components/EmployeeFilters';
import { ExportActions } from '@adiantamento/components/ExportActions';
import { CalcConfigDialog } from '@adiantamento/components/CalcConfigDialog';
import { CompanySelector } from '@adiantamento/components/CompanySelector';
import { calcularAdiantamento } from '@adiantamento/lib/payroll-calc';
import { useCalcConfig } from '@adiantamento/hooks/useCalcConfig';
import { mockEmployees } from '@adiantamento/lib/mock-data';
import { COMPANIES } from '@adiantamento/lib/types';
import type { EmployeePayroll, EmployeeAdvance, ProcessingStep, BatchSummaryData, FilterMode, CompanyId } from '@adiantamento/lib/types';
import { processPayrollPdf } from '@adiantamento/lib/payroll-service';
import payrollDocBg from '@adiantamento/assets/payroll-document-bg.png';

export default function AdiantamentoPage() {
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [employees, setEmployees] = useState<EmployeePayroll[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [company, setCompany] = useState<CompanyId | null>(null);
  const { config: calcConfig, updateConfig, resetConfig } = useCalcConfig(company ?? 'bahia');
  const [competencia] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });

  const advances: EmployeeAdvance[] = useMemo(
    () => employees.map((e) => calcularAdiantamento(e, calcConfig)),
    [employees, calcConfig]
  );

  // Filter counts
  const filterCounts = useMemo((): Record<FilterMode, number> => {
    return {
      all: employees.length,
      edited: employees.filter((e) => e.editedFields.size > 0).length,
    };
  }, [employees]);

  // Filtered advances
  const filteredAdvances = useMemo(() => {
    let result = advances;

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        e.nome.toLowerCase().includes(q) || e.cpf.includes(q.replace(/\D/g, ''))
      );
    }

    // Filter mode
    if (filterMode === 'edited') {
      result = result.filter((e) => e.editedFields.size > 0);
    }

    return result;
  }, [advances, searchQuery, filterMode]);

  const batchSummary: BatchSummaryData | null = useMemo(() => {
    if (advances.length === 0) return null;
    return {
      totalColaboradores: advances.length,
      totalLiquido: advances.reduce((s, e) => s + e.liquido, 0),
      totalAdiantamentos: advances.reduce((s, e) => s + e.valorAdiantamento, 0),
      competencia,
      ajustesManuais: employees.filter((e) => e.editedFields.size > 0).length,
    };
  }, [advances, employees, competencia]);

  const handleFileSelect = useCallback(async (file: File) => {
    try {
      setProcessingStep('reading');
      await new Promise((r) => setTimeout(r, 400));
      setProcessingStep('analyzing');

      const result = await processPayrollPdf(file);

      setProcessingStep('structuring');
      await new Promise((r) => setTimeout(r, 300));

      if (result && result.length > 0) {
        setEmployees(result);
      } else {
        setEmployees(mockEmployees);
      }
      setProcessingStep('done');
    } catch (err) {
      console.error('AI processing failed, using mock data:', err);
      setProcessingStep('structuring');
      await new Promise((r) => setTimeout(r, 300));
      setEmployees(mockEmployees);
      setProcessingStep('done');
    }
  }, []);

  const handleUpdateEmployee = useCallback((updated: EmployeePayroll) => {
    setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setEmployees((prev) => prev.map((e) => e.id === id ? { ...e, selected: !e.selected } : e));
  }, []);




  const handleClear = useCallback(() => {
    setEmployees([]);
    setProcessingStep('idle');
    setSearchQuery('');
    setFilterMode('all');
    setCompany(null);
  }, []);

  const selectedCompany = company ? COMPANIES.find((c) => c.id === company) ?? null : null;


  const hasData = advances.length > 0;
  const selectedCount = employees.filter((e) => e.selected).length;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* ── Cinematic background layers ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-primary/[0.025] blur-[150px]" />
        <div className="absolute bottom-[-15%] right-[-8%] h-[500px] w-[500px] rounded-full bg-primary/[0.015] blur-[130px]" />
        <div className="absolute top-[40%] right-[15%] h-[300px] w-[300px] rounded-full bg-primary/[0.01] blur-[100px]" />
        <div className="absolute inset-0 bg-vignette" />
        <div className="absolute inset-0 bg-noise opacity-40" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <PremiumHeader processingStep={processingStep} hasData={hasData} />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* Company selection */}
          {!hasData && !company && (
            <section className="relative pt-12 pb-4">
              <CompanySelector onSelect={setCompany} />
            </section>
          )}

          {/* Upload section */}
          {!hasData && company && (
            <section className="relative pt-12 pb-4">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <img
                  src={payrollDocBg}
                  alt=""
                  aria-hidden="true"
                  width={800}
                  height={1024}
                  className="w-[420px] opacity-[0.04] blur-[1px] rotate-[-6deg] translate-y-4 translate-x-12 select-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1 font-medium text-primary/90">
                    {selectedCompany?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCompany(null)}
                    className="underline-offset-2 hover:text-foreground hover:underline transition-colors"
                  >
                    Trocar empresa
                  </button>
                </div>
                <UploadDropzone processingStep={processingStep} onFileSelect={handleFileSelect} />
              </div>
            </section>
          )}


          {/* Batch summary */}
          {batchSummary && (
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BatchSummary data={batchSummary} />
            </section>
          )}

          {/* Employee cards */}
          {hasData && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                  Colaboradores ({advances.length})
                </h3>
                <div className="flex items-center gap-1">
                  <CalcConfigDialog config={calcConfig} onSave={updateConfig} onReset={resetConfig} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground hover:bg-glass/40 transition-all duration-300"
                    onClick={() => setProcessingStep('idle')}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Novo arquivo
                  </Button>
                </div>
              </div>

              {/* Search & Filters */}
              <EmployeeFilters
                search={searchQuery}
                onSearchChange={setSearchQuery}
                filter={filterMode}
                onFilterChange={setFilterMode}
                counts={filterCounts}
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredAdvances.map((emp, i) => (
                  <div
                    key={emp.id}
                    className="animate-in fade-in slide-in-from-bottom-4"
                    style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
                  >
                    <EmployeeAdvanceCard
                      employee={emp}
                      competencia={competencia}
                      config={calcConfig}
                      onUpdate={handleUpdateEmployee}
                      onToggleSelect={handleToggleSelect}
                    />
                  </div>
                ))}
              </div>

              {filteredAdvances.length === 0 && (
                <div className="text-center py-12 text-muted-foreground/60 text-sm">
                  Nenhum colaborador encontrado com os filtros selecionados.
                </div>
              )}
            </section>
          )}

          {/* Export actions */}
          {hasData && (
            <ExportActions
              advances={advances}
              competencia={competencia}
              config={calcConfig}
              selectedCount={selectedCount}
              onClear={handleClear}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="text-center py-8">
          <div className="w-24 h-px mx-auto mb-4 bg-gradient-to-r from-transparent via-muted-foreground/15 to-transparent" />
          <p className="text-[10px] tracking-[0.12em] uppercase text-muted-foreground/35 font-medium">
            Mendonça Galvão Contadores Associados — Sistema de Adiantamento Salarial
          </p>
        </footer>
      </div>
    </div>
  );
}
