import { useState, useRef, useEffect } from 'react';
import { Printer, FileText, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from '@calc/lib/nav';
import { Navbar } from '@calc/components/Navbar';
import { ButtonAmber } from '@calc/components/ButtonAmber';
import { InputDark } from '@calc/components/InputDark';
import { MoneyInput } from '@calc/components/MoneyInput';
import { DateInput } from '@calc/components/DateInput';
import { CpfCnpjInput } from '@calc/components/CpfCnpjInput';
import logoRecibo from '@calc/assets/logo-recibo.png';
import { formatarMoeda, parseMoeda, carregarTabelas, carregarFormulario, TABELA_INSS_PADRAO, TABELA_IRRF_PADRAO } from '@calc/lib/calculos';
import type { TabelaINSS, TabelaIRRF } from '@calc/lib/calculos';

interface ItemExtra {
  descricao: string;
  valor: number;
}

function calcularINSSProgressivo(base: number, tabela: TabelaINSS[]): number {
  let totalINSS = 0;
  for (const faixa of tabela) {
    if (base <= 0) break;
    const faixaBase = Math.min(base, faixa.faixaFinal) - faixa.faixaInicial + (faixa.faixaInicial === 0 ? 0 : 1);
    const baseFaixa = Math.min(
      base > faixa.faixaFinal ? faixa.faixaFinal - (faixa.faixaInicial > 0 ? faixa.faixaInicial - 1 : 0) : base - (faixa.faixaInicial > 0 ? faixa.faixaInicial - 1 : 0),
      faixa.faixaFinal - (faixa.faixaInicial > 0 ? faixa.faixaInicial - 1 : 0)
    );
    if (baseFaixa > 0) {
      totalINSS += baseFaixa * (faixa.aliquota / 100);
    }
    if (base <= faixa.faixaFinal) break;
  }
  return Math.round(totalINSS * 100) / 100;
}

function calcularIRRF(baseIRRF: number, tabela: TabelaIRRF[]): number {
  for (const faixa of tabela) {
    if (baseIRRF >= faixa.faixaInicial && baseIRRF <= faixa.faixaFinal) {
      const irrf = (baseIRRF * faixa.aliquota / 100) - faixa.parcelaDedutivel;
      return Math.max(0, Math.round(irrf * 100) / 100);
    }
  }
  return 0;
}

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

const OBSERVACAO_PADRAO = `Declaro ter recebido a importância líquida acima discriminada, referente ao pagamento de férias, dando plena e irrevogável quitação.`;

export default function FeriasPage() {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  // Form state
  const [empresa, setEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [endereco, setEndereco] = useState('');
  const [colaborador, setColaborador] = useState('');
  const [cpf, setCpf] = useState('');
  const [ctps, setCtps] = useState('');
  const [funcao, setFuncao] = useState('');
  const [salarioBruto, setSalarioBruto] = useState(0);
  const [dataAdmissao, setDataAdmissao] = useState<Date | null>(null);
  const [periodoAquisitivoInicio, setPeriodoAquisitivoInicio] = useState<Date | null>(null);
  const [periodoAquisitivoFim, setPeriodoAquisitivoFim] = useState<Date | null>(null);
  const [periodoGozoInicio, setPeriodoGozoInicio] = useState<Date | null>(null);
  const [diasFerias, setDiasFerias] = useState(30);
  const [diasAbono, setDiasAbono] = useState(0);
  const [observacoes, setObservacoes] = useState(OBSERVACAO_PADRAO);
  const [mostrarRecibo, setMostrarRecibo] = useState(false);
  const [proventosExtras, setProventosExtras] = useState<ItemExtra[]>([]);
  const [descontosExtras, setDescontosExtras] = useState<ItemExtra[]>([]);
  const [novoProvento, setNovoProvento] = useState({ descricao: '', valor: '' });
  const [novoDesconto, setNovoDesconto] = useState({ descricao: '', valor: '' });

  // Carregar dados da calculadora (localStorage)
  useEffect(() => {
    const formSalvo = carregarFormulario();
    if (formSalvo) {
      if (formSalvo.empresa) setEmpresa(formSalvo.empresa);
      if (formSalvo.cnpj) setCnpj(formSalvo.cnpj);
      if (formSalvo.colaborador) setColaborador(formSalvo.colaborador);
      if (formSalvo.cpf) setCpf(formSalvo.cpf);
      if (formSalvo.salarioBruto) setSalarioBruto(formSalvo.salarioBruto);
      if (formSalvo.dataAdmissao) setDataAdmissao(new Date(formSalvo.dataAdmissao));
    }
  }, []);

  // Carregar tabelas
  const { tabelaINSS: tabelaSalvaINSS, tabelaIRRF: tabelaSalvaIRRF } = carregarTabelas();
  const tabelaINSS = tabelaSalvaINSS.length > 0 ? tabelaSalvaINSS : TABELA_INSS_PADRAO;
  const tabelaIRRF = tabelaSalvaIRRF.length > 0 ? tabelaSalvaIRRF : TABELA_IRRF_PADRAO;

  // Cálculos - diasFerias já é a quantidade de dias a gozar
  const diasGozados = diasFerias;
  const valorFeriasDias = (salarioBruto / 30) * diasGozados;
  const tercoFerias = valorFeriasDias / 3;
  const valorAbono = (salarioBruto / 30) * diasAbono;
  const tercoAbono = valorAbono / 3;

  const totalProventosExtras = proventosExtras.reduce((acc, p) => acc + p.valor, 0);
  const totalDescontosExtras = descontosExtras.reduce((acc, d) => acc + d.valor, 0);

  const totalBruto = valorFeriasDias + tercoFerias + valorAbono + tercoAbono + totalProventosExtras;

  // INSS sobre férias gozadas + 1/3 (abono pecuniário é isento de INSS)
  const baseINSS = valorFeriasDias + tercoFerias;
  const inss = calcularINSSProgressivo(baseINSS, tabelaINSS);

  // IRRF sobre férias gozadas + 1/3 - INSS (abono pecuniário é isento de IRRF)
  const baseIRRF = baseINSS - inss;
  const irrf = calcularIRRF(baseIRRF, tabelaIRRF);

  const totalDescontos = inss + irrf + totalDescontosExtras;
  const liquido = totalBruto - totalDescontos;

  const periodoGozoFim = periodoGozoInicio ? addDays(periodoGozoInicio, diasGozados - 1) : null;

  const handleAdicionarProvento = () => {
    const valor = parseMoeda(novoProvento.valor);
    if (novoProvento.descricao && valor > 0) {
      setProventosExtras([...proventosExtras, { descricao: novoProvento.descricao, valor }]);
      setNovoProvento({ descricao: '', valor: '' });
    }
  };

  const handleAdicionarDesconto = () => {
    const valor = parseMoeda(novoDesconto.valor);
    if (novoDesconto.descricao && valor > 0) {
      setDescontosExtras([...descontosExtras, { descricao: novoDesconto.descricao, valor }]);
      setNovoDesconto({ descricao: '', valor: '' });
    }
  };

  const handleCalcular = () => {
    setMostrarRecibo(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const ReciboContent = () => (
    <>
      {/* Dados */}
      <section className="mb-4">
        <table className="w-full text-xs border-collapse border border-gray-400">
          <tbody>
            <tr>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50" colSpan={2}>EMPREGADOR</td>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">CNPJ / CPF</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2" colSpan={2}>{empresa || '—'}</td>
              <td className="border border-gray-400 py-1 px-2">{cnpj || '—'}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50" colSpan={3}>ENDEREÇO</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2" colSpan={3}>{endereco || '—'}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">EMPREGADO</td>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">CTPS Nº / Série</td>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">FUNÇÃO</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2">{colaborador || '—'}</td>
              <td className="border border-gray-400 py-1 px-2">{ctps || '—'}</td>
              <td className="border border-gray-400 py-1 px-2">{funcao || '—'}</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">ADMISSÃO</td>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">PERÍODO AQUISITIVO</td>
              <td className="border border-gray-400 py-1 px-2 font-semibold bg-gray-50">PERÍODO DE GOZO</td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2">
                {dataAdmissao ? format(dataAdmissao, 'dd/MM/yyyy', { locale: ptBR }) : '—'}
              </td>
              <td className="border border-gray-400 py-1 px-2">
                {periodoAquisitivoInicio && periodoAquisitivoFim
                  ? `${format(periodoAquisitivoInicio, 'dd/MM/yyyy')} a ${format(periodoAquisitivoFim, 'dd/MM/yyyy')}`
                  : '—'}
              </td>
              <td className="border border-gray-400 py-1 px-2">
                {periodoGozoInicio && periodoGozoFim
                  ? `${format(periodoGozoInicio, 'dd/MM/yyyy')} a ${format(periodoGozoFim, 'dd/MM/yyyy')} (${diasGozados} dias)`
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Verbas */}
      <section className="mb-4">
        <table className="w-full text-xs border-collapse border border-gray-400">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 py-1 px-2 text-left">DESCRIÇÃO</th>
              <th className="border border-gray-400 py-1 px-2 text-center w-20">REF.</th>
              <th className="border border-gray-400 py-1 px-2 text-right w-28">PROVENTOS (R$)</th>
              <th className="border border-gray-400 py-1 px-2 text-right w-28">DESCONTOS (R$)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-400 py-1 px-2">Férias</td>
              <td className="border border-gray-400 py-1 px-2 text-center font-mono">{diasGozados} dias</td>
              <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(valorFeriasDias)}</td>
              <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
            </tr>
            <tr>
              <td className="border border-gray-400 py-1 px-2">1/3 Constitucional s/ Férias</td>
              <td className="border border-gray-400 py-1 px-2 text-center font-mono">1/3</td>
              <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(tercoFerias)}</td>
              <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
            </tr>
            {diasAbono > 0 && (
              <>
                <tr>
                  <td className="border border-gray-400 py-1 px-2">Abono Pecuniário</td>
                  <td className="border border-gray-400 py-1 px-2 text-center font-mono">{diasAbono} dias</td>
                  <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(valorAbono)}</td>
                  <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
                </tr>
                <tr>
                  <td className="border border-gray-400 py-1 px-2">1/3 Constitucional s/ Abono</td>
                  <td className="border border-gray-400 py-1 px-2 text-center font-mono">1/3</td>
                  <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(tercoAbono)}</td>
                  <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
                </tr>
              </>
            )}
            {inss > 0 && (
              <tr>
                <td className="border border-gray-400 py-1 px-2">INSS</td>
                <td className="border border-gray-400 py-1 px-2 text-center font-mono">—</td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(inss)}</td>
              </tr>
            )}
            {irrf > 0 && (
              <tr>
                <td className="border border-gray-400 py-1 px-2">IRRF</td>
                <td className="border border-gray-400 py-1 px-2 text-center font-mono">—</td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(irrf)}</td>
              </tr>
            )}
            {proventosExtras.map((p, i) => (
              <tr key={`prov-${i}`}>
                <td className="border border-gray-400 py-1 px-2">{p.descricao}</td>
                <td className="border border-gray-400 py-1 px-2 text-center font-mono">—</td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(p.valor)}</td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
              </tr>
            ))}
            {descontosExtras.map((d, i) => (
              <tr key={`desc-${i}`}>
                <td className="border border-gray-400 py-1 px-2">{d.descricao}</td>
                <td className="border border-gray-400 py-1 px-2 text-center font-mono">—</td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono"></td>
                <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(d.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="border border-gray-400 py-1 px-2" colSpan={2}>TOTAIS</td>
              <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(totalBruto)}</td>
              <td className="border border-gray-400 py-1 px-2 text-right font-mono">{formatarMoeda(totalDescontos)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Valor líquido */}
      <section className="mb-6">
        <table className="w-full text-sm border-2 border-black">
          <tbody>
            <tr className="bg-black text-white">
              <td className="py-2 px-3 font-bold">VALOR LÍQUIDO DAS FÉRIAS</td>
              <td className="py-2 px-3 text-right font-mono font-bold w-40">{formatarMoeda(liquido)}</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs mt-1 italic">
          ({numeroParaExtenso(liquido)})
        </p>
      </section>

      {/* Observações */}
      <section className="mb-6">
        <div className="border border-gray-300 p-3 min-h-16 text-xs">
          <textarea
            className="w-full min-h-14 resize-none border-none outline-none bg-transparent print:bg-white text-xs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </section>

      {/* Assinaturas */}
      <section className="mt-8">
        <div className="text-center text-xs mb-8">
          <p>__________, ______ de ______________ de ________</p>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-black pt-2 mx-4">
              <p className="font-semibold text-xs">{empresa || 'Empregador'}</p>
              <p className="text-[10px] text-gray-500">Assinatura do Empregador</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2 mx-4">
              <p className="font-semibold text-xs uppercase">{colaborador || 'Empregado'}</p>
              <p className="text-[10px] text-gray-500">CPF: {cpf || '___.___.___-__'}</p>
            </div>
          </div>
        </div>
      </section>
    </>
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
          <ButtonAmber variant="outline" onClick={() => navigate('/folha')} className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>Recibo de Folha</span>
          </ButtonAmber>
          {mostrarRecibo && (
            <ButtonAmber onClick={handlePrint} className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              <span>Imprimir</span>
            </ButtonAmber>
          )}
        </div>

        {/* Formulário */}
        {!mostrarRecibo && (
          <div className="container mx-auto max-w-4xl">
            <h1 className="text-2xl font-bold text-foreground mb-6">Recibo de Férias</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Empresa / Empregador</label>
                <InputDark value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CNPJ / CPF</label>
                <CpfCnpjInput value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Endereço</label>
                <InputDark value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Endereço completo" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Empregado</label>
                <InputDark value={colaborador} onChange={(e) => setColaborador(e.target.value)} placeholder="Nome do colaborador" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CPF</label>
                <CpfCnpjInput value={cpf} onChange={(e) => setCpf(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">CTPS Nº / Série</label>
                <InputDark value={ctps} onChange={(e) => setCtps(e.target.value)} placeholder="Nº / Série" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Função</label>
                <InputDark value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Cargo / Função" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Salário Base</label>
                <MoneyInput value={salarioBruto} onChange={(v) => setSalarioBruto(v)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Data de Admissão</label>
                <DateInput value={dataAdmissao} onChange={(d) => setDataAdmissao(d)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Período Aquisitivo - Início</label>
                <DateInput value={periodoAquisitivoInicio} onChange={(d) => setPeriodoAquisitivoInicio(d)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Período Aquisitivo - Fim</label>
                <DateInput value={periodoAquisitivoFim} onChange={(d) => setPeriodoAquisitivoFim(d)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Início do Gozo</label>
                <DateInput value={periodoGozoInicio} onChange={(d) => setPeriodoGozoInicio(d)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Dias de Férias</label>
                <InputDark
                  type="number"
                  value={diasFerias}
                  onChange={(e) => setDiasFerias(Math.min(30, Math.max(0, Number(e.target.value))))}
                  min={0}
                  max={30}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Abono Pecuniário (dias vendidos)</label>
                <InputDark
                  type="number"
                  value={diasAbono}
                  onChange={(e) => setDiasAbono(Math.min(10, Math.max(0, Number(e.target.value))))}
                  min={0}
                  max={10}
                />
              </div>
            </div>

            {/* Proventos Extras */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Proventos Extras</h3>
              {proventosExtras.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-foreground flex-1">{p.descricao}</span>
                  <span className="text-sm font-mono text-foreground">{formatarMoeda(p.valor)}</span>
                  <button onClick={() => setProventosExtras(proventosExtras.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <InputDark placeholder="Descrição" value={novoProvento.descricao} onChange={(e) => setNovoProvento({ ...novoProvento, descricao: e.target.value })} />
                </div>
                <div className="w-36">
                  <MoneyInput value={parseMoeda(novoProvento.valor)} onChange={(v) => setNovoProvento({ ...novoProvento, valor: String(v) })} />
                </div>
                <ButtonAmber variant="ghost" size="sm" onClick={handleAdicionarProvento}>
                  <Plus className="w-4 h-4" />
                </ButtonAmber>
              </div>
            </div>

            {/* Descontos Extras */}
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Descontos Extras</h3>
              {descontosExtras.map((d, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-foreground flex-1">{d.descricao}</span>
                  <span className="text-sm font-mono text-foreground">{formatarMoeda(d.valor)}</span>
                  <button onClick={() => setDescontosExtras(descontosExtras.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <InputDark placeholder="Descrição" value={novoDesconto.descricao} onChange={(e) => setNovoDesconto({ ...novoDesconto, descricao: e.target.value })} />
                </div>
                <div className="w-36">
                  <MoneyInput value={parseMoeda(novoDesconto.valor)} onChange={(v) => setNovoDesconto({ ...novoDesconto, valor: String(v) })} />
                </div>
                <ButtonAmber variant="ghost" size="sm" onClick={handleAdicionarDesconto}>
                  <Plus className="w-4 h-4" />
                </ButtonAmber>
              </div>
            </div>

            <div className="flex justify-end">
              <ButtonAmber onClick={handleCalcular} className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <span>Gerar Recibo</span>
              </ButtonAmber>
            </div>
          </div>
        )}

        {/* Preview na tela */}
        {mostrarRecibo && (
          <div className="container mx-auto max-w-4xl mb-6">
            <ButtonAmber variant="outline" onClick={() => setMostrarRecibo(false)} className="mb-4">
              ← Voltar ao Formulário
            </ButtonAmber>
            <div className="bg-white text-black p-8 shadow-lg rounded-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
              <header className="border-b-2 border-black pb-4 mb-4">
                <div className="flex items-center gap-4 mb-3">
                  <img src={logoRecibo} alt="Mendonça Galvão" className="h-14 w-auto object-contain" />
                  <div>
                    <h1 className="text-lg font-bold">Mendonça Galvão Contadores Associados</h1>
                    <p className="text-xs text-gray-600">Contabilidade • Consultoria • Assessoria</p>
                  </div>
                </div>
                <h2 className="text-center text-base font-bold uppercase tracking-wide">
                  Recibo de Pagamento de Férias
                </h2>
                <p className="text-center text-[10px] text-gray-500">(Capítulo VI, Título II da C.L.T.)</p>
              </header>
              <ReciboContent />
              <footer className="mt-8 pt-3 border-t border-gray-300 text-[10px] text-gray-500 text-center">
                <p>Documento gerado por Mendonça Galvão Contadores Associados</p>
                <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </footer>
            </div>
          </div>
        )}
      </main>

      {/* Área de impressão */}
      <div ref={printRef} className="print-area bg-white text-black p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Arial, sans-serif' }}>
        <header className="border-b-2 border-black pb-4 mb-4">
          <div className="flex items-center gap-4 mb-3">
            <img src={logoRecibo} alt="Mendonça Galvão" className="h-14 w-auto object-contain" />
            <div>
              <h1 className="text-lg font-bold">Mendonça Galvão Contadores Associados</h1>
              <p className="text-xs text-gray-600">Contabilidade • Consultoria • Assessoria</p>
            </div>
          </div>
          <h2 className="text-center text-base font-bold uppercase tracking-wide">
            Recibo de Pagamento de Férias
          </h2>
          <p className="text-center text-[10px] text-gray-500">(Capítulo VI, Título II da C.L.T.)</p>
        </header>
        <ReciboContent />
        <footer className="mt-8 pt-3 border-t border-gray-300 text-[10px] text-gray-500 text-center">
          <p>Documento gerado por Mendonça Galvão Contadores Associados</p>
          <p>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </footer>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .no-print, .navbar-blur { display: none !important; }
          .print-area {
            position: absolute; top: 0; left: 0; right: 0;
            background: white !important; color: black !important;
            font-size: 11px; padding: 15mm; margin: 0; max-width: 100%;
          }
          .bg-app::before, .bg-app::after { display: none !important; }
          @page { size: A4; margin: 10mm; }
        }
        @media screen { .print-area { display: none; } }
        @media print { .print-area { display: block !important; } }
      `}</style>
    </div>
  );
}
