# Setor: Societário

> Não fazia parte da lista mínima de setores pedida (`contabil`, `fiscal`,
> `pessoal-dp`, `ti-nucleo-digital`, `transversal`), mas 3 aplicações do
> banco de sistemas (`sistemas_seed.sql`) estão cadastradas com
> `setor = SOCIETARIO`, sem se encaixar bem em nenhum dos 5 setores
> obrigatórios — por isso este arquivo extra.

| Aplicação | Função | Status | Ficha |
|---|---|---|---|
| Abertura de Empresa | Gerenciamento de abertura de novas empresas | producao | [ficha](../aplicacoes/abertura-empresa/README.md) |
| Consulta CNPJ | DESCONHECIDO — função não confirmada (ver PENDENCIAS.md) | producao | [ficha](../aplicacoes/consulta-cnpj/README.md) |
| Carnê-Leão (Contábil Script) | DESCONHECIDO — backend real em repositório externo | producao | [ficha](../aplicacoes/carne-leao/README.md) |

## Sobreposições e lacunas

- Nenhuma sobreposição óbvia entre as 3 — funções distintas (abertura de
  empresa, consulta de CNPJ, carnê-leão).
- `Consulta CNPJ` e `Carnê-Leão` têm função não confirmada oficialmente —
  ver `docs/PENDENCIAS.md`.
