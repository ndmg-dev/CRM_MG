# Setor: Fiscal

| Aplicação | Função | Status | Ficha |
|---|---|---|---|
| Conciliação Fiscal (FiscalMatch) | Conciliação de notas e SPED contábil | producao | [ficha](../aplicacoes/conciliacao-fiscal/README.md) |
| ICMS Fronteira | Cálculo de ICMS fronteira (v8 em homologação) | homologacao | [ficha](../aplicacoes/fronteira/README.md) |

## Sobreposições e lacunas

- **ICMS Fronteira** está formalmente em homologação (v8 rodando ao lado do
  v7 Django em produção, conforme comentário em `FronteiraApp.tsx`) — não
  tratar como sistema estável até essa migração fechar.
- Nenhum dos dois teve o backend real inspecionado (Fronteira depende de um
  serviço Django v7 externo + proxy do CRM; Conciliação Fiscal usa uma API
  própria não localizada neste workspace) — ver `docs/PENDENCIAS.md`.
