import { useState, useEffect, useRef } from 'react';
import { Printer, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from '@calc/lib/nav';
import { gerarPeriodosAquisitivos, calcularMesesPorAno } from '@calc/lib/ferias';
import { Navbar } from '@calc/components/Navbar';
import { ButtonAmber } from '@calc/components/ButtonAmber';
import { RescissionHeader } from '@calc/components/trct/RescissionHeader';
import { EmployerIdentificationSection } from '@calc/components/trct/EmployerIdentificationSection';
import { EmployeeIdentificationSection } from '@calc/components/trct/EmployeeIdentificationSection';
import { ContractDataSection } from '@calc/components/trct/ContractDataSection';
import { TerminationEarningsTable, EarningRow } from '@calc/components/trct/TerminationEarningsTable';
import { DeductionsTable, DeductionRow } from '@calc/components/trct/DeductionsTable';
import { TerminationTotalsSection } from '@calc/components/trct/TerminationTotalsSection';
import {
  DadosRescisao,
  ResultadoCalculo,
  calcularRescisao,
  carregarTabelas,
  carregarConfigTributavel,
  carregarFormulario,
  formatarMoeda,
} from '@calc/lib/calculos';

const OBSERVACAO_PADRAO = `Declaro ter recebido as importâncias acima descritas referentes à rescisão do meu contrato de trabalho, dando plena e irrevogável quitação, para nada mais reclamar a este título.`;

export default function ReciboPage() {
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
        demissaoAvulsa: formSalvo.demissaoAvulsa ?? false,
        incluirINSS: formSalvo.incluirINSS ?? true,
        incluirIRRF: formSalvo.incluirIRRF ?? true,
        proventosExtras: formSalvo.proventosExtras ?? [],
        insalubridade: formSalvo.insalubridade ?? {
          valorBase: 0,
          percentual: 0,
          incideDecimoTerceiro: true,
          incideFerias: true,
        },
        periculosidade: formSalvo.periculosidade ?? {
          ativo: false,
          valorBase: 0,
          incideDecimoTerceiro: true,
          incideFerias: true,
        },
      };
      // Recalcula meses por ano aplicando a regra "mais de 15 dias no mês"
      // a partir das datas reais (evita valores defasados no localStorage).
      if (dadosCarregados.dataAdmissao) {
        dadosCarregados.mesesPorAno = calcularMesesPorAno(
          dadosCarregados.dataAdmissao,
          dadosCarregados.mesAnoRescisao
        );
      }
      setDados(dadosCarregados);

      const { tabelaINSS, tabelaIRRF } = carregarTabelas();
      const configTributavel = carregarConfigTributavel();
      const res = calcularRescisao(
        dadosCarregados,
        tabelaINSS,
        tabelaIRRF,
        configTributavel,
        false,
        0,
        0,
        dadosCarregados.incluirINSS,
        dadosCarregados.incluirIRRF
      );
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

  const tipoDesligamentoLabel = {
    sem_justa_causa: 'Dispensa sem justa causa',
    fgts_8: 'FGTS 8% (sem multa)',
    acordo: 'Acordo entre as partes',
    pedido_demissao: 'Pedido de demissão',
    justa_causa: 'Dispensa por justa causa',
    nao_aplicavel: 'Não aplicável',
  }[dados.tipoDesligamento];

  const codigoAfastamento = {
    sem_justa_causa: 'SJ1',
    fgts_8: 'SJ1',
    acordo: 'ACD',
    pedido_demissao: 'PD1',
    justa_causa: 'JC1',
    nao_aplicavel: '—',
  }[dados.tipoDesligamento];

  // Build earnings rows with official TRCT rubrica codes
  const earnings: EarningRow[] = [];

  // Helper: salário efetivo do ano, respeitando a flag "usar apenas último salário"
  const competenciaAno = dados.mesAnoRescisao.getFullYear();
  const getSalarioAno = (ano: number) =>
    dados.usarApenasUltimoSalario ? dados.salarioBruto : (dados.salariosPorAno?.[ano] || dados.salarioBruto);
  const salarioAtual = getSalarioAno(competenciaAno);

  // 50 - Saldo de salário
  earnings.push({ rubrica: '50', descricao: `Saldo de ${dados.diasTrabalhados} dias de salário`, valor: resultado.saldoSalario });

  // 63 - 13º salário proporcional por ano de competência
  const temProjecaoDecimo = resultado.avisoIndenizado > 0;
  if (resultado.decimoTerceiroPorAno && resultado.decimoTerceiroPorAno.length > 0) {
    resultado.decimoTerceiroPorAno.forEach(({ ano, avos, valor }) => {
      earnings.push({
        rubrica: '63',
        descricao: `13º salário proporcional referente ao ano de ${ano} - ${avos}/12 avos`,
        valor,
      });
    });
  } else if (resultado.decimoTerceiro > 0) {
    earnings.push({
      rubrica: '63',
      descricao: `13º salário proporcional ${dados.mesesAno}/12 avos`,
      valor: resultado.decimoTerceiro,
    });
  }

  // 65 - Férias proporcionais (sem projeção do aviso)
  const temProjecaoFerias = resultado.avisoIndenizado > 0 && dados.mesesPeriodoAquisitivo < 12;
  const feriasBase = (salarioAtual / 12) * dados.mesesPeriodoAquisitivo;
  const tercoFeriasBase = feriasBase / 3;
  earnings.push({
    rubrica: '65',
    descricao: `Férias proporcionais ${dados.mesesPeriodoAquisitivo}/12 avos`,
    valor: feriasBase,
  });

  // 66.1 - Férias vencidas (detalhadas por período aquisitivo)
  const periodosAquisitivos = dados.dataAdmissao
    ? gerarPeriodosAquisitivos(dados.dataAdmissao, dados.mesAnoRescisao)
    : [];
  const periodosVencidosNaoPagos = periodosAquisitivos.filter(
    p => p.completo && !dados.periodosPagos[p.label]
  );

  if (periodosVencidosNaoPagos.length > 0) {
    periodosVencidosNaoPagos.forEach((p) => {
      const inicioStr = format(p.inicio, 'dd/MM/yyyy');
      const fimStr = format(p.fim, 'dd/MM/yyyy');
      const valorPeriodo = salarioAtual;
      const tercoPeriodo = valorPeriodo / 3;
      const multiplicador = p.dobrado ? 2 : 1;
      const sufixoDobrado = p.dobrado ? ' (em dobro - art. 137, CLT)' : '';

      earnings.push({
        rubrica: '66.1',
        descricao: `Férias vencidas período aquisitivo: ${inicioStr} a ${fimStr}${sufixoDobrado}`,
        valor: valorPeriodo * multiplicador,
      });

      earnings.push({
        rubrica: '68',
        descricao: `Terço constitucional sobre férias vencidas: ${inicioStr} a ${fimStr}${sufixoDobrado}`,
        valor: tercoPeriodo * multiplicador,
      });
    });
  }

  // 68 - Terço constitucional de férias proporcionais
  earnings.push({
    rubrica: '68',
    descricao: 'Terço constitucional de férias proporcionais',
    valor: tercoFeriasBase,
  });

  // 69 - Aviso-prévio indenizado
  const diasAviso = resultado.avisoIndenizado > 0 ? Math.min(30 + 3 * dados.anosEmpresa, 90) : 0;
  earnings.push({
    rubrica: '69',
    descricao: diasAviso > 0 ? `Aviso-prévio indenizado ${diasAviso} dias` : 'Aviso-prévio indenizado',
    valor: resultado.avisoIndenizado,
  });

  // 70 - 13º sobre aviso-prévio indenizado
  const decimo13Projecao = temProjecaoDecimo ? salarioAtual / 12 : 0;
  earnings.push({
    rubrica: '70',
    descricao: '13º salário sobre aviso-prévio indenizado',
    valor: decimo13Projecao,
  });

  // 71 - Férias sobre aviso-prévio indenizado
  const feriasProjecao = temProjecaoFerias ? salarioAtual / 12 : 0;
  const tercoProjecao = feriasProjecao / 3;
  earnings.push({
    rubrica: '71',
    descricao: 'Férias sobre aviso indenizado 1/12 avos',
    valor: feriasProjecao,
  });
  earnings.push({
    rubrica: '68',
    descricao: '1/3 sobre avos de férias indenizadas',
    valor: tercoProjecao,
  });


  // Multa FGTS (rubrica extra)
  if (resultado.multaFGTS > 0) {
    earnings.push({
      rubrica: 'MF',
      descricao: `Multa FGTS (${dados.tipoDesligamento === 'acordo' ? '20%' : '40%'})`,
      valor: resultado.multaFGTS,
    });
  }

  // Proventos Extras (Hora extra, comissões, etc.)
  if (dados.proventosExtras && dados.proventosExtras.length > 0) {
    dados.proventosExtras.forEach((p) => {
      if (p.valor > 0) {
        earnings.push({
          rubrica: 'PE',
          descricao: p.descricao || 'Provento Extra',
          valor: p.valor,
        });
      }
    });
  }

  // Reflexos dos Proventos Extras em 13º e Férias
  if (resultado.reflexoProvento13 > 0) {
    earnings.push({
      rubrica: '63',
      descricao: 'Reflexo de proventos extras no 13º salário',
      valor: resultado.reflexoProvento13,
    });
  }
  if (resultado.reflexoProventoFeriasProp > 0) {
    earnings.push({
      rubrica: '65',
      descricao: 'Reflexo de proventos extras em férias proporcionais',
      valor: resultado.reflexoProventoFeriasProp,
    });
    earnings.push({
      rubrica: '68',
      descricao: '1/3 sobre reflexo de proventos extras em férias proporcionais',
      valor: resultado.reflexoProventoTercoFeriasProp,
    });
  }
  if (resultado.reflexoProventoFeriasVenc > 0) {
    earnings.push({
      rubrica: '66.1',
      descricao: 'Reflexo de proventos extras em férias vencidas',
      valor: resultado.reflexoProventoFeriasVenc,
    });
    earnings.push({
      rubrica: '68',
      descricao: '1/3 sobre reflexo de proventos extras em férias vencidas',
      valor: resultado.reflexoProventoTercoFeriasVenc,
    });
  }

  // Insalubridade
  if (resultado.insalubridadeValor > 0) {
    earnings.push({
      rubrica: 'IN',
      descricao: `Insalubridade (${dados.insalubridade?.percentual || 0}%)`,
      valor: resultado.insalubridadeValor,
    });
  }

  // Periculosidade
  if (resultado.periculosidadeValor > 0) {
    earnings.push({
      rubrica: 'PR',
      descricao: 'Periculosidade (30%)',
      valor: resultado.periculosidadeValor,
    });
  }

  // Saldo FGTS (quando demissão avulsa ou FGTS 8%)
  const adicionalFGTS = (dados.demissaoAvulsa || dados.tipoDesligamento === 'fgts_8') ? resultado.saldoFGTS : 0;
  if (adicionalFGTS > 0) {
    earnings.push({ rubrica: 'SF', descricao: 'Saldo FGTS', valor: adicionalFGTS });
  }

  const totalBruto = earnings.reduce((sum, e) => sum + e.valor, 0);

  // Build deductions rows
  const deductions: DeductionRow[] = [];
  let dedNum = 1;

  if (dados.incluirINSS && resultado.inss > 0) {
    deductions.push({ codigo: String(dedNum++).padStart(3, '0'), descricao: 'INSS', valor: resultado.inss });
  }
  if (dados.incluirIRRF && resultado.irrf > 0) {
    deductions.push({ codigo: String(dedNum++).padStart(3, '0'), descricao: 'IRRF', valor: resultado.irrf });
  }
  if (dados.faltas > 0) {
    deductions.push({ codigo: String(dedNum++).padStart(3, '0'), descricao: 'Faltas / Adiantamentos', valor: dados.faltas });
  }
  dados.outrosDescontos.forEach((desc) => {
    deductions.push({ codigo: String(dedNum++).padStart(3, '0'), descricao: desc.descricao, valor: desc.valor });
  });

  const totalDeducoes = deductions.reduce((sum, d) => sum + d.valor, 0);
  const valorLiquido = totalBruto - totalDeducoes;

  const dataAdmissaoStr = dados.dataAdmissao ? format(dados.dataAdmissao, 'dd/MM/yyyy', { locale: ptBR }) : '—';
  const dataRescisaoStr = format(dados.mesAnoRescisao, 'dd/MM/yyyy', { locale: ptBR });

  const renderTRCTContent = () => (
    <div className="space-y-0">
      <RescissionHeader />
      <EmployerIdentificationSection cnpj={dados.cnpj || '—'} empresa={dados.empresa || '—'} />
      <EmployeeIdentificationSection colaborador={dados.colaborador || '—'} cpf={dados.cpf || '—'} />
      <ContractDataSection
        causaAfastamento={tipoDesligamentoLabel}
        dataAdmissao={dataAdmissaoStr}
        dataAfastamento={dataRescisaoStr}
        codigoAfastamento={codigoAfastamento}
      />
      <TerminationEarningsTable earnings={earnings} totalBruto={totalBruto} />
      <DeductionsTable deductions={deductions} totalDeducoes={totalDeducoes} />
      <TerminationTotalsSection totalBruto={totalBruto} totalDeducoes={totalDeducoes} valorLiquido={valorLiquido} />

      {/* Observações */}
      <div className="mt-3">
        <div className="border border-gray-400 p-2">
          <div className="text-[9px] text-gray-500 uppercase font-bold mb-1">Observações</div>
          <textarea
            className="w-full min-h-16 resize-none border-none outline-none bg-transparent text-[11px] leading-tight print:bg-white"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      {/* Assinaturas */}
      <div className="mt-8">
        <div className="text-center text-[11px] mb-6">
          <p>______________________, ______ de ______________________ de ________</p>
          <p className="text-[9px] text-gray-500 mt-0.5">(Local e Data)</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="text-center">
            <div className="border-t border-black pt-1.5 mx-6">
              <p className="text-[11px] font-semibold">{dados.empresa || 'Empregador'}</p>
              <p className="text-[9px] text-gray-500">Assinatura do Empregador</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-1.5 mx-6">
              <p className="text-[11px] font-semibold">{dados.colaborador || 'Empregado'}</p>
              <p className="text-[9px] text-gray-500">Assinatura do Empregado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <footer className="mt-6 pt-2 border-t border-gray-300 text-[9px] text-gray-500 text-center">
        <p>Documento gerado por Mendonça Galvão Contadores Associados</p>
        <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
      </footer>
    </div>
  );

  return (
    <div className="bg-app min-h-screen">
      <Navbar />

      <main className="relative z-10 pt-24 pb-12 px-4 no-print">
        <div className="container mx-auto max-w-4xl mb-6 flex justify-end gap-2">
          <ButtonAmber variant="outline" onClick={() => navigate('/folha')} className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>Recibo de Folha</span>
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

      {/* Print version */}
      <div ref={printRef} className="print-area bg-white text-black p-6 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {renderTRCTContent()}
      </div>

      {/* Screen preview */}
      <div className="no-print bg-white text-black p-6 max-w-4xl mx-auto mb-12 shadow-lg rounded-lg" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
        {renderTRCTContent()}
      </div>

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
            font-size: 11px;
            padding: 15mm;
            margin: 0;
            max-width: 100%;
          }
          .bg-app::before,
          .bg-app::after {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          textarea {
            border: none !important;
            resize: none !important;
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
    </div>
  );
}
