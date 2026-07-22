import { useState, useEffect, useRef } from 'react';
import { Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from '@calc/lib/nav';
import { Navbar } from '@calc/components/Navbar';
import { ButtonAmber } from '@calc/components/ButtonAmber';
import logoRecibo from '@calc/assets/logo-recibo.png';
import {
  DadosRescisao,
  ResultadoCalculo,
  calcularRescisao,
  carregarTabelas,
  carregarConfigTributavel,
  carregarFormulario,
  formatarMoeda,
} from '@calc/lib/calculos';

const OBSERVACAO_PADRAO = `Declaro ter recebido a importância líquida acima discriminada, referente ao pagamento dos meus vencimentos do mês, dando plena e irrevogável quitação.`;

// Função para converter número para extenso
function numeroParaExtenso(valor: number): string {
  const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  
  if (valor === 0) return 'zero reais';
  if (valor === 100) return 'cem reais';
  
  const parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);
  
  let resultado = '';
  
  if (parteInteira >= 1000) {
    const milhares = Math.floor(parteInteira / 1000);
    if (milhares === 1) {
      resultado += 'mil';
    } else if (milhares < 10) {
      resultado += unidades[milhares] + ' mil';
    } else if (milhares < 20) {
      resultado += especiais[milhares - 10] + ' mil';
    } else {
      const dezMil = Math.floor(milhares / 10);
      const uniMil = milhares % 10;
      resultado += dezenas[dezMil];
      if (uniMil > 0) resultado += ' e ' + unidades[uniMil];
      resultado += ' mil';
    }
  }
  
  const resto = parteInteira % 1000;
  if (resto > 0) {
    if (resultado) resultado += ' ';
    
    if (resto >= 100) {
      const cen = Math.floor(resto / 100);
      if (resto === 100) {
        resultado += 'cem';
      } else {
        resultado += centenas[cen];
      }
    }
    
    const dezUni = resto % 100;
    if (dezUni > 0) {
      if (resto >= 100) resultado += ' e ';
      if (dezUni < 10) {
        resultado += unidades[dezUni];
      } else if (dezUni < 20) {
        resultado += especiais[dezUni - 10];
      } else {
        const dez = Math.floor(dezUni / 10);
        const uni = dezUni % 10;
        resultado += dezenas[dez];
        if (uni > 0) resultado += ' e ' + unidades[uni];
      }
    }
  }
  
  resultado += parteInteira === 1 ? ' real' : ' reais';
  
  if (centavos > 0) {
    resultado += ' e ';
    if (centavos < 10) {
      resultado += unidades[centavos];
    } else if (centavos < 20) {
      resultado += especiais[centavos - 10];
    } else {
      const dezCent = Math.floor(centavos / 10);
      const uniCent = centavos % 10;
      resultado += dezenas[dezCent];
      if (uniCent > 0) resultado += ' e ' + unidades[uniCent];
    }
    resultado += centavos === 1 ? ' centavo' : ' centavos';
  }
  
  return resultado;
}

export default function FolhaPage() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<DadosRescisao | null>(null);
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [observacoes, setObservacoes] = useState(OBSERVACAO_PADRAO);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const formSalvo = carregarFormulario();
    if (formSalvo) {
      const dadosCarregados = {
        ...formSalvo,
        dataAdmissao: formSalvo.dataAdmissao ? new Date(formSalvo.dataAdmissao) : null,
        mesAnoRescisao: new Date(formSalvo.mesAnoRescisao),
      };
      setDados(dadosCarregados);

      const { tabelaINSS, tabelaIRRF } = carregarTabelas();
      const configTributavel = carregarConfigTributavel();
      const res = calcularRescisao(dadosCarregados, tabelaINSS, tabelaIRRF, configTributavel);
      setResultado(res);
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (!dados || !resultado) {
    return (
      <div className="bg-app min-h-screen">
        <Navbar />
        <main className="relative z-10 pt-24 pb-12 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Nenhum cálculo encontrado</h1>
            <p className="text-muted-foreground mb-6">
              Preencha a calculadora primeiro para gerar o recibo.
            </p>
            <ButtonAmber onClick={() => window.location.href = '/calc'}>
              Ir para Calculadora
            </ButtonAmber>
          </div>
        </main>
      </div>
    );
  }

  const mesReferencia = format(dados.mesAnoRescisao, 'MMMM', { locale: ptBR }).toUpperCase();
  const anoReferencia = format(dados.mesAnoRescisao, 'yyyy');

  // Componente de recibo reutilizável
  const ReciboContent = ({ forPrint = false }: { forPrint?: boolean }) => (
    <div className={forPrint ? '' : 'mb-12'}>
      {/* Valor destaque */}
      <div className="text-right mb-6">
        <span className="text-2xl font-bold">R${formatarMoeda(resultado.liquido)}</span>
      </div>

      {/* Texto principal */}
      <div className="mb-8 text-sm leading-relaxed text-justify">
        <p>
          Recebi da <strong>{dados.empresa || '[EMPRESA]'}</strong>, a importância supra de{' '}
          <strong>R${formatarMoeda(resultado.liquido)}</strong> ({numeroParaExtenso(resultado.liquido)}), 
          referente ao pagamento do mês de <strong>{mesReferencia}</strong> de {anoReferencia}, 
          dando plena quitação no valor ora recebido, conf. discriminação abaixo:
        </p>
      </div>

      {/* Discriminação */}
      <div className="mb-8 text-sm">
        <table className="w-full">
          <tbody>
            <tr>
              <td className="py-1">- Salário ({dados.diasTrabalhados} dias)</td>
              <td className="py-1 text-right font-mono border-b border-dotted border-gray-400 w-32">R${formatarMoeda(resultado.saldoSalario)}</td>
            </tr>
            {resultado.inss > 0 && (
              <tr>
                <td className="py-1">- INSS</td>
                <td className="py-1 text-right font-mono border-b border-dotted border-gray-400 w-32">-R${formatarMoeda(resultado.inss)}</td>
              </tr>
            )}
            {resultado.irrf > 0 && (
              <tr>
                <td className="py-1">- IRRF</td>
                <td className="py-1 text-right font-mono border-b border-dotted border-gray-400 w-32">-R${formatarMoeda(resultado.irrf)}</td>
              </tr>
            )}
            {dados.faltas > 0 && (
              <tr>
                <td className="py-1">- Descontos (Faltas/Adiantamentos)</td>
                <td className="py-1 text-right font-mono border-b border-dotted border-gray-400 w-32">-R${formatarMoeda(dados.faltas)}</td>
              </tr>
            )}
            {dados.outrosDescontos.map((desc, index) => (
              <tr key={index}>
                <td className="py-1">- {desc.descricao}</td>
                <td className="py-1 text-right font-mono border-b border-dotted border-gray-400 w-32">-R${formatarMoeda(desc.valor)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2">- Total</td>
              <td className="py-2 text-right font-mono border-b-2 border-black w-32">R${formatarMoeda(resultado.liquido)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Local e Data */}
      <div className="text-center text-sm mb-12">
        <p>Petrolina-PE, ______ de {format(new Date(), 'MMMM', { locale: ptBR })} de {format(new Date(), 'yyyy')}</p>
      </div>

      {/* Assinatura */}
        <div className="mt-16">
          <div className="border-t border-black pt-2 max-w-md mx-auto text-center">
            <p className="font-semibold uppercase">{dados.colaborador || 'COLABORADOR'}</p>
            <p className="text-xs text-gray-500">CPF: {dados.cpf || '___.___.___-__'}</p>
          </div>
        </div>
    </div>
  );

  return (
    <div className="bg-app min-h-screen">
      <Navbar />
      
      <main className="relative z-10 pt-24 pb-12 px-4 no-print">
        <div className="container mx-auto max-w-4xl mb-6 flex justify-end gap-2">
          <ButtonAmber variant="outline" onClick={() => navigate('/recibo')} className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>Recibo de Rescisão</span>
          </ButtonAmber>
          <ButtonAmber variant="outline" onClick={() => navigate('/ferias')} className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>Recibo de Férias</span>
          </ButtonAmber>
          <ButtonAmber onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-5 h-5" />
            <span>Imprimir</span>
          </ButtonAmber>
        </div>
      </main>

      {/* Área de impressão */}
      <div ref={printRef} className="print-area bg-white text-black p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Cabeçalho */}
        <header className="border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <img src={logoRecibo} alt="Mendonça Galvão" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold">Mendonça Galvão Contadores Associados</h1>
              <p className="text-sm text-gray-600">Contabilidade • Consultoria • Assessoria</p>
            </div>
          </div>
          <h2 className="text-center text-lg font-bold uppercase tracking-wide">
            Recibo de Folha Mensal
          </h2>
        </header>

        {/* Dados do Colaborador */}
        <section className="mb-6">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="py-1 font-semibold w-32">Empresa:</td>
                <td className="py-1">{dados.empresa || '—'}</td>
                <td className="py-1 font-semibold w-24">CNPJ:</td>
                <td className="py-1">{dados.cnpj || '—'}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Colaborador:</td>
                <td className="py-1">{dados.colaborador || '—'}</td>
                <td className="py-1 font-semibold">Mês Ref.:</td>
                <td className="py-1">{format(dados.mesAnoRescisao, 'MMMM/yyyy', { locale: ptBR })}</td>
              </tr>
              {dados.dataAdmissao && (
                <tr>
                  <td className="py-1 font-semibold">Admissão:</td>
                  <td className="py-1" colSpan={3}>{format(dados.dataAdmissao, 'dd/MM/yyyy', { locale: ptBR })}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <ReciboContent forPrint />

        {/* Rodapé */}
        <footer className="mt-12 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
          <p>Documento gerado por Mendonça Galvão Contadores Associados</p>
          <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </footer>
      </div>

      {/* Estilos de impressão inline */}
      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print, .navbar-blur {
            display: none !important;
          }
          .print-area {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            background: white !important;
            color: black !important;
            font-size: 12px;
            padding: 20mm;
            margin: 0;
            max-width: 100%;
          }
          .bg-app::before,
          .bg-app::after {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 15mm;
          }
        }
        @media screen {
          .print-area {
            display: none;
          }
        }
        @media print {
          .print-area {
            display: block !important;
          }
        }
      `}</style>

      {/* Preview na tela */}
      <div className="no-print bg-white text-black p-8 max-w-4xl mx-auto mb-12 shadow-lg rounded-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Cabeçalho */}
        <header className="border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <img src={logoRecibo} alt="Mendonça Galvão" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-bold">Mendonça Galvão Contadores Associados</h1>
              <p className="text-sm text-gray-600">Contabilidade • Consultoria • Assessoria</p>
            </div>
          </div>
          <h2 className="text-center text-lg font-bold uppercase tracking-wide">
            Recibo de Folha Mensal
          </h2>
        </header>

        {/* Dados do Colaborador */}
        <section className="mb-6">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <td className="py-1 font-semibold w-32">Empresa:</td>
                <td className="py-1">{dados.empresa || '—'}</td>
                <td className="py-1 font-semibold w-24">CNPJ:</td>
                <td className="py-1">{dados.cnpj || '—'}</td>
              </tr>
              <tr>
                <td className="py-1 font-semibold">Colaborador:</td>
                <td className="py-1">{dados.colaborador || '—'}</td>
                <td className="py-1 font-semibold">Mês Ref.:</td>
                <td className="py-1">{format(dados.mesAnoRescisao, 'MMMM/yyyy', { locale: ptBR })}</td>
              </tr>
              {dados.dataAdmissao && (
                <tr>
                  <td className="py-1 font-semibold">Admissão:</td>
                  <td className="py-1" colSpan={3}>{format(dados.dataAdmissao, 'dd/MM/yyyy', { locale: ptBR })}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <ReciboContent />

        {/* Rodapé */}
        <footer className="mt-12 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
          <p>Documento gerado por Mendonça Galvão Contadores Associados</p>
          <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </footer>
      </div>
    </div>
  );
}
