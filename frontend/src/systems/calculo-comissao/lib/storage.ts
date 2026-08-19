import type { OvertimeResult } from './calculator';

export interface OvertimeRecord extends OvertimeResult {
  id: string;
  timestamp: string;
}

const STORAGE_KEY = 'calculo-comissao-historico';

export function loadRecords(): OvertimeRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OvertimeRecord[]) : [];
  } catch {
    return [];
  }
}

export function appendRecord(result: OvertimeResult): OvertimeRecord {
  const record: OvertimeRecord = {
    ...result,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
  };
  const records = [record, ...loadRecords()];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  return record;
}

export function summarizeRecords(records: OvertimeRecord[]) {
  return {
    count: records.length,
    totalOvertimeHours: records.reduce((sum, r) => sum + r.overtimeHours, 0),
    totalOvertimeValue: records.reduce((sum, r) => sum + r.overtimeTotal, 0),
  };
}
