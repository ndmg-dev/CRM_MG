import { useState, useEffect, useCallback } from 'react';
import type { CalcConfig, CompanyId } from '@adiantamento/lib/types';
import { COMPANY_DEFAULT_CONFIG } from '@adiantamento/lib/types';

const STORAGE_KEY = 'mg-calc-config-v3';

type StoredConfigs = Partial<Record<CompanyId, CalcConfig>>;

function sanitize(parsed: Partial<CalcConfig> | undefined, fallback: CalcConfig): CalcConfig {
  if (!parsed) return fallback;
  return {
    percent: typeof parsed.percent === 'number' ? parsed.percent : fallback.percent,
    subtractAdiantamento:
      typeof parsed.subtractAdiantamento === 'boolean'
        ? parsed.subtractAdiantamento
        : fallback.subtractAdiantamento,
    rounding:
      parsed.rounding === 'floor' || parsed.rounding === 'round' || parsed.rounding === 'ceil'
        ? parsed.rounding
        : fallback.rounding,
    baseMode: parsed.baseMode === 'pe' || parsed.baseMode === 'liquido' ? parsed.baseMode : fallback.baseMode,
  };
}

function loadConfigs(): StoredConfigs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StoredConfigs;
  } catch {
    return {};
  }
}

export function useCalcConfig(company: CompanyId) {
  const [configs, setConfigs] = useState<StoredConfigs>({});

  useEffect(() => {
    setConfigs(loadConfigs());
  }, []);

  const fallback = COMPANY_DEFAULT_CONFIG[company];
  const config = sanitize(configs[company], fallback);

  const persist = useCallback((next: StoredConfigs) => {
    setConfigs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const updateConfig = useCallback(
    (next: CalcConfig) => {
      persist({ ...loadConfigs(), [company]: next });
    },
    [company, persist]
  );

  const resetConfig = useCallback(() => {
    const all = loadConfigs();
    delete all[company];
    persist(all);
  }, [company, persist]);

  return { config, updateConfig, resetConfig };
}
