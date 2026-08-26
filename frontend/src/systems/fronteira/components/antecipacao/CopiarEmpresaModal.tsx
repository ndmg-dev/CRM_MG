import { useEffect, useState } from "react";
import { Button, Checkbox, Modal } from "@fronteira-ui";
import {
  useCopiarAntecipacaoMemoriaEmpresa,
  useEmpresas,
  usePreviewCopiarAntecipacaoMemoriaEmpresa,
  type AntecipacaoMemoriaCopiarEmpresaPreview,
} from "../../hooks/queries";
import { EmpresaPicker } from "../EmpresaPicker";
import { apiError } from "../../lib/api";

type Passo = "escolher" | "previa";

/** Replica a memória INTEIRA de uma empresa para outra de uma vez — pro caso
 * comum "empresa nova parecida com uma que já existe" (a maioria dos itens se
 * repete). Antes de aplicar, mostra o que é novo e o que já existe na empresa
 * destino com um valor diferente (conflito), pra decidir o que sobrescrever. */
export function CopiarEmpresaModal({
  open,
  onOpenChange,
  onCopiado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopiado: () => void;
}) {
  const [passo, setPasso] = useState<Passo>("escolher");
  const [companyIdOrigem, setCompanyIdOrigem] = useState<number | null>(null);
  const [companyIdDestino, setCompanyIdDestino] = useState<number | null>(null);
  const [previa, setPrevia] = useState<AntecipacaoMemoriaCopiarEmpresaPreview | null>(null);
  const [sobrescrever, setSobrescrever] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");

  const { data: empresas } = useEmpresas("", { ativo: true, limit: 500 });
  const buscarPrevia = usePreviewCopiarAntecipacaoMemoriaEmpresa();
  const confirmar = useCopiarAntecipacaoMemoriaEmpresa();

  useEffect(() => {
    if (open) {
      setPasso("escolher");
      setCompanyIdOrigem(null);
      setCompanyIdDestino(null);
      setPrevia(null);
      setSobrescrever(new Set());
      setError("");
    }
  }, [open]);

  function nomeEmpresa(id: number | null): string {
    return empresas?.find((e) => e.id === id)?.nome ?? "";
  }

  async function verPrevia() {
    if (!companyIdOrigem || !companyIdDestino) return;
    setError("");
    try {
      const resultado = await buscarPrevia.mutateAsync({ companyIdOrigem, companyIdDestino });
      setPrevia(resultado);
      // Por padrão marca todos os conflitos pra sobrescrever — é o caso comum
      // (empresa nova aceita tudo); desmarcar item a item é a exceção.
      setSobrescrever(new Set(resultado.conflitos.map((c) => c.item_id_origem)));
      setPasso("previa");
    } catch (err) {
      setError(apiError(err, "Não foi possível calcular a prévia."));
    }
  }

  function toggleConflito(itemId: number) {
    setSobrescrever((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  }

  function marcarTodos(marcar: boolean) {
    setSobrescrever(marcar ? new Set((previa?.conflitos ?? []).map((c) => c.item_id_origem)) : new Set());
  }

  async function aplicar() {
    if (!companyIdOrigem || !companyIdDestino) return;
    setError("");
    try {
      await confirmar.mutateAsync({
        companyIdOrigem,
        companyIdDestino,
        sobrescreverItemIds: [...sobrescrever],
      });
      onOpenChange(false);
      onCopiado();
    } catch (err) {
      setError(apiError(err, "Não foi possível copiar."));
    }
  }

  if (passo === "escolher") {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Copiar memória de outra empresa"
        description="Replica a memória inteira de uma empresa para outra — útil quando a empresa nova é parecida com uma que já existe. Você revisa o que muda antes de confirmar."
        actions={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={!companyIdOrigem || !companyIdDestino || companyIdOrigem === companyIdDestino || buscarPrevia.isPending}
              onClick={verPrevia}
            >
              {buscarPrevia.isPending ? "Calculando…" : "Ver prévia"}
            </Button>
          </>
        }
      >
        <div className="stack gap-16">
          {error && <div className="alert alert-danger">{error}</div>}
          <EmpresaPicker label="Copiar de" value={companyIdOrigem} onChange={setCompanyIdOrigem} allowCreate={false} />
          <EmpresaPicker label="Para" value={companyIdDestino} onChange={setCompanyIdDestino} allowCreate={false} />
          {companyIdOrigem && companyIdDestino && companyIdOrigem === companyIdDestino && (
            <div className="alert alert-warn">Escolha duas empresas diferentes.</div>
          )}
        </div>
      </Modal>
    );
  }

  const conflitos = previa?.conflitos ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`Copiar de ${nomeEmpresa(companyIdOrigem)} para ${nomeEmpresa(companyIdDestino)}`}
      description="Revise antes de confirmar — os itens já iguais na empresa destino não são tocados."
      actions={
        <>
          <Button variant="ghost" onClick={() => setPasso("escolher")}>
            Voltar
          </Button>
          <Button variant="primary" disabled={confirmar.isPending} onClick={aplicar}>
            {confirmar.isPending ? "Aplicando…" : "Aplicar cópia"}
          </Button>
        </>
      }
    >
      <div className="stack gap-16">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="row gap-16" style={{ fontSize: 13.5 }}>
          <span>
            <strong className="num" style={{ color: "var(--ok)" }}>{previa?.total_novos ?? 0}</strong> novos
          </span>
          <span className="muted">
            <strong className="num">{previa?.total_sem_mudanca ?? 0}</strong> já iguais
          </span>
          {conflitos.length > 0 && (
            <span>
              <strong className="num" style={{ color: "var(--warn)" }}>{conflitos.length}</strong> em conflito
            </span>
          )}
        </div>

        {conflitos.length === 0 ? (
          <div className="empty" style={{ padding: "16px 0" }}>
            Nenhum conflito — {previa?.total_novos ?? 0} itens serão criados em {nomeEmpresa(companyIdDestino)}.
          </div>
        ) : (
          <div className="stack gap-8">
            <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span className="field-hint">
                Itens que já existem em {nomeEmpresa(companyIdDestino)} com valor diferente — marque os que devem ser sobrescritos:
              </span>
              <div className="row gap-8">
                <Button variant="ghost" size="sm" onClick={() => marcarTodos(true)}>Marcar todos</Button>
                <Button variant="ghost" size="sm" onClick={() => marcarTodos(false)}>Desmarcar todos</Button>
              </div>
            </div>
            <div className="table-scroll" style={{ maxHeight: 260, overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>NCM</th>
                    <th>Descrição</th>
                    <th>Hoje ({nomeEmpresa(companyIdDestino)})</th>
                    <th>Vira ({nomeEmpresa(companyIdOrigem)})</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitos.map((c) => (
                    <tr key={c.item_id_origem}>
                      <td>
                        <Checkbox
                          checked={sobrescrever.has(c.item_id_origem)}
                          onCheckedChange={() => toggleConflito(c.item_id_origem)}
                        />
                      </td>
                      <td className="num">{c.ncm}</td>
                      <td>{c.descricao || "—"}</td>
                      <td className="muted">{c.tributacao_destino}</td>
                      <td>{c.tributacao_origem}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
