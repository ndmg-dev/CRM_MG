import { useState, useEffect } from 'react';
import { Save, RotateCcw, Download, Upload } from 'lucide-react';
import { Navbar } from '@calc/components/Navbar';
import { CardGraphite } from '@calc/components/CardGraphite';
import { InputDark } from '@calc/components/InputDark';
import { ButtonAmber } from '@calc/components/ButtonAmber';
import { Switch } from '@calc/components/ui/switch';
import { Label } from '@calc/components/ui/label';
import { toast } from 'sonner';
import {
  TabelaINSS,
  TabelaIRRF,
  ConfigTributavel,
  TABELA_INSS_PADRAO,
  TABELA_IRRF_PADRAO,
  CONFIG_TRIBUTAVEL_PADRAO,
  salvarTabelas,
  carregarTabelas,
  salvarConfigTributavel,
  carregarConfigTributavel,
  formatarMoeda,
  parseMoeda,
} from '@calc/lib/calculos';

export default function TabelasPage() {
  const [tabelaINSS, setTabelaINSS] = useState<TabelaINSS[]>(TABELA_INSS_PADRAO);
  const [tabelaIRRF, setTabelaIRRF] = useState<TabelaIRRF[]>(TABELA_IRRF_PADRAO);
  const [configTributavel, setConfigTributavel] = useState<ConfigTributavel>(CONFIG_TRIBUTAVEL_PADRAO);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const { tabelaINSS: inss, tabelaIRRF: irrf } = carregarTabelas();
      const config = carregarConfigTributavel();
      if (inss && Array.isArray(inss) && inss.length > 0) {
        setTabelaINSS(inss);
      }
      if (irrf && Array.isArray(irrf) && irrf.length > 0) {
        setTabelaIRRF(irrf);
      }
      if (config) {
        setConfigTributavel({
          ...CONFIG_TRIBUTAVEL_PADRAO,
          ...config,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar tabelas:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSalvar = () => {
    salvarTabelas(tabelaINSS, tabelaIRRF);
    salvarConfigTributavel(configTributavel);
    toast.success('Tabelas salvas com sucesso!');
  };

  const handleRestaurar = () => {
    setTabelaINSS(TABELA_INSS_PADRAO);
    setTabelaIRRF(TABELA_IRRF_PADRAO);
    setConfigTributavel(CONFIG_TRIBUTAVEL_PADRAO);
    salvarTabelas(TABELA_INSS_PADRAO, TABELA_IRRF_PADRAO);
    salvarConfigTributavel(CONFIG_TRIBUTAVEL_PADRAO);
    toast.success('Tabelas restauradas para os valores padrão!');
  };

  const handleExportar = () => {
    const data = {
      tabelaINSS,
      tabelaIRRF,
      configTributavel,
      exportadoEm: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tabelas-rescisao-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado!');
  };

  const handleImportar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.tabelaINSS) setTabelaINSS(data.tabelaINSS);
        if (data.tabelaIRRF) setTabelaIRRF(data.tabelaIRRF);
        if (data.configTributavel) setConfigTributavel(data.configTributavel);
        handleSalvar();
        toast.success('Tabelas importadas com sucesso!');
      } catch {
        toast.error('Erro ao importar arquivo. Verifique o formato.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateINSS = (index: number, field: keyof TabelaINSS, value: number) => {
    const nova = [...tabelaINSS];
    nova[index] = { ...nova[index], [field]: value };
    setTabelaINSS(nova);
  };

  const updateIRRF = (index: number, field: keyof TabelaIRRF, value: number) => {
    const nova = [...tabelaIRRF];
    nova[index] = { ...nova[index], [field]: value };
    setTabelaIRRF(nova);
  };

  if (isLoading) {
    return (
      <div className="bg-app min-h-screen">
        <Navbar />
        <main className="relative z-10 pt-24 pb-12 px-4">
          <div className="container mx-auto max-w-5xl text-center">
            <p className="text-muted-foreground">Carregando tabelas...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-app min-h-screen">
      <Navbar />
      
      <main className="relative z-10 pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <header className="text-center mb-8 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Tabelas INSS/IRRF
            </h1>
            <p className="text-muted-foreground">
              Configure as tabelas de contribuição conforme legislação vigente
            </p>
          </header>

          {/* Ações */}
          <div className="flex flex-wrap gap-2 justify-center mb-6 animate-fade-in">
            <ButtonAmber onClick={handleSalvar} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              <span>Salvar</span>
            </ButtonAmber>
            <ButtonAmber variant="outline" onClick={handleRestaurar} className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar Padrão</span>
            </ButtonAmber>
            <ButtonAmber variant="outline" onClick={handleExportar} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span>Exportar JSON</span>
            </ButtonAmber>
            <label className="cursor-pointer">
              <input type="file" accept=".json" onChange={handleImportar} className="hidden" />
              <span className="btn-amber-outline h-11 px-6 rounded-xl font-semibold transition-all inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Importar JSON</span>
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tabela INSS */}
            <CardGraphite className="animate-fade-in">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                INSS 2026 (Progressivo)
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Cálculo progressivo por faixas. Teto: R$ 8.475,55
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Faixa Inicial</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Faixa Final</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Alíquota %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabelaINSS.map((faixa, index) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-2">
                          <InputDark
                            value={formatarMoeda(faixa.faixaInicial)}
                            onChange={(e) => updateINSS(index, 'faixaInicial', parseMoeda(e.target.value))}
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="py-2">
                          <InputDark
                            value={formatarMoeda(faixa.faixaFinal)}
                            onChange={(e) => updateINSS(index, 'faixaFinal', parseMoeda(e.target.value))}
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="py-2">
                          <InputDark
                            type="number"
                            step="0.1"
                            value={faixa.aliquota}
                            onChange={(e) => updateINSS(index, 'aliquota', parseFloat(e.target.value) || 0)}
                            className="h-9 text-sm w-20"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardGraphite>

            {/* Tabela IRRF */}
            <CardGraphite className="animate-fade-in">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                IRRF 2026 (Mensal)
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Tabela de incidência mensal com parcela dedutível
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Faixa Inicial</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Faixa Final</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Alíquota %</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Dedução</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabelaIRRF.map((faixa, index) => (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-2">
                          <InputDark
                            value={formatarMoeda(faixa.faixaInicial)}
                            onChange={(e) => updateIRRF(index, 'faixaInicial', parseMoeda(e.target.value))}
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="py-2">
                          <InputDark
                            value={faixa.faixaFinal === Infinity ? '∞' : formatarMoeda(faixa.faixaFinal)}
                            onChange={(e) => {
                              const val = e.target.value === '∞' ? Infinity : parseMoeda(e.target.value);
                              updateIRRF(index, 'faixaFinal', val);
                            }}
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="py-2">
                          <InputDark
                            type="number"
                            step="0.1"
                            value={faixa.aliquota}
                            onChange={(e) => updateIRRF(index, 'aliquota', parseFloat(e.target.value) || 0)}
                            className="h-9 text-sm w-20"
                          />
                        </td>
                        <td className="py-2">
                          <InputDark
                            value={formatarMoeda(faixa.parcelaDedutivel)}
                            onChange={(e) => updateIRRF(index, 'parcelaDedutivel', parseMoeda(e.target.value))}
                            className="h-9 text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardGraphite>
          </div>

          {/* Bases Tributáveis */}
          <CardGraphite className="mt-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Bases Tributáveis
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure quais verbas incidem na base de cálculo do INSS e IRRF
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center justify-between p-4 bg-background-subtle rounded-xl">
                <Label className="text-foreground">Saldo de Salário</Label>
                <Switch
                  checked={configTributavel.saldo}
                  onCheckedChange={(checked) => setConfigTributavel({ ...configTributavel, saldo: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-background-subtle rounded-xl">
                <Label className="text-foreground">13º Salário</Label>
                <Switch
                  checked={configTributavel.decimoTerceiro}
                  onCheckedChange={(checked) => setConfigTributavel({ ...configTributavel, decimoTerceiro: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-background-subtle rounded-xl">
                <Label className="text-foreground">Aviso Indenizado</Label>
                <Switch
                  checked={configTributavel.avisoIndenizado}
                  onCheckedChange={(checked) => setConfigTributavel({ ...configTributavel, avisoIndenizado: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-background-subtle rounded-xl">
                <Label className="text-foreground">Férias Indenizadas</Label>
                <Switch
                  checked={configTributavel.feriasIndenizadas}
                  onCheckedChange={(checked) => setConfigTributavel({ ...configTributavel, feriasIndenizadas: checked })}
                />
              </div>
            </div>
          </CardGraphite>

          {/* Info Redutor */}
          <CardGraphite className="mt-6 animate-fade-in">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary" />
              Redutor Mensal IRRF 2026
            </h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <p className="text-muted-foreground">
                O Redutor Mensal 2026 é opcional e pode ser ativado na calculadora. Funciona assim:
              </p>
              <ul className="text-muted-foreground mt-3 space-y-2">
                <li>
                  <span className="text-foreground font-medium">Até R$ 5.000,00:</span> Redução de até R$ 312,89 para zerar o IR
                </li>
                <li>
                  <span className="text-foreground font-medium">R$ 5.000,01 a R$ 7.350,00:</span> Redução = R$ 978,62 − (0,133145 × rendimentos tributáveis)
                </li>
                <li>
                  <span className="text-foreground font-medium">Acima de R$ 7.350,00:</span> Sem redução
                </li>
              </ul>
            </div>
          </CardGraphite>
        </div>
      </main>
    </div>
  );
}
