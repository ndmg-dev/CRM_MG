import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useNativeSystemBase } from '@/hooks/useNativeSystemBase';
import { bimgApiUrl } from '../lib/api';

interface Company {
  id: string;
  name: string;
}

export default function DashboardFilters() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const base = useNativeSystemBase();

  const currentCompany = searchParams.get('company_id') || '';
  const initialTarget = searchParams.get('target') || '';
  const initialBase = searchParams.get('base') || '';

  const [company, setCompany] = useState(currentCompany);

  const [alvoAno, setAlvoAno] = useState('');
  const [alvoTrim, setAlvoTrim] = useState('Todos');
  const [alvoMes, setAlvoMes] = useState('Todos');

  const [baseAno, setBaseAno] = useState('');
  const [baseTrim, setBaseTrim] = useState('Todos');
  const [baseMes, setBaseMes] = useState('Todos');

  const [companies, setCompanies] = useState<Company[]>([]);
  const [rawPeriods, setRawPeriods] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(bimgApiUrl('/companies'))
      .then(r => r.json())
      .then((data: Company[]) => {
        setCompanies(data || []);
        if (!currentCompany && data?.length > 0) {
          setCompany(data[0].id);
        }
      })
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

  const parsePeriodStr = (pString: string, years: string[]) => {
    if (!pString) return null;
    const arr = pString.split(',');
    if (arr.length === 1 && arr[0].includes('/')) {
      const [m, y] = arr[0].split('/');
      return { ano: y, trim: 'Todos', mes: m };
    }
    if (arr.length === 3 && arr[0].includes('/')) {
      const y = arr[0].split('/')[1];
      const m1 = arr[0].split('/')[0];
      let trim = 'Todos';
      if(m1 === '01') trim = '1';
      else if(m1 === '04') trim = '2';
      else if(m1 === '07') trim = '3';
      else if(m1 === '10') trim = '4';
      return { ano: y, trim, mes: 'Todos' };
    }
    if (arr.length >= 12 && arr[0].includes('/')) {
      return { ano: arr[0].split('/')[1], trim: 'Todos', mes: 'Todos' };
    }
    return null;
  };

  const buildPeriodLabel = (y: string, t: string, m: string) => {
    if (!y) return '';
    if (m !== 'Todos') return `${m}/${y}`;
    if (t !== 'Todos') {
      const quarters: Record<string, string[]> = {
        '1': ['01','02','03'], '2': ['04','05','06'], '3': ['07','08','09'], '4': ['10','11','12']
      };
      return quarters[t].map(mm => `${mm}/${y}`).join(',');
    }
    const allMonths = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    return allMonths.map(mm => `${mm}/${y}`).join(',');
  };

  useEffect(() => {
    if (!company) { setRawPeriods([]); setAvailableYears([]); return; }
    setPeriodsLoading(true);
    fetch(bimgApiUrl(`/periods?company_id=${encodeURIComponent(company)}`))
      .then(r => r.json())
      .then((data: string[]) => {
        const p = data || [];
        setRawPeriods(p);

        const allMonths = p.filter(x => x.includes('/')).sort((a,b) => {
           const [m1,y1] = a.split('/');
           const [m2,y2] = b.split('/');
           return new Date(parseInt(y1), parseInt(m1)-1).getTime() - new Date(parseInt(y2), parseInt(m2)-1).getTime();
        });

        const years = Array.from(new Set(allMonths.map(x => x.split('/')[1])));
        setAvailableYears(years);

        if (allMonths.length > 0) {
           // Helper to check if selection is valid
           const isValid = (y: string, t: string, m: string) => {
             const str = buildPeriodLabel(y, t, m);
             return str && str.split(',').some(month => allMonths.includes(month));
           };

           // Initialize or reset ALVO
           let finalAlvoAno = alvoAno, finalAlvoTrim = alvoTrim, finalAlvoMes = alvoMes;
           if (!alvoAno) {
             const parsedAlvo = parsePeriodStr(initialTarget, years);
             if (parsedAlvo && isValid(parsedAlvo.ano, parsedAlvo.trim, parsedAlvo.mes)) {
               finalAlvoAno = parsedAlvo.ano; finalAlvoTrim = parsedAlvo.trim; finalAlvoMes = parsedAlvo.mes;
             }
           }

           if (!finalAlvoAno || !isValid(finalAlvoAno, finalAlvoTrim, finalAlvoMes)) {
               const latest = allMonths[allMonths.length - 1];
               const [lm, ly] = latest.split('/');
               finalAlvoAno = ly; finalAlvoTrim = 'Todos'; finalAlvoMes = lm;
           }

           setAlvoAno(finalAlvoAno);
           setAlvoTrim(finalAlvoTrim);
           setAlvoMes(finalAlvoMes);

           // Initialize or reset BASE
           let finalBaseAno = baseAno, finalBaseTrim = baseTrim, finalBaseMes = baseMes;
           if (!baseAno) {
             const parsedBase = parsePeriodStr(initialBase, years);
             if (parsedBase && isValid(parsedBase.ano, parsedBase.trim, parsedBase.mes)) {
               finalBaseAno = parsedBase.ano; finalBaseTrim = parsedBase.trim; finalBaseMes = parsedBase.mes;
             }
           }

           if (!finalBaseAno || !isValid(finalBaseAno, finalBaseTrim, finalBaseMes)) {
               const prev = allMonths.length > 1 ? allMonths[allMonths.length - 2] : allMonths[allMonths.length - 1];
               const [pm, py] = prev.split('/');
               finalBaseAno = py; finalBaseTrim = 'Todos'; finalBaseMes = pm;
           }

           setBaseAno(finalBaseAno);
           setBaseTrim(finalBaseTrim);
           setBaseMes(finalBaseMes);
        }
      })
      .catch(() => { setRawPeriods([]); setAvailableYears([]); })
      .finally(() => setPeriodsLoading(false));
  }, [company]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCompany = companies.find(c => c.id === company);

  const monthNames: Record<string, string> = {
    '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
    '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
    '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
  };



  const applyFilters = () => {
    if (!company || !alvoAno || !baseAno) return;
    setOpen(false);

    const target = buildPeriodLabel(alvoAno, alvoTrim, alvoMes);
    const base_ = buildPeriodLabel(baseAno, baseTrim, baseMes);

    navigate(
      `${base}?company_id=${encodeURIComponent(company)}&target=${encodeURIComponent(target)}&base=${encodeURIComponent(base_)}`
    );
  };

  const selectClass = "bg-[#1a1a1c] border border-[#27272a] text-[#a1a1aa] focus:text-white text-sm rounded-lg focus:ring-[#d4af37] focus:border-[#d4af37] block w-full pl-3 pr-9 py-2 outline-none appearance-none cursor-pointer transition-colors hover:border-[#d4af37]/50 disabled:opacity-50 disabled:cursor-wait";

  const getAvailableMonths = (trim: string) => {
    if (trim === 'Todos') return Object.keys(monthNames);
    if (trim === '1') return ['01', '02', '03'];
    if (trim === '2') return ['04', '05', '06'];
    if (trim === '3') return ['07', '08', '09'];
    if (trim === '4') return ['10', '11', '12'];
    return [];
  };

  return (
    <div className="flex flex-col gap-4 bg-[#111111] p-5 rounded-xl border border-[#27272a] shadow-lg mb-8">

      {/* COMPANY ROW */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 w-full justify-between">
        <div className="flex flex-col min-w-[280px] w-full sm:w-auto" ref={dropdownRef}>
          <label className="text-[#a1a1aa] text-xs uppercase tracking-wider mb-1.5 font-semibold">
            Empresa
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen(prev => !prev)}
              className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border text-sm transition-all outline-none
                ${open ? 'border-[#d4af37] bg-[#1a1a1c] shadow-[0_0_0_3px_rgba(212,175,55,0.15)]' : 'border-[#27272a] bg-[#1a1a1c] hover:border-[#d4af37]/50'}
                ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
              `}
              disabled={loading}
            >
              <span className={selectedCompany ? 'text-white font-medium' : 'text-[#71717a]'}>
                {loading ? 'Carregando...' : selectedCompany ? selectedCompany.name : 'Selecione...'}
              </span>
              <svg className={`w-4 h-4 text-[#d4af37] transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && companies.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-[#18181b] border border-[#d4af37]/30 rounded-lg shadow-2xl overflow-hidden">
                <div className="p-1">
                  {companies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setCompany(c.id); setOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center gap-3
                        ${company === c.id ? 'bg-[#d4af37]/10 text-[#d4af37] font-semibold' : 'text-[#d4d4d8] hover:bg-[#27272a] hover:text-white'}
                      `}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${company === c.id ? 'bg-[#d4af37] text-black' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                        {c.name.charAt(0)}
                      </span>
                      {c.name}
                      {company === c.id && (
                        <svg className="w-4 h-4 ml-auto text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={applyFilters}
          disabled={!company || !alvoAno || !baseAno || loading || periodsLoading}
          className="text-black bg-[#d4af37] hover:bg-[#b5952f] disabled:opacity-40 disabled:cursor-not-allowed font-bold rounded-lg text-sm px-8 py-2.5 transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] active:scale-95 whitespace-nowrap"
        >
          Aplicar Análise
        </button>
      </div>

      <div className="h-px w-full bg-[#27272a] my-2"></div>

      {/* FILTER ROWS */}
      <div className="flex flex-col xl:flex-row gap-6">

        {/* ALVO */}
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[#a1a1aa] text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d4af37]"></span>
            ALVO (Período Atual)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <select value={alvoAno} onChange={e => { setAlvoAno(e.target.value); setAlvoTrim('Todos'); setAlvoMes('Todos'); }} disabled={periodsLoading || availableYears.length === 0} className={selectClass}>
                {periodsLoading ? <option value="">...</option> : availableYears.map(y => <option key={y} value={y}>Ano {y}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className="relative">
              <select value={alvoTrim} onChange={e => { setAlvoTrim(e.target.value); setAlvoMes('Todos'); }} disabled={periodsLoading || !alvoAno} className={selectClass}>
                <option value="Todos">Trimestre: Todos</option>
                <option value="1">1º Trimestre</option>
                <option value="2">2º Trimestre</option>
                <option value="3">3º Trimestre</option>
                <option value="4">4º Trimestre</option>
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className="relative">
              <select value={alvoMes} onChange={e => setAlvoMes(e.target.value)} disabled={periodsLoading || !alvoAno} className={selectClass}>
                <option value="Todos">Mês: Todos</option>
                {getAvailableMonths(alvoTrim).map(m => (
                  <option key={m} value={m}>{monthNames[m]}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

        {/* BASE */}
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[#a1a1aa] text-xs uppercase tracking-wider font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#71717a]"></span>
            BASE (Comparar Com)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <select value={baseAno} onChange={e => { setBaseAno(e.target.value); setBaseTrim('Todos'); setBaseMes('Todos'); }} disabled={periodsLoading || availableYears.length === 0} className={selectClass}>
                {periodsLoading ? <option value="">...</option> : availableYears.map(y => <option key={y} value={y}>Ano {y}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className="relative">
              <select value={baseTrim} onChange={e => { setBaseTrim(e.target.value); setBaseMes('Todos'); }} disabled={periodsLoading || !baseAno} className={selectClass}>
                <option value="Todos">Trimestre: Todos</option>
                <option value="1">1º Trimestre</option>
                <option value="2">2º Trimestre</option>
                <option value="3">3º Trimestre</option>
                <option value="4">4º Trimestre</option>
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
            <div className="relative">
              <select value={baseMes} onChange={e => setBaseMes(e.target.value)} disabled={periodsLoading || !baseAno} className={selectClass}>
                <option value="Todos">Mês: Todos</option>
                {getAvailableMonths(baseTrim).map(m => (
                  <option key={m} value={m}>{monthNames[m]}</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
