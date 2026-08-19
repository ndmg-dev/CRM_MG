import React from 'react';
import { History, Upload, Trash2, Calendar } from 'lucide-react';
import { Button } from '@aeronord/components/ui/button';
import { MesHistorico } from '@aeronord/hooks/useHistoricoMeses';
import { formatMonthYear } from '@aeronord/utils/calculos';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@aeronord/components/ui/alert-dialog';

interface HistoricoSidebarProps {
  historico: MesHistorico[];
  mesCarregadoId: string | null;
  onCarregar: (id: string) => void;
  onExcluir: (id: string) => void;
}

export function HistoricoSidebar({
  historico,
  mesCarregadoId,
  onCarregar,
  onExcluir,
}: HistoricoSidebarProps) {
  return (
    <aside className="w-72 shrink-0 bg-card/50 border-l border-border/50 backdrop-blur-sm">
      <div className="sticky top-24 p-4 pt-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg text-foreground tracking-wide">
            HISTÓRICO
          </h3>
        </div>

        {historico.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum mês salvo ainda.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Use "Salvar mês no histórico" para guardar.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            {historico.map((item) => {
              const isLoaded = mesCarregadoId === item.id;
              return (
                <div
                  key={item.id}
                  className={`
                    p-3 rounded-lg border transition-colors
                    ${isLoaded 
                      ? 'bg-primary/10 border-primary/30' 
                      : 'bg-muted/30 border-border/50 hover:border-primary/30'
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground text-sm">
                      {formatMonthYear(item.mesReferencia)}
                    </span>
                    {isLoaded && (
                      <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/20 px-2 py-0.5 rounded">
                        Ativo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {item.convocacoes.length} convocação(ões)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() => onCarregar(item.id)}
                      disabled={isLoaded}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Carregar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir mês do histórico?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O mês "{formatMonthYear(item.mesReferencia)}" 
                            será removido permanentemente do histórico.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onExcluir(item.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
