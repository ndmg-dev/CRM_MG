import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNativeSystemPath } from "@/hooks/useNativeSystemBase";
import { Badge, Button, Checkbox, Select } from "@fronteira-ui";
import { EmpresaPicker } from "../components/EmpresaPicker";
import {
  exportarFronteiraGrupoXlsx,
  useHistoricoCompetencias,
  type Empresa,
  type HistoricoCompetencia,
} from "../hooks/queries";
import { apiError } from "../lib/api";
import { formatCNPJ, formatMoney } from "../lib/format";

const ANO_TODOS = "__todos__";

function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

/** Histórico do Fronteira — passo 1: escolher a empresa, ver o que já foi
 * apurado por competência (uma linha por mês), com totais. Clicar abre o
 * detalhe (tela tipo Resultado); dá pra selecionar várias e baixar um XLSX
 * de cada sem abrir. */
export default function Historico() {
  const navigate = useNavigate();
  const toAbs = useNativeSystemPath();
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | undefined>();
  const [ano, setAno] = useState<string>(ANO_TODOS);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");

  const { data, isLoading } = useHistoricoCompetencias(companyId, null);

  const anosDisponiveis = useMemo(() => {
    const anos = new Set<string>();
    for (const c of data?.competencias ?? []) anos.add(c.competencia.slice(0, 4));
    return [...anos].sort((a, b) => b.localeCompare(a));
  }, [data]);

  const linhas: HistoricoCompetencia[] = useMemo(() => {
    const todas = data?.competencias ?? [];
    if (ano === ANO_TODOS) return todas;
    return todas.filter((c) => c.competencia.startsWith(ano));
  }, [data, ano]);

  function toggle(competencia: string) {
    setSelecionadas((s) => {
      const n = new Set(s);
      n.has(competencia) ? n.delete(competencia) : n.add(competencia);
      return n;
    });
  }

  const todasSelecionadas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.competencia));
  function toggleTodas(check: boolean) {
    setSelecionadas(check ? new Set(linhas.map((l) => l.competencia)) : new Set());
  }

  async function exportarSelecionadas() {
    if (companyId == null || selecionadas.size === 0) return;
    setErro("");
    setExportando(true);
    try {
      // uma competência de cada vez → um XLSX por competência (delay curto pra
      // o navegador não bloquear downloads múltiplos em sequência).
      for (const competencia of [...selecionadas].sort()) {
        await exportarFronteiraGrupoXlsx(companyId, competencia);
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (err) {
      setErro(apiError(err, "Não foi possível exportar uma das competências."));
    } finally {
      setExportando(false);
    }
  }

  function abrir(competencia: string) {
    navigate(toAbs(`fronteira/historico/${companyId}/${competencia}`));
  }

  return (
    <div className="stack gap-16">
      <div>
        <h1 className="page-title">Histórico</h1>
        <p className="page-sub">Consulte o que já foi calculado por empresa e competência.</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 style={{ fontSize: 14 }}>1. Empresa</h2>
          {companyId && <Badge variant="ok">Empresa selecionada</Badge>}
        </div>
        <div className="card-body stack gap-16">
          <EmpresaPicker
            label="Empresa"
            value={companyId}
            onChange={(id, e) => {
              setCompanyId(id);
              setEmpresa(e);
              setSelecionadas(new Set());
              setAno(ANO_TODOS);
            }}
          />
        </div>
      </div>

      {companyId && (
        <div className="card">
          <div className="card-head" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="stack" style={{ gap: 2 }}>
              <h2 style={{ fontSize: 14 }}>Apurações de {empresa?.nome}</h2>
              {empresa && <span className="muted num" style={{ fontSize: 12.5 }}>{formatCNPJ(empresa.cnpj)}</span>}
            </div>
            <div className="row gap-12" style={{ flexWrap: "wrap" }}>
              <div className="row gap-8">
                <span className="muted" style={{ fontSize: 12.5 }}>Ano</span>
                <Select
                  aria-label="Ano"
                  value={ano}
                  onValueChange={(v) => {
                    setAno(v);
                    setSelecionadas(new Set());
                  }}
                  options={[{ value: ANO_TODOS, label: "Todos" }, ...anosDisponiveis.map((a) => ({ value: a, label: a }))]}
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={selecionadas.size === 0 || exportando}
                onClick={exportarSelecionadas}
              >
                {exportando ? "Exportando…" : `↓ Exportar selecionadas (${selecionadas.size})`}
              </Button>
            </div>
          </div>

          {erro && <div className="card-body"><div className="alert alert-danger">{erro}</div></div>}

          {isLoading ? (
            <div className="empty">Carregando…</div>
          ) : linhas.length === 0 ? (
            <div className="empty">
              <strong>Nenhuma apuração encontrada</strong>
              {ano === ANO_TODOS ? "Essa empresa ainda não teve notas calculadas." : "Nenhuma competência nesse ano."}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 34 }}>
                      <Checkbox checked={todasSelecionadas} onCheckedChange={(v) => toggleTodas(!!v)} />
                    </th>
                    <th>Competência</th>
                    <th className="right">Notas</th>
                    <th className="right">Itens</th>
                    <th className="right">Total DIFAL</th>
                    <th className="right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr key={l.competencia} style={{ cursor: "pointer" }} onClick={() => abrir(l.competencia)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selecionadas.has(l.competencia)} onCheckedChange={() => toggle(l.competencia)} />
                      </td>
                      <td className="num"><strong>{competenciaLabel(l.competencia)}</strong></td>
                      <td className="right num">{l.total_notas}</td>
                      <td className="right num">{l.total_itens}</td>
                      <td className="right imposto-cell">{formatMoney(l.total_difal)}</td>
                      <td className="right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => abrir(l.competencia)}>
                          Abrir →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
