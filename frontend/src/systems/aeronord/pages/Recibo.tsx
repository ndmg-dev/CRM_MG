import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@aeronord/components/ui/button';
import { useLocalStorage } from '@aeronord/hooks/useLocalStorage';
import { Convencao } from '@aeronord/types/convencao';
import { calcularConvencao, formatCurrency, formatDate, VALOR_HORA_FIXO } from '@aeronord/utils/calculos';

const CNPJ_FIXO = '11.471.554/0001-93';
const TRABALHADOR_FIXO = {
  nome: 'CARLOS TADEU DA SILVA',
  cpf: '844.101.594-53',
};

export default function Recibo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [convencoes] = useLocalStorage<Convencao[]>('aeronord-convencoes', []);

  const convencao = useMemo(() => {
    return convencoes.find((c) => c.id === id);
  }, [convencoes, id]);

  const calculos = useMemo(() => {
    if (!convencao) return null;
    return calcularConvencao(convencao);
  }, [convencao]);

  const handlePrint = () => {
    window.print();
  };

  if (!convencao || !calculos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Convocação não encontrada.</p>
          <Button variant="outline" onClick={() => navigate('../../cv', { relative: 'path' })}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <>
      {/* Print controls - hidden on print */}
      <div className="no-print bg-card border-b border-border p-4 sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('../../cv', { relative: 'path' })}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button variant="gold" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* Receipt document */}
      <div className="bg-white min-h-screen py-8 print:py-0">
        <div className="max-w-[210mm] mx-auto bg-white p-8 print:p-0 print:max-w-none print-page">
          {/* Header */}
          <header className="text-center mb-4 print:mb-2">
            <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide print:text-base">
              AERONORD SERVICOS LTDA
            </h1>
            <p className="text-sm text-gray-700 print:text-xs">CNPJ: {CNPJ_FIXO}</p>
            
            <div className="h-px bg-gray-300 my-3 print:my-2" />
            
            <h2 className="text-lg font-bold text-gray-800 uppercase tracking-wide print:text-sm">
              Recibo de Pagamento de Trabalhador Intermitente
            </h2>
          </header>

          {/* Declaration text */}
          <section className="mb-4 print:mb-2 text-sm text-gray-800 leading-relaxed text-justify print:text-xs print:leading-snug">
            <p>
              Eu, <strong>{TRABALHADOR_FIXO.nome}</strong>, portador(a) do CPF nº <strong>{TRABALHADOR_FIXO.cpf}</strong>, declaro que recebi da empresa <strong>AERONORD SERVICOS LTDA</strong>, CNPJ nº <strong>{CNPJ_FIXO}</strong>, referente à convocação de trabalho intermitente realizada em <strong>{convencao.dataConvocacao ? formatDate(convencao.dataConvocacao) : '_______________'}</strong>, os valores discriminados abaixo:
            </p>
          </section>

          {/* Proventos section */}
          <section className="mb-4 print:mb-2">
            <h3 className="text-base font-bold text-gray-800 uppercase mb-2 pb-1 border-b border-gray-300 print:text-xs print:mb-1">
              Proventos
            </h3>
            
            <div className="space-y-0.5 text-sm print:text-xs">
              <div className="font-semibold text-gray-700 mb-1 print:mb-0.5">Remuneração:</div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-200">
                <span className="text-gray-700 pl-4">Horas trabalhadas:</span>
                <span className="font-medium text-gray-900">{convencao.horas}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-200">
                <span className="text-gray-700 pl-4">Valor por hora:</span>
                <span className="font-medium text-gray-900">{formatCurrency(VALOR_HORA_FIXO)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600 pl-4">Horas trabalhadas x Valor por hora:</span>
                <span className="font-medium">{formatCurrency(calculos.resultado1)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">Descanso Semanal Remunerado (DSR):</span>
                <span className="font-medium">{formatCurrency(calculos.resultado2)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">Periculosidade (30%):</span>
                <span className="font-medium">{formatCurrency(calculos.resultado3)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">Alimentação:</span>
                <span className="font-medium">{formatCurrency(calculos.resultado4)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">Férias proporcionais:</span>
                <span className="font-medium">{formatCurrency(calculos.resultado5)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">1/3 de férias:</span>
                <span className="font-medium">{formatCurrency(calculos.resultado6)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">Décimo terceiro proporcional:</span>
                <span className="font-medium">{formatCurrency(calculos.resultado7)}</span>
              </div>
              
              <div className="flex justify-between py-1 font-bold text-gray-900 border-t-2 border-gray-300 mt-1">
                <span>Total de Proventos:</span>
                <span>{formatCurrency(calculos.totalProventos)}</span>
              </div>
            </div>
          </section>

          {/* Descontos section */}
          <section className="mb-4 print:mb-2">
            <h3 className="text-base font-bold text-gray-800 uppercase mb-2 pb-1 border-b border-gray-300 print:text-xs print:mb-1">
              Descontos
            </h3>
            
            <div className="space-y-0.5 text-sm print:text-xs">
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">INSS (7,5%):</span>
                <span className="font-medium text-red-600">- {formatCurrency(calculos.inss)}</span>
              </div>
              
              <div className="flex justify-between py-0.5 border-b border-gray-100">
                <span className="text-gray-600">Outro desconto:</span>
                <span className="font-medium">R$ 0,00</span>
              </div>
              
              <div className="flex justify-between py-1 font-bold text-gray-900 border-t-2 border-gray-300 mt-1">
                <span>Total de Descontos:</span>
                <span className="text-red-600">- {formatCurrency(calculos.totalDescontos)}</span>
              </div>
            </div>
          </section>

          {/* Líquido a receber */}
          <section className="mb-6 print:mb-3 p-3 print:p-2 bg-gray-50 border-2 border-gray-300 rounded-lg">
            <div className="flex justify-between items-center text-lg font-bold text-gray-900 print:text-sm">
              <span>LÍQUIDO A RECEBER:</span>
              <span className="text-green-700 text-xl print:text-base">{formatCurrency(calculos.liquidoReceber)}</span>
            </div>
          </section>

          {/* Footer with signature */}
          <footer className="mt-8 print:mt-4">
            <p className="text-sm text-gray-700 text-center mb-6 print:text-xs print:mb-3">
              {convencao.cidade || 'Petrolina'}, {dataAtual}.
            </p>
            
            <div className="flex justify-center">
              <div className="text-center">
                <div className="w-64 print:w-48 h-px bg-gray-500 mb-2 print:mb-1" />
                <p className="text-sm font-medium text-gray-900 print:text-xs">
                  {TRABALHADOR_FIXO.nome}
                </p>
                <p className="text-xs text-gray-700 print:text-[9px]">
                  CPF: {TRABALHADOR_FIXO.cpf}
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
