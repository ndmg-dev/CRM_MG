import React, { useMemo, useState, useCallback } from 'react';
import { Plus, Save } from 'lucide-react';
import { Header } from '@aeronord/components/Header';
import { ConvencaoCard } from '@aeronord/components/ConvencaoCard';
import { ResumoMensal } from '@aeronord/components/ResumoMensal';
import { HistoricoSidebar } from '@aeronord/components/HistoricoSidebar';
import { Button } from '@aeronord/components/ui/button';
import { Badge } from '@aeronord/components/ui/badge';
import { useLocalStorage } from '@aeronord/hooks/useLocalStorage';
import { useHistoricoMeses } from '@aeronord/hooks/useHistoricoMeses';
import { Convencao } from '@aeronord/types/convencao';
import { generateId, VALOR_HORA_FIXO } from '@aeronord/utils/calculos';
import { toast } from '@aeronord/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@aeronord/components/ui/alert-dialog';

export default function Convenios() {
  const [convencoes, setConvencoes] = useLocalStorage<Convencao[]>('aeronord-convencoes', []);
  const { historico, salvarMes, existeMes, excluirMes, carregarMes } = useHistoricoMeses();
  
  const [mesCarregadoId, setMesCarregadoId] = useState<string | null>(null);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [pendingSaveMonth, setPendingSaveMonth] = useState<string | null>(null);

  // Get the most common month or current month
  const mesMaisComum = useMemo(() => {
    if (convencoes.length === 0) return undefined;
    
    const counts: Record<string, number> = {};
    convencoes.forEach((c) => {
      if (c.mesReferencia) {
        counts[c.mesReferencia] = (counts[c.mesReferencia] || 0) + 1;
      }
    });

    let maxMonth = '';
    let maxCount = 0;
    Object.entries(counts).forEach(([month, count]) => {
      if (count > maxCount) {
        maxMonth = month;
        maxCount = count;
      }
    });

    return maxMonth || undefined;
  }, [convencoes]);

  const handleAddConvencao = () => {
    const today = new Date();
    const mesAtual = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const novaConvencao: Convencao = {
      id: generateId(),
      mesReferencia: mesAtual,
      dataConvocacao: today.toISOString().split('T')[0],
      horas: 0,
      valorHora: VALOR_HORA_FIXO,
      nomeTrabalhador: '',
      cpfTrabalhador: '',
      empresaNome: 'AERONORD SERVICOS LTDA',
      empresaCnpj: '11.471.555/0001-93',
      cidade: 'Petrolina',
    };

    setConvencoes((prev) => [novaConvencao, ...prev]);
  };

  const handleUpdateConvencao = (updated: Convencao) => {
    setConvencoes((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleDuplicateConvencao = (original: Convencao) => {
    const duplicada: Convencao = {
      ...original,
      id: generateId(),
    };
    setConvencoes((prev) => {
      const index = prev.findIndex((c) => c.id === original.id);
      const newList = [...prev];
      newList.splice(index + 1, 0, duplicada);
      return newList;
    });
  };

  const handleRemoveConvencao = (id: string) => {
    setConvencoes((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSalvarMes = useCallback(() => {
    if (!mesMaisComum) {
      toast({
        title: 'Nenhum mês para salvar',
        description: 'Adicione convocações primeiro.',
        variant: 'destructive',
      });
      return;
    }

    if (existeMes(mesMaisComum)) {
      setPendingSaveMonth(mesMaisComum);
      setShowReplaceDialog(true);
    } else {
      const success = salvarMes(mesMaisComum, convencoes);
      if (success) {
        toast({
          title: 'Mês salvo!',
          description: 'O mês foi salvo no histórico com sucesso.',
        });
      }
    }
  }, [mesMaisComum, convencoes, existeMes, salvarMes]);

  const handleConfirmReplace = useCallback(() => {
    if (pendingSaveMonth) {
      const success = salvarMes(pendingSaveMonth, convencoes);
      if (success) {
        toast({
          title: 'Mês substituído!',
          description: 'O mês foi atualizado no histórico.',
        });
      }
    }
    setShowReplaceDialog(false);
    setPendingSaveMonth(null);
  }, [pendingSaveMonth, convencoes, salvarMes]);

  const handleCarregarMes = useCallback((id: string) => {
    const convocacoesCarregadas = carregarMes(id);
    if (convocacoesCarregadas) {
      setConvencoes(convocacoesCarregadas);
      setMesCarregadoId(id);
      toast({
        title: 'Mês carregado!',
        description: 'As convocações do histórico foram carregadas.',
      });
    }
  }, [carregarMes, setConvencoes]);

  const handleExcluirMes = useCallback((id: string) => {
    excluirMes(id);
    if (mesCarregadoId === id) {
      setMesCarregadoId(null);
    }
    toast({
      title: 'Mês excluído',
      description: 'O mês foi removido do histórico.',
    });
  }, [excluirMes, mesCarregadoId]);

  const handleVoltarParaAtual = useCallback(() => {
    setMesCarregadoId(null);
    // Optionally reload from storage or leave as is
  }, []);

  return (
    <div className="min-h-screen bg-industrial relative">
      {/* Background effects */}
      <div className="noise-overlay" />
      <div className="vignette" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        <div className="flex flex-1">
          <main className="flex-1 container mx-auto px-4 py-8 space-y-6">
            {/* History loaded badge */}
            {mesCarregadoId && (
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary px-3 py-1">
                  Carregado do histórico
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleVoltarParaAtual}>
                  Voltar ao mês atual
                </Button>
              </div>
            )}

            {/* New convocation section */}
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-foreground tracking-wide">
                CONVOCAÇÕES
              </h2>
              <Button variant="gold" size="lg" onClick={handleAddConvencao}>
                <Plus className="w-5 h-5 mr-2" />
                Adicionar Convocação
              </Button>
            </div>

            {/* Convocation list */}
            {convencoes.length === 0 ? (
              <div className="bg-card border border-border border-dashed rounded-xl p-12 text-center">
                <p className="text-muted-foreground mb-4">
                  Nenhuma convocação cadastrada ainda.
                </p>
                <Button variant="gold-outline" onClick={handleAddConvencao}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira convocação
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {convencoes.map((convencao) => (
                  <ConvencaoCard
                    key={convencao.id}
                    convencao={convencao}
                    onUpdate={handleUpdateConvencao}
                    onDuplicate={handleDuplicateConvencao}
                    onRemove={handleRemoveConvencao}
                  />
                ))}
              </div>
            )}

            {/* Monthly summary */}
            {convencoes.length > 0 && (
              <>
                <ResumoMensal convencoes={convencoes} mesSelecionado={mesMaisComum} />
                
                {/* Save to history button */}
                <div className="flex justify-center">
                  <Button 
                    variant="gold-outline" 
                    size="lg" 
                    onClick={handleSalvarMes}
                    className="gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Salvar mês no histórico
                  </Button>
                </div>
              </>
            )}
          </main>

          {/* Sidebar - Histórico */}
          <HistoricoSidebar
            historico={historico}
            mesCarregadoId={mesCarregadoId}
            onCarregar={handleCarregarMes}
            onExcluir={handleExcluirMes}
          />
        </div>

        {/* Footer */}
        <footer className="border-t border-border/30 py-6 mt-auto">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm font-medium gold-gradient-text">
              Developed By Núcleo Digital MG
            </p>
          </div>
        </footer>
      </div>

      {/* Replace confirmation dialog */}
      <AlertDialog open={showReplaceDialog} onOpenChange={setShowReplaceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir mês no histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Este mês já existe no histórico. Deseja substituí-lo com os dados atuais?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSaveMonth(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplace}>
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
