import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { Convencao } from '@aeronord/types/convencao';

export interface MesHistorico {
  id: string;
  mesReferencia: string;
  convocacoes: Convencao[];
  dataSalvo: string;
}

const STORAGE_KEY = 'aeronord-historico-meses';

export function useHistoricoMeses() {
  const [historico, setHistorico] = useLocalStorage<MesHistorico[]>(STORAGE_KEY, []);

  const salvarMes = useCallback((mesReferencia: string, convocacoes: Convencao[]): boolean => {
    const convocacoesDoMes = convocacoes.filter(c => c.mesReferencia === mesReferencia);
    
    if (convocacoesDoMes.length === 0) return false;

    const novoItem: MesHistorico = {
      id: `${mesReferencia}-${Date.now()}`,
      mesReferencia,
      convocacoes: convocacoesDoMes,
      dataSalvo: new Date().toISOString(),
    };

    setHistorico(prev => {
      // Remove existing entry for same month
      const filtered = prev.filter(h => h.mesReferencia !== mesReferencia);
      return [novoItem, ...filtered];
    });

    return true;
  }, [setHistorico]);

  const existeMes = useCallback((mesReferencia: string): boolean => {
    return historico.some(h => h.mesReferencia === mesReferencia);
  }, [historico]);

  const excluirMes = useCallback((id: string) => {
    setHistorico(prev => prev.filter(h => h.id !== id));
  }, [setHistorico]);

  const carregarMes = useCallback((id: string): Convencao[] | null => {
    const item = historico.find(h => h.id === id);
    return item ? item.convocacoes : null;
  }, [historico]);

  return {
    historico,
    salvarMes,
    existeMes,
    excluirMes,
    carregarMes,
  };
}
