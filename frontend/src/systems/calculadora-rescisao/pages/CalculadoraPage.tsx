import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, FileText, RotateCcw } from 'lucide-react';
import { Navbar } from '@calc/components/Navbar';
import { CardGraphite } from '@calc/components/CardGraphite';
import { InputDark } from '@calc/components/InputDark';
import { CpfCnpjInput } from '@calc/components/CpfCnpjInput';
import { ButtonAmber } from '@calc/components/ButtonAmber';
import { ChipSelect } from '@calc/components/ChipSelect';
import { MoneyDisplay } from '@calc/components/MoneyDisplay';
import { MoneyInput } from '@calc/components/MoneyInput';
import { DateInput } from '@calc/components/DateInput';
import { AccordionGroup, AccordionItem } from '@calc/components/AccordionMemoria';
import { Switch } from '@calc/components/ui/switch';
import { Checkbox } from '@calc/components/ui/checkbox';
import { Label } from '@calc/components/ui/label';
import { cn } from '@calc/lib/utils';
import {
  DadosRescisao,
  ResultadoCalculo,
  ProventoExtra,
  Insalubridade,
  Periculosidade,
  FGTSAnual,
  calcularRescisao,
  carregarTabelas,
  carregarConfigTributavel,
  carregarFormulario,
  salvarFormulario,
  limparFormulario,
  formatarMoeda,
  parseMoeda,
} from '@calc/lib/calculos';
import { calcularPeriodoFerias, calcularAnosEmpresa, calcularMesesNoPeriodo, gerarPeriodosAquisitivos, calcularMesesPorAno, getAnosNoPeriodo } from '@calc/lib/ferias';
import { useNavigate } from '@calc/lib/nav';

const tiposDesligamento = [
  { value: 'sem_justa_causa' as const, label: 'Sem justa causa', description: 'Multa FGTS 40%' },
  { value: 'fgts_8' as const, label: 'FGTS 8%', description: 'Sem multa 40%' },
  { value: 'acordo' as const, label: 'Acordo', description: 'Multa FGTS 20%' },
  { value: 'pedido_demissao' as const, label: 'Pedido de demissão', description: 'Sem multa' },
  { value: 'justa_causa' as const, label: 'Justa causa', description: 'Sem verbas' },
  { value: 'nao_aplicavel' as const, label: 'Não aplicável', description: 'Sem regras de desligamento' },
];

const tiposAviso = [
  { value: 'indenizado' as const, label: 'Indenizado' },
  { value: 'trabalhado' as const, label: 'Trabalhado' },
  { value: 'nao_aplicavel' as const, label: 'Não aplicável' },
];

const insalubridadeInicial: Insalubridade = {
  valorBase: 0,
  percentual: 0,
  incideDecimoTerceiro: true,
  incideFerias: true,
};

const periculosidadeInicial: Periculosidade = {
  ativo: false,
  valorBase: 0,
  incideDecimoTerceiro: true,
  incideFerias: true,
};

const dadosIniciais: DadosRescisao = {
  empresa: '',
  cnpj: '',
  colaborador: '',
  cpf: '',
  salarioBruto: 0,
  dataAdmissao: null,
  mesAnoRescisao: new Date(),
  diasTrabalhados: 30,
  anosEmpresa: 1,
  tipoDesligamento: 'sem_justa_causa',
  tipoAviso: 'indenizado',
  mesesPeriodoAquisitivo: 0,
  feriasVencidas: false,
  periodosFeriasVencidas: 0,
  mesesAno: 0,
  saldoFGTS: 0,
  faltas: 0,
  outrosDescontos: [],
  demissaoAvulsa: false,
  incluirINSS: true,
  incluirIRRF: true,
  proventosExtras: [],
  insalubridade: insalubridadeInicial,
  periculosidade: periculosidadeInicial,
  salariosPorAno: {},
  usarApenasUltimoSalario: false,
  decimoTerceiroPago: {},
  mesesPorAno: {},
  periodosPagos: {},
  incluirFGTS: true,
  fgtsOverrides: {},
};

export default function CalculadoraPage() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<DadosRescisao>(dadosIniciais);
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null);
  const [aplicarRedutor, setAplicarRedutor] = useState(false);
  const [dependentes, setDependentes] = useState(0);
  const [descontoSimplificado, setDescontoSimplificado] = useState(0);
  const [novoDesconto, setNovoDesconto] = useState({ descricao: '', valor: '' });
  const [novoProvento, setNovoProvento] = useState({ descricao: '', valor: '', incideDecimoTerceiro: true, incideFerias: true });
  const [feriasDobradas, setFeriasDobradas] = useState(false);
  

  // Carregar formulário salvo
  useEffect(() => {
    const formSalvo = carregarFormulario();
    if (formSalvo) {
      setDados({
        ...dadosIniciais,
        ...formSalvo,
        dataAdmissao: formSalvo.dataAdmissao ? new Date(formSalvo.dataAdmissao) : null,
        mesAnoRescisao: new Date(formSalvo.mesAnoRescisao),
        demissaoAvulsa: formSalvo.demissaoAvulsa ?? false,
        incluirINSS: formSalvo.incluirINSS ?? true,
        incluirIRRF: formSalvo.incluirIRRF ?? true,
        proventosExtras: formSalvo.proventosExtras ?? [],
        insalubridade: formSalvo.insalubridade ?? insalubridadeInicial,
        periculosidade: formSalvo.periculosidade ?? periculosidadeInicial,
        salariosPorAno: formSalvo.salariosPorAno ?? {},
        usarApenasUltimoSalario: formSalvo.usarApenasUltimoSalario ?? false,
        decimoTerceiroPago: formSalvo.decimoTerceiroPago ?? {},
        mesesPorAno: formSalvo.mesesPorAno ?? {},
        periodosPagos: formSalvo.periodosPagos ?? {},
        incluirFGTS: formSalvo.incluirFGTS ?? true,
        fgtsOverrides: formSalvo.fgtsOverrides ?? {},
      });
    }
  }, []);

  // Calcular férias, período e dias trabalhados automaticamente quando datas mudam
  useEffect(() => {
    if (dados.mesAnoRescisao) {
      // Calcular dias trabalhados no mês
      const rescisao = dados.mesAnoRescisao;
      const diaRescisao = rescisao.getDate();
      
      let diasTrabalhados = diaRescisao;
      
      // Se admissão é no mesmo mês/ano da rescisão, calcular diferença
      if (dados.dataAdmissao) {
        const admissao = dados.dataAdmissao;
        if (
          admissao.getMonth() === rescisao.getMonth() &&
          admissao.getFullYear() === rescisao.getFullYear()
        ) {
          // Dias entre admissão e rescisão (inclusive)
          diasTrabalhados = diaRescisao - admissao.getDate() + 1;
        }
      }
      
      // Calcular férias e outros períodos
      if (dados.dataAdmissao) {
        const periodoFerias = calcularPeriodoFerias(dados.dataAdmissao, dados.mesAnoRescisao);
        const anosEmpresa = calcularAnosEmpresa(dados.dataAdmissao, dados.mesAnoRescisao);
        const mesesAno = calcularMesesNoPeriodo(dados.dataAdmissao, dados.mesAnoRescisao);
        const mesesPorAno = calcularMesesPorAno(dados.dataAdmissao, dados.mesAnoRescisao);
        const anos = getAnosNoPeriodo(dados.dataAdmissao, dados.mesAnoRescisao);
        
        // Gerar períodos aquisitivos e calcular férias vencidas não pagas
        const periodos = gerarPeriodosAquisitivos(dados.dataAdmissao, dados.mesAnoRescisao);
        const periodosCompletosNaoPagos = periodos.filter(p => p.completo && !dados.periodosPagos[p.label]);
        const periodosCompletosPagos = periodos.filter(p => p.completo && dados.periodosPagos[p.label]).length;
        const totalPeriodosCompletos = periodos.filter(p => p.completo).length;
        
        // Férias dobradas: avaliação individual por período (CLT art. 137)
        const algumPeriodoDobrado = periodosCompletosNaoPagos.some(p => p.dobrado);
        setFeriasDobradas(algumPeriodoDobrado);
        
        // Contar períodos: cada período dobrado conta como 2
        const totalPeriodosVencidos = periodosCompletosNaoPagos.reduce(
          (acc, p) => acc + (p.dobrado ? 2 : 1), 0
        );
        
        setDados(prev => {
          const novosSalarios = { ...prev.salariosPorAno };
          anos.forEach(ano => {
            if (!(ano in novosSalarios)) {
              novosSalarios[ano] = prev.salarioBruto;
            }
          });
          
          return {
            ...prev,
            diasTrabalhados: Math.max(0, diasTrabalhados),
            mesesPeriodoAquisitivo: periodoFerias.mesesPeriodoAquisitivo - (totalPeriodosCompletos * 12),
            feriasVencidas: periodosCompletosNaoPagos.length > 0,
            periodosFeriasVencidas: totalPeriodosVencidos,
            anosEmpresa,
            mesesAno: Object.entries(prev.decimoTerceiroPago || {}).reduce(
              (acc, [, pago]) => pago ? acc - 12 : acc,
              mesesAno
            ),
            mesesPorAno,
            salariosPorAno: novosSalarios,
          };
        });
      } else {
        setDados(prev => ({
          ...prev,
          diasTrabalhados: Math.max(0, diasTrabalhados),
          mesesPorAno: {},
        }));
      }
    }
  }, [dados.dataAdmissao, dados.mesAnoRescisao, dados.periodosPagos]);

  // Autosave
  useEffect(() => {
    const timer = setTimeout(() => {
      salvarFormulario(dados);
    }, 1000);
    return () => clearTimeout(timer);
  }, [dados]);

  // Calcular resultado
  const calcular = useCallback(() => {
    const { tabelaINSS, tabelaIRRF } = carregarTabelas();
    const configTributavel = carregarConfigTributavel();
    
    const result = calcularRescisao(
      dados,
      tabelaINSS,
      tabelaIRRF,
      configTributavel,
      aplicarRedutor,
      dependentes,
      descontoSimplificado,
      dados.incluirINSS,
      dados.incluirIRRF
    );
    
    setResultado(result);
  }, [dados, aplicarRedutor, dependentes, descontoSimplificado]);

  // Recalcular quando dados mudam
  useEffect(() => {
    if (dados.salarioBruto > 0) {
      calcular();
    }
  }, [dados, calcular]);

  const handleLimpar = () => {
    setDados(dadosIniciais);
    setFeriasDobradas(false);
    
    setNovoProvento({ descricao: '', valor: '', incideDecimoTerceiro: true, incideFerias: true });
    setResultado(null);
    limparFormulario();
  };

  const handleVerRecibo = () => {
    navigate('/recibo');
  };

  const handleVerFolha = () => {
    navigate('/folha');
  };

  const handleVerFerias = () => {
    navigate('/ferias');
  };

  const adicionarDesconto = () => {
    if (novoDesconto.descricao && novoDesconto.valor) {
      setDados({
        ...dados,
        outrosDescontos: [
          ...dados.outrosDescontos,
          { descricao: novoDesconto.descricao, valor: parseMoeda(novoDesconto.valor) }
        ],
      });
      setNovoDesconto({ descricao: '', valor: '' });
    }
  };

  const adicionarProvento = () => {
    if (novoProvento.descricao && novoProvento.valor) {
      const novoItem: ProventoExtra = {
        descricao: novoProvento.descricao,
        valor: parseMoeda(novoProvento.valor),
        incideDecimoTerceiro: novoProvento.incideDecimoTerceiro,
        incideFerias: novoProvento.incideFerias,
      };
      setDados({
        ...dados,
        proventosExtras: [...dados.proventosExtras, novoItem],
      });
      setNovoProvento({ descricao: '', valor: '', incideDecimoTerceiro: true, incideFerias: true });
    }
  };

  const removerProvento = (index: number) => {
    setDados({
      ...dados,
      proventosExtras: dados.proventosExtras.filter((_, i) => i !== index),
    });
  };

  const atualizarProventoIncidencia = (index: number, campo: 'incideDecimoTerceiro' | 'incideFerias', valor: boolean) => {
    const novos = [...dados.proventosExtras];
    novos[index] = { ...novos[index], [campo]: valor };
    setDados({ ...dados, proventosExtras: novos });
  };

  const removerDesconto = (index: number) => {
    setDados({
      ...dados,
      outrosDescontos: dados.outrosDescontos.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="bg-app min-h-screen">
      <Navbar />
      
      <main className="relative z-10 pt-24 pb-12 px-4 md:px-8">
        <div className="container mx-auto max-w-7xl">
          <CardGraphite className="mb-6 animate-fade-in">
            <div className="flex flex-wrap gap-2 justify-end mb-6">
              <ButtonAmber variant="ghost" size="sm" onClick={handleLimpar} className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                <span>Limpar</span>
              </ButtonAmber>
              <ButtonAmber variant="outline" size="sm" onClick={handleVerRecibo} className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Recibo de Rescisão</span>
              </ButtonAmber>
              <ButtonAmber variant="outline" size="sm" onClick={handleVerFolha} className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Recibo de Folha</span>
              </ButtonAmber>
              <ButtonAmber variant="outline" size="sm" onClick={handleVerFerias} className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Recibo de Férias</span>
              </ButtonAmber>
            </div>

            {/* Identificação */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Identificação
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Empresa</Label>
                  <InputDark
                    placeholder="Nome da empresa"
                    value={dados.empresa}
                    onChange={(e) => setDados({ ...dados, empresa: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">CNPJ / CPF</Label>
                  <CpfCnpjInput
                    value={dados.cnpj}
                    onChange={(e) => setDados({ ...dados, cnpj: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Colaborador</Label>
                  <InputDark
                    placeholder="Nome do colaborador"
                    value={dados.colaborador}
                    onChange={(e) => setDados({ ...dados, colaborador: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">CPF (opcional)</Label>
                  <InputDark
                    mask="999.999.999-99"
                    placeholder="000.000.000-00"
                    value={dados.cpf}
                    onChange={(e) => setDados({ ...dados, cpf: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* Base e Período */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Base e Período
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Salário Bruto Mensal</Label>
                  <MoneyInput
                    value={dados.salarioBruto}
                    onChange={(value) => setDados({ ...dados, salarioBruto: value })}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Data de Admissão</Label>
                  <DateInput
                    value={dados.dataAdmissao}
                    onChange={(date) => setDados({ ...dados, dataAdmissao: date })}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Data da Rescisão</Label>
                  <DateInput
                    value={dados.mesAnoRescisao}
                    onChange={(date) => date && setDados({ ...dados, mesAnoRescisao: date })}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Dias Trabalhados no Mês</Label>
                <InputDark
                  type="number"
                  min={0}
                  max={31}
                  value={dados.diasTrabalhados}
                  onChange={(e) => setDados({ ...dados, diasTrabalhados: parseInt(e.target.value) || 0 })}
                  className="max-w-32"
                />
              </div>
              {/* Salários por Ano */}
              {dados.dataAdmissao && (() => {
                const anos = getAnosNoPeriodo(dados.dataAdmissao, dados.mesAnoRescisao);
                if (anos.length <= 1) return null;
                return (
                  <div className="mt-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      Salário Bruto por Ano
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      ℹ️ Informe o salário de cada ano para cálculos de 13º, FGTS e Férias
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {anos.map(ano => (
                        <div key={ano}>
                          <Label className="text-xs text-muted-foreground mb-1 block">Salário {ano}</Label>
                          <MoneyInput
                            value={dados.salariosPorAno[ano] ?? dados.salarioBruto}
                            onChange={(value) => setDados(prev => ({
                              ...prev,
                              salariosPorAno: { ...prev.salariosPorAno, [ano]: value }
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Checkbox
                        id="usarApenasUltimoSalario"
                        checked={dados.usarApenasUltimoSalario}
                        onCheckedChange={(checked) => setDados(prev => ({
                          ...prev,
                          usarApenasUltimoSalario: !!checked,
                        }))}
                      />
                      <Label htmlFor="usarApenasUltimoSalario" className="text-xs text-muted-foreground cursor-pointer">
                        Considere apenas o último salário
                      </Label>
                    </div>
                  </div>
                );
              })()}
              {feriasDobradas && (
                <p className="mt-3 text-sm text-warning bg-warning/10 px-4 py-2 rounded-lg">
                  ⚠️ Há período(s) aquisitivo(s) com prazo concessivo expirado (art. 137, CLT) - férias dobradas aplicadas individualmente.
                </p>
              )}
            </section>

            {/* Tipo de Desligamento */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Tipo de Desligamento
              </h2>
              <ChipSelect
                options={tiposDesligamento}
                value={dados.tipoDesligamento}
                onChange={(value) => setDados({ ...dados, tipoDesligamento: value, demissaoAvulsa: false })}
              />
              {dados.tipoDesligamento === 'sem_justa_causa' && (
                <div className="mt-4 flex items-center gap-3">
                  <Switch
                    checked={dados.demissaoAvulsa}
                    onCheckedChange={(checked) => setDados({ ...dados, demissaoAvulsa: checked })}
                  />
                  <Label className="text-sm text-foreground">
                    Demissão Avulsa (inclui saldo FGTS no recibo)
                  </Label>
                </div>
              )}
              {dados.tipoDesligamento === 'acordo' && (
                <p className="mt-3 text-sm text-primary bg-primary/10 px-4 py-2 rounded-lg">
                  ℹ️ No acordo, o colaborador pode sacar até 80% do saldo do FGTS.
                </p>
              )}
              {dados.tipoDesligamento === 'fgts_8' && (
                <p className="mt-3 text-sm text-primary bg-primary/10 px-4 py-2 rounded-lg">
                  ℹ️ FGTS 8%: Mesmo cálculo de demissão sem justa causa, mas sem a multa de 40%. O saldo FGTS será incluído no recibo.
                </p>
              )}
            </section>

            {/* Aviso Prévio */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Aviso Prévio
              </h2>
              <ChipSelect
                options={tiposAviso}
                value={dados.tipoAviso}
                onChange={(value) => setDados({ ...dados, tipoAviso: value })}
                disabled={dados.tipoDesligamento === 'justa_causa' || dados.tipoDesligamento === 'nao_aplicavel'}
              />
              {dados.tipoAviso === 'indenizado' && dados.tipoDesligamento !== 'justa_causa' && dados.tipoDesligamento !== 'nao_aplicavel' && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Dias de aviso: <span className="font-mono-numbers text-foreground">{Math.min(30 + 3 * dados.anosEmpresa, 90)}</span> dias
                </p>
              )}
            </section>

            {/* Férias */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Férias
              </h2>
              {dados.dataAdmissao && (
                <p className="text-xs text-muted-foreground mb-3">
                  ℹ️ Calculado automaticamente com base nas datas de admissão e rescisão
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Meses no Período Aquisitivo</Label>
                  <InputDark
                    type="number"
                    min={0}
                    value={dados.mesesPeriodoAquisitivo}
                    onChange={(e) => setDados({ ...dados, mesesPeriodoAquisitivo: parseInt(e.target.value) || 0 })}
                    disabled={dados.tipoDesligamento === 'justa_causa' || dados.tipoDesligamento === 'nao_aplicavel'}
                    className="max-w-32"
                  />
                </div>
              </div>
              {/* Períodos aquisitivos com flags individuais */}
              {dados.dataAdmissao && (() => {
                const periodos = gerarPeriodosAquisitivos(dados.dataAdmissao, dados.mesAnoRescisao);
                const periodosCompletos = periodos.filter(p => p.completo);
                if (periodosCompletos.length === 0) return null;
                return (
                  <div className="mt-4 space-y-3">
                    <Label className="text-sm text-muted-foreground block">Períodos Aquisitivos Vencidos</Label>
                    {periodosCompletos.map((periodo) => (
                      <div key={periodo.label} className="flex items-center gap-3">
                        <Switch
                          checked={dados.periodosPagos[periodo.label] || false}
                          onCheckedChange={(checked) => {
                            setDados(prev => ({ ...prev, periodosPagos: { ...prev.periodosPagos, [periodo.label]: checked } }));
                          }}
                        />
                        <Label className="text-sm text-foreground">
                          Do período aquisitivo {periodo.label}, foi pago?
                        </Label>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* 13º Salário */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                13º Salário
              </h2>
              {dados.dataAdmissao && (
                <p className="text-xs text-muted-foreground mb-3">
                  ℹ️ Calculado automaticamente com base nas datas de admissão e rescisão
                </p>
              )}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Meses Trabalhados no Período</Label>
                <InputDark
                  type="number"
                  min={0}
                  value={dados.mesesAno}
                  onChange={(e) => setDados({ ...dados, mesesAno: parseInt(e.target.value) || 0 })}
                  disabled={dados.tipoDesligamento === 'justa_causa' || dados.tipoDesligamento === 'nao_aplicavel'}
                  className="max-w-32"
                />
              </div>
              {/* 13º pago por ano */}
              {dados.dataAdmissao && (() => {
                const anos = getAnosNoPeriodo(dados.dataAdmissao, dados.mesAnoRescisao);
                const anoRescisao = dados.mesAnoRescisao.getFullYear();
                const anosAnteriores = anos.filter(a => a < anoRescisao);
                if (anosAnteriores.length === 0) return null;
                return (
                  <div className="mt-4 space-y-3">
                    <Label className="text-sm text-muted-foreground block">13º já pago?</Label>
                    {anosAnteriores.map(ano => (
                      <div key={ano} className="flex items-center gap-3">
                        <Switch
                          checked={dados.decimoTerceiroPago[ano] || false}
                          onCheckedChange={(checked) => {
                            setDados(prev => {
                              const delta = checked ? -12 : 12;
                              return {
                                ...prev,
                                decimoTerceiroPago: { ...prev.decimoTerceiroPago, [ano]: checked },
                                mesesAno: Math.max(0, prev.mesesAno + delta),
                              };
                            });
                          }}
                        />
                        <Label className="text-sm text-foreground">
                          13º de {ano}, foi pago?
                        </Label>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </section>

            {/* FGTS */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                FGTS
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                ℹ️ 8% sobre cada competência mensal + 13º proporcional. Verifique e ajuste os valores abaixo.
              </p>
              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-border bg-background-subtle">
                <Switch
                  checked={dados.incluirFGTS !== false}
                  onCheckedChange={(checked) => setDados({ ...dados, incluirFGTS: checked })}
                />
                <Label className="text-sm text-foreground">
                  Incluir FGTS no cálculo da rescisão
                </Label>
              </div>
              {resultado && resultado.fgtsDetalhado && resultado.fgtsDetalhado.length > 0 ? (
                <div className="space-y-4">
                  {resultado.fgtsDetalhado.map((anoData) => (
                    <div key={anoData.ano} className="rounded-xl border border-border overflow-hidden">
                      <div className="px-4 py-3 bg-background-subtle flex items-center justify-between">
                        <span className="font-semibold text-foreground">{anoData.ano}</span>
                        <span className="font-mono text-sm text-muted-foreground">
                          Subtotal: R$ {formatarMoeda(anoData.subtotal)}
                        </span>
                      </div>
                      <div className="px-4 py-3 bg-card-alt">
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 gap-y-2 text-xs font-mono items-center">
                          <span className="text-muted-foreground font-semibold pb-1 text-center">Incluir</span>
                          <span className="text-muted-foreground font-semibold pb-1">Competência</span>
                          <span className="text-muted-foreground font-semibold pb-1 text-right">Base</span>
                          <span className="text-muted-foreground font-semibold pb-1 text-center">×8%</span>
                          <span className="text-muted-foreground font-semibold pb-1 text-right">FGTS (editável)</span>
                          {anoData.competencias.map((comp, i) => {
                            const ov = dados.fgtsOverrides?.[comp.competencia];
                            const incluido = comp.incluido;
                            const disabledGeral = dados.incluirFGTS === false;
                            return (
                              <div key={i} className="contents">
                                <div className="flex justify-center">
                                  <Checkbox
                                    checked={ov?.incluido !== false}
                                    disabled={disabledGeral}
                                    onCheckedChange={(checked) => {
                                      const next = { ...(dados.fgtsOverrides || {}) };
                                      next[comp.competencia] = { ...next[comp.competencia], incluido: checked === true };
                                      setDados({ ...dados, fgtsOverrides: next });
                                    }}
                                  />
                                </div>
                                <span className={`py-0.5 ${incluido ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                                  {comp.competencia} <span className="text-muted-foreground">({comp.tipo})</span>
                                </span>
                                <span className={`text-right py-0.5 ${incluido ? 'text-foreground' : 'text-muted-foreground'}`}>R$ {formatarMoeda(comp.base)}</span>
                                <span className="text-muted-foreground text-center py-0.5">×8%</span>
                                <div className="flex items-center justify-end gap-1">
                                  <MoneyInput
                                    value={comp.valor}
                                    disabled={disabledGeral || !incluido}
                                    className="w-32 h-8 text-xs text-right"
                                    onChange={(value) => {
                                      const next = { ...(dados.fgtsOverrides || {}) };
                                      const original = comp.valorOriginal;
                                      if (Math.abs(value - original) < 0.005) {
                                        next[comp.competencia] = { ...next[comp.competencia], valor: undefined };
                                      } else {
                                        next[comp.competencia] = { ...next[comp.competencia], valor: value };
                                      }
                                      setDados({ ...dados, fgtsOverrides: next });
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-4 bg-primary/10 rounded-xl px-4 border border-primary/30">
                    <span className="font-bold text-foreground">Total FGTS</span>
                    <MoneyDisplay value={resultado.saldoFGTS} size="lg" className="text-primary" />
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground">Informe as datas de admissão e rescisão para calcular o FGTS.</p>
                  {resultado && (
                    <p className="text-lg font-semibold text-foreground mt-1 font-mono">
                      R$ {resultado.saldoFGTS.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Insalubridade */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Insalubridade
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Valor Base (Salário Mínimo ou Piso)</Label>
                  <MoneyInput
                    value={dados.insalubridade.valorBase}
                    onChange={(value) => setDados({
                      ...dados,
                      insalubridade: { ...dados.insalubridade, valorBase: value }
                    })}
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Percentual de Insalubridade</Label>
                  <ChipSelect
                    options={[
                      { value: '0' as const, label: 'Nenhum' },
                      { value: '10' as const, label: '10%', description: 'Grau mínimo' },
                      { value: '20' as const, label: '20%', description: 'Grau médio' },
                      { value: '40' as const, label: '40%', description: 'Grau máximo' },
                    ]}
                    value={String(dados.insalubridade.percentual) as '0' | '10' | '20' | '40'}
                    onChange={(value) => setDados({
                      ...dados,
                      insalubridade: { ...dados.insalubridade, percentual: parseInt(value) as 0 | 10 | 20 | 40 }
                    })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dados.insalubridade.incideDecimoTerceiro}
                    onCheckedChange={(checked) => setDados({
                      ...dados,
                      insalubridade: { ...dados.insalubridade, incideDecimoTerceiro: checked }
                    })}
                  />
                  <Label className="text-sm text-foreground">Incide no 13º</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dados.insalubridade.incideFerias}
                    onCheckedChange={(checked) => setDados({
                      ...dados,
                      insalubridade: { ...dados.insalubridade, incideFerias: checked }
                    })}
                  />
                  <Label className="text-sm text-foreground">Incide nas férias</Label>
                </div>
              </div>
            </section>

            {/* Periculosidade */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Periculosidade
              </h2>
              <div className="flex flex-wrap gap-6 mb-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dados.periculosidade.ativo}
                    onCheckedChange={(checked) => setDados({
                      ...dados,
                      periculosidade: { ...dados.periculosidade, ativo: checked }
                    })}
                  />
                  <Label className="text-sm text-foreground">Ativar Periculosidade (30%)</Label>
                </div>
              </div>
              {dados.periculosidade.ativo && (
                <>
                  <div className="mb-4">
                    <Label className="text-sm text-muted-foreground mb-2 block">Valor Base (deixe vazio para usar salário bruto)</Label>
                    <MoneyInput
                      value={dados.periculosidade.valorBase}
                      onChange={(value) => setDados({
                        ...dados,
                        periculosidade: { ...dados.periculosidade, valorBase: value }
                      })}
                      className="max-w-64"
                    />
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={dados.periculosidade.incideDecimoTerceiro}
                        onCheckedChange={(checked) => setDados({
                          ...dados,
                          periculosidade: { ...dados.periculosidade, incideDecimoTerceiro: checked }
                        })}
                      />
                      <Label className="text-sm text-foreground">Incide no 13º</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={dados.periculosidade.incideFerias}
                        onCheckedChange={(checked) => setDados({
                          ...dados,
                          periculosidade: { ...dados.periculosidade, incideFerias: checked }
                        })}
                      />
                      <Label className="text-sm text-foreground">Incide nas férias</Label>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Proventos Extras */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Adicionar Proventos
              </h2>
              
              {dados.proventosExtras.length > 0 && (
                <div className="space-y-2 mb-4">
                  {dados.proventosExtras.map((prov, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 bg-background-subtle p-3 rounded-lg">
                      <span className="flex-1 text-foreground min-w-[120px]">{prov.descricao}</span>
                      <span className="font-mono-numbers text-muted-foreground">R$ {formatarMoeda(prov.valor)}</span>
                      <div className="flex items-center gap-2 ml-2">
                        <Switch
                          checked={prov.incideDecimoTerceiro}
                          onCheckedChange={(checked) => atualizarProventoIncidencia(index, 'incideDecimoTerceiro', checked)}
                        />
                        <Label className="text-xs text-muted-foreground">13º</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={prov.incideFerias}
                          onCheckedChange={(checked) => atualizarProventoIncidencia(index, 'incideFerias', checked)}
                        />
                        <Label className="text-xs text-muted-foreground">Férias</Label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removerProvento(index)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[150px]">
                  <Label className="text-sm text-muted-foreground mb-2 block">Descrição</Label>
                  <InputDark
                    placeholder="Ex: Hora extra, Comissão..."
                    value={novoProvento.descricao}
                    onChange={(e) => setNovoProvento({ ...novoProvento, descricao: e.target.value })}
                  />
                </div>
                <div className="w-32">
                  <Label className="text-sm text-muted-foreground mb-2 block">Valor</Label>
                  <InputDark
                    placeholder="R$ 0,00"
                    value={novoProvento.valor}
                    onChange={(e) => setNovoProvento({ ...novoProvento, valor: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={novoProvento.incideDecimoTerceiro}
                    onCheckedChange={(checked) => setNovoProvento({ ...novoProvento, incideDecimoTerceiro: checked })}
                  />
                  <Label className="text-xs text-muted-foreground">13º</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={novoProvento.incideFerias}
                    onCheckedChange={(checked) => setNovoProvento({ ...novoProvento, incideFerias: checked })}
                  />
                  <Label className="text-xs text-muted-foreground">Férias</Label>
                </div>
                <ButtonAmber variant="outline" size="md" onClick={adicionarProvento}>
                  <Plus className="w-4 h-4" />
                </ButtonAmber>
              </div>
            </section>

            {/* Descontos */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Descontos
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">Faltas / Adiantamentos</Label>
                  <MoneyInput
                    value={dados.faltas}
                    onChange={(value) => setDados({ ...dados, faltas: value })}
                  />
                </div>
              </div>
              
              <Label className="text-sm text-muted-foreground mb-2 block">Outros Descontos</Label>
              <div className="space-y-2 mb-4">
                {dados.outrosDescontos.map((desc, index) => (
                  <div key={index} className="flex items-center gap-2 bg-background-subtle p-3 rounded-lg">
                    <span className="flex-1 text-foreground">{desc.descricao}</span>
                    <span className="font-mono-numbers text-muted-foreground">R$ {formatarMoeda(desc.valor)}</span>
                    <button
                      type="button"
                      onClick={() => removerDesconto(index)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <InputDark
                  placeholder="Descrição"
                  value={novoDesconto.descricao}
                  onChange={(e) => setNovoDesconto({ ...novoDesconto, descricao: e.target.value })}
                  className="flex-1"
                />
                <InputDark
                  placeholder="R$ 0,00"
                  value={novoDesconto.valor}
                  onChange={(e) => setNovoDesconto({ ...novoDesconto, valor: e.target.value })}
                  className="w-32"
                />
                <ButtonAmber variant="outline" size="md" onClick={adicionarDesconto}>
                  <Plus className="w-4 h-4" />
                </ButtonAmber>
              </div>
            </section>

            {/* Opções de Impostos */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Opções de Impostos
              </h2>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={dados.incluirINSS}
                      onCheckedChange={(checked) => setDados({ ...dados, incluirINSS: checked })}
                    />
                    <Label className="text-sm text-foreground">
                      Incluir INSS
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={dados.incluirIRRF}
                      onCheckedChange={(checked) => setDados({ ...dados, incluirIRRF: checked })}
                    />
                    <Label className="text-sm text-foreground">
                      Incluir IRRF
                    </Label>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={aplicarRedutor}
                    onCheckedChange={setAplicarRedutor}
                    disabled={!dados.incluirIRRF}
                  />
                  <Label className={cn("text-sm text-foreground", !dados.incluirIRRF && "text-muted-foreground")}>
                    Aplicar Redutor Mensal IRRF (isenção até R$ 5.000,00)
                  </Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Dependentes</Label>
                    <InputDark
                      type="number"
                      min={0}
                      value={dependentes}
                      onChange={(e) => setDependentes(parseInt(e.target.value) || 0)}
                      className="max-w-32"
                      disabled={!dados.incluirIRRF}
                    />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Desconto Simplificado Mensal</Label>
                    <InputDark
                      placeholder="R$ 0,00"
                      value={descontoSimplificado ? formatarMoeda(descontoSimplificado) : ''}
                      onChange={(e) => setDescontoSimplificado(parseMoeda(e.target.value))}
                      disabled={!dados.incluirIRRF}
                    />
                  </div>
                </div>
              </div>
            </section>
          </CardGraphite>

          {/* Resultado */}
          {resultado && (
            <>
              {/* Memória de Cálculo */}
              <CardGraphite className="mb-6 animate-fade-in">
                <h2 className="text-xl font-semibold text-foreground mb-6">Memória de Cálculo</h2>
                <AccordionGroup>
                  {resultado.memorias.map((mem, index) => (
                    <AccordionItem key={index} title={mem.descricao}>
                      <div className="space-y-2 font-mono text-sm">
                        <p className="text-muted-foreground">Fórmula: <span className="text-foreground">{mem.formula}</span></p>
                        <p className="text-muted-foreground">Cálculo: <span className="text-foreground">{mem.substituicao}</span></p>
                        <p className="text-muted-foreground">
                          Resultado: <MoneyDisplay value={mem.resultado} size="md" />
                        </p>
                      </div>
                    </AccordionItem>
                  ))}
                  
                  {/* FGTS Detalhado por Competência */}
                  {resultado.fgtsDetalhado && resultado.fgtsDetalhado.length > 0 && (
                    <AccordionItem title="FGTS — Detalhamento por Competência">
                      <div className="space-y-6 font-mono text-sm">
                        {resultado.fgtsDetalhado.map((anoData) => (
                          <div key={anoData.ano}>
                            <h4 className="text-foreground font-semibold mb-2 text-base">{anoData.ano}</h4>
                            <div className="space-y-1">
                              {anoData.competencias.map((comp, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-border/50">
                                  <span className="text-muted-foreground text-xs">
                                    {comp.competencia} <span className="text-xs opacity-70">({comp.tipo})</span>
                                  </span>
                                  <span className="text-foreground text-xs">
                                    R$ {formatarMoeda(comp.base)} × {comp.percentual}% = R$ {formatarMoeda(comp.valor)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center pt-2 mt-1">
                              <span className="text-muted-foreground font-semibold text-xs">Subtotal {anoData.ano}</span>
                              <span className="text-foreground font-semibold">R$ {formatarMoeda(anoData.subtotal)}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-3 border-t border-border mt-2">
                          <span className="text-foreground font-bold">Total FGTS</span>
                          <MoneyDisplay value={resultado.saldoFGTS} size="md" />
                        </div>
                      </div>
                    </AccordionItem>
                  )}
                  <AccordionItem title="INSS (Detalhamento por Faixas)">
                    <div className="space-y-2 font-mono text-sm">
                      <p className="text-muted-foreground mb-3">
                        Base: <MoneyDisplay value={resultado.baseINSS} size="md" />
                      </p>
                      {resultado.detalheINSS.map((det, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-border">
                          <span className="text-muted-foreground text-xs">{det.faixa}</span>
                          <span className="text-foreground">
                            {det.aliquota}% × R$ {formatarMoeda(det.base)} = R$ {formatarMoeda(det.valor)}
                          </span>
                        </div>
                      ))}
                      <p className="pt-2 text-muted-foreground">
                        Total INSS: <MoneyDisplay value={resultado.inss} size="md" />
                      </p>
                    </div>
                  </AccordionItem>

                  <AccordionItem title="IRRF (Detalhamento)">
                    <div className="space-y-2 font-mono text-sm">
                      {resultado.detalheIRRF.map((det, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-border">
                          <span className="text-muted-foreground">{det.descricao}</span>
                          <span className={cn('text-foreground', det.valor < 0 && 'text-green-400')}>
                            R$ {formatarMoeda(Math.abs(det.valor))}
                            {det.valor < 0 && ' (-)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionItem>
                </AccordionGroup>
              </CardGraphite>

              {/* Resumo Final */}
              <CardGraphite className="animate-fade-in">
                <h2 className="text-xl font-semibold text-foreground mb-6">Resumo da Rescisão</h2>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-muted-foreground">Saldo de Salário</span>
                    <MoneyDisplay value={resultado.saldoSalario} size="md" />
                  </div>
                  {resultado.avisoIndenizado > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Aviso Prévio Indenizado</span>
                      <MoneyDisplay value={resultado.avisoIndenizado} size="md" />
                    </div>
                  )}
                  {(resultado.feriasProporcionais + resultado.tercoFerias) > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Férias Proporcionais + 1/3</span>
                      <MoneyDisplay value={resultado.feriasProporcionais + resultado.tercoFerias} size="md" />
                    </div>
                  )}
                  {(resultado.feriasVencidas + resultado.tercoFeriasVencidas) > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Férias Vencidas + 1/3</span>
                      <MoneyDisplay value={resultado.feriasVencidas + resultado.tercoFeriasVencidas} size="md" />
                    </div>
                  )}
                  {resultado.decimoTerceiro > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">13º Proporcional</span>
                      <MoneyDisplay value={resultado.decimoTerceiro} size="md" />
                    </div>
                  )}
                  {resultado.multaFGTS > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Multa FGTS</span>
                      <MoneyDisplay value={resultado.multaFGTS} size="md" />
                    </div>
                  )}
                  {resultado.insalubridadeValor > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Insalubridade</span>
                      <MoneyDisplay value={resultado.insalubridadeValor} size="md" />
                    </div>
                  )}
                  {resultado.periculosidadeValor > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Periculosidade</span>
                      <MoneyDisplay value={resultado.periculosidadeValor} size="md" />
                    </div>
                  )}
                  {resultado.proventosExtrasTotal > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Proventos Extras</span>
                      <MoneyDisplay value={resultado.proventosExtrasTotal} size="md" />
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center py-4 bg-background-subtle rounded-xl px-4 mt-6">
                    <span className="font-semibold text-foreground">Total Bruto</span>
                    <MoneyDisplay value={resultado.bruto} size="lg" />
                  </div>

                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-muted-foreground">(-) INSS</span>
                    <MoneyDisplay value={resultado.inss} size="md" />
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-border">
                    <span className="text-muted-foreground">(-) IRRF</span>
                    <MoneyDisplay value={resultado.irrf} size="md" />
                  </div>
                  {resultado.outrosDescontosTotal > 0 && (
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">(-) Outros Descontos</span>
                      <MoneyDisplay value={resultado.outrosDescontosTotal} size="md" />
                    </div>
                  )}

                  <div className="flex justify-between items-center py-4 bg-primary/10 rounded-xl px-4 mt-6 border border-primary/30">
                    <span className="font-bold text-xl text-foreground">Valor Líquido</span>
                    <MoneyDisplay value={resultado.liquido} size="xl" className="text-primary" />
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <ButtonAmber size="lg" onClick={handleVerRecibo} className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Recibo de Rescisão</span>
                  </ButtonAmber>
                  <ButtonAmber size="lg" variant="outline" onClick={handleVerFolha} className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Recibo de Folha</span>
                  </ButtonAmber>
                  <ButtonAmber size="lg" variant="outline" onClick={handleVerFerias} className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    <span>Recibo de Férias</span>
                  </ButtonAmber>
                </div>
              </CardGraphite>
            </>
          )}
        </div>
      </main>

      {/* Rodapé */}
      <footer className="no-print py-6 mt-8 border-t border-border/50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Mendonça Galvão - Núcleo Digital. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
