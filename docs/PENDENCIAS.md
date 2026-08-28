# Pendências do inventário

> Lacunas encontradas durante o levantamento (`docs/inventario.yaml`) que só o
> time consegue confirmar, mais os achados de auditoria (segurança/multi-
> tenant/LGPD/PWA) coletados durante a varredura. Nenhum item aqui foi
> inventado — cada um cita o arquivo/campo onde a lacuna apareceu.

## Como usar este documento

- **Perguntas** (seção 1): um item por campo `DESCONHECIDO` relevante do
  `inventario.yaml`, agrupado por aplicação. Ao responder, atualize o YAML e
  a ficha correspondente, e risque o item aqui (ou mova pra um changelog).
- **Auditoria** (seção 2): achados de segurança/multi-tenant/LGPD/PWA vistos
  de passagem durante a varredura. Não é um pentest — é o que apareceu ao
  ler configs e código público dos routers/settings.

---

## 1. Perguntas para o time

### Aplicações inteiras sem código neste workspace
- `portal-do-colaborador` e `clausula-ai` aparecem em `sistemas_seed.sql`
  (URLs `portalcolabmg.lovable.app` e `clausulaailp.nucleodigital.cloud`) mas
  não têm pasta correspondente em `frontend/src/systems/` nem em nenhum
  outro lugar deste workspace. **Pergunta:** esses sistemas têm repositório
  próprio fora deste workspace? Se sim, qual, pra incluir no inventário.

### Stack / backend não identificado no código
Estas aplicações usam uma API própria (`VITE_*_API_URL`) cujo repositório de
backend não está neste workspace, então stack/banco/RLS ficaram
`DESCONHECIDO`:
- `ponto-admin` (VITE_CRONOS_API_URL — sistema "Cronos")
- `processar-ponto` (VITE_PONTO_API_URL)
- `contai` (VITE_CONTAI_API_URL)
- `conciliacao-fiscal` (VITE_FISCAL_API_BASE_URL)
- `consulta-cnpj` (VITE_CNPJ_API_URL)
- `documentacao-contabil` (VITE_DOCCONTABIL_API_URL)
- `guia-dp` (VITE_GUIADP_API_BASE_URL)
- `analytics-dp` (VITE_ANALYTICS_DP_API_URL)
- `carne-leao` (VITE_CARNE_LEAO_API_URL — repo externo "PROJETO-CARNE-LEAO" citado em comentário do registry.tsx)
- `bimg`, `taskflow` (têm Supabase próprio + uma `VITE_*_API_URL` complementar — o que essa API adicional faz?)

**Pergunta:** onde estão esses backends (repositório, hospedagem, quem
mantém)? Sem isso não dá pra preencher `BANCO.md`/RLS/LGPD dessas aplicações
de verdade — o inventário está registrando só o que o *frontend* revela.

### Sem nenhum indício de backend
- `calculadora-rescisao` e `calculo-comissao`: nenhuma env var de API nem
  cliente Supabase encontrado — aparentam ser calculadoras 100% client-side.
  **Pergunta:** confirma? Se sim, não há dado pessoal armazenado (só
  processado na sessão do navegador) — vale declarar isso oficialmente pra
  LGPD.
- `aeronord`, `dashboard-dre`: mesma situação, mas o nome/função sugere que
  DEVERIA ter algum armazenamento (recibos, métricas de DRE). Prováveis
  candidatos a backend externo (Lovable/Vercel) não inspecionado.
  **Pergunta:** essas aplicações persistem dado em algum lugar?

### Função do sistema não confirmada
`sistemas_seed.sql` não tinha descrição para estes (ou a linha não apareceu
no dump que consegui ler): `documentacao-contabil`, `consulta-cnpj`,
`analytics-dp`, `dash-rh`. A `funcao` no YAML pra esses é uma inferência só
pelo nome — **pergunta:** confirmar a descrição real de cada um com o
responsável do setor.

### Setor responsável (dono técnico)
O YAML preenche `setores` (quem *usa*) com confiança (vem do
`sistemas_seed.sql`), mas `setor_responsavel` (quem *mantém tecnicamente*)
ficou `DESCONHECIDO` pra quase tudo fora do núcleo TI — **pergunta:** o
Núcleo Digital mantém todos os 25 sistemas, ou alguns têm dev externo
(ex.: os hospedados em Lovable/Vercel)?

### `dash-rh`
Setor cadastrado como `RESTRITO` no banco de sistemas (não é um dos setores
"normais" como CONTABIL/FISCAL/DP) — **pergunta:** o que esse setor
significa em termos de controle de acesso? Precisa entrar como um setor
próprio em `docs/setores/` ou é um caso especial de RH?

### Portas locais / dev
A maioria das aplicações embutidas não tem porta própria — todas rodam sob o
mesmo `npm run dev` do `frontend/` (porta 5173 padrão do Vite, ou 3009 via
docker-compose). Marquei `DESCONHECIDO` porta_local nas fichas individuais
por precisão, mas na prática **é sempre a porta do frontend raiz**.
Confirmar se isso é intencional (todas compartilham 1 build) antes de eu
consolidar essa nota nas fichas.

### `VITE_ADIANTAMENTO_SUPABASE_URL`
Em `calculo-adiantamento` encontrei um cliente Supabase (`createClient`) mas
não consegui confirmar o nome exato da env var lendo só os arquivos que
grepei — **pergunta/ação:** localizar o arquivo `integrations/supabase/client.ts`
desse sistema e confirmar o nome exato antes de considerar o dado definitivo.

### `obrigacoes-recibo` (services/)
Só vi o diretório (`services/obrigacoes-recibo`) e seu `.env.example` — não
inspecionei o código-fonte dele em profundidade (fora do escopo desta
passada, focada nos apps de `frontend/src/systems/`). **Pergunta:** stack,
função exata e se ainda está em uso ativo.

---

## 2. Auditoria (achados ao longo da varredura)

Classificação: **crítico / alto / médio / baixo**. Isto **não é um pentest**
— são achados de leitura de configuração/routers públicos, não de teste de
intrusão nem análise de todo o código de cada aplicação.

### Segurança

- **[ALTO] Senha de banco com default hardcoded no código-fonte**
  `backend-fastapi/app/core/config.py:16` — `POSTGRES_PASSWORD: str =
  "crm_dev_password_2024"`. Se a env var `POSTGRES_PASSWORD` não for setada
  em algum ambiente (ex.: erro de deploy), o backend sobe silenciosamente
  usando essa senha conhecida em vez de falhar. Mesmo padrão em
  `EVOLUTION_API_KEY: str = "dev_evolution_key_123"` (linha 56). Recomendação:
  remover o default e deixar sem valor (obrigar a env var, falhar no boot se
  ausente) — igual já é feito com `JWT_SECRET: str` (sem default) na linha 20,
  que é o padrão correto já presente no mesmo arquivo.

- **[MÉDIO] `OUVIDORIA_SUPABASE_SERVICE_ROLE_KEY` centralizada no backend**
  `backend-fastapi/app/core/config.py:40` — a service role key do Supabase da
  Ouvidoria (bypassa RLS) fica configurada no backend do CRM, um serviço à
  parte do Supabase da Ouvidoria em si. Não é uma vulnerabilidade por si só
  (o comentário no código diz que é usada só server-side pra webhooks/
  embeddings), mas amplia a superfície: se o backend do CRM for comprometido,
  o atacante ganha acesso irrestrito ao banco da Ouvidoria — que trata dado
  de denúncia (ver LGPD abaixo). Vale revisar se essa key precisa mesmo estar
  aqui ou se dá pra escopar num serviço isolado.

- **[BAIXO] `BACKEND_CORS_ORIGINS` com default de dev**
  `backend-fastapi/app/core/config.py:10` — default é só
  `localhost:3000/5173/8080`, o que é seguro; só fica como nota porque não
  vi confirmação de qual é o valor real em produção (deve vir de env var,
  não inspecionado por ser `.env` real).

### Multi-tenant

- **[NÃO APLICÁVEL / a confirmar]** Nenhuma das aplicações documentadas
  aparenta ser multi-tenant no sentido clássico (um `tenant_id` isolando
  dados de clientes diferentes do mesmo software) — é um único escritório
  usando N sistemas internos. Marquei `nao_aplicavel` no YAML por padrão.
  Exceção a confirmar: `conciliacao-fiscal`, `documentacao-contabil` e outros
  sistemas voltados a "clientes" do escritório podem ter uma noção de
  isolamento por cliente que não ficou visível só pelo frontend — **pergunta
  para o time**: alguma dessas trata dado de múltiplos clientes/empresas na
  mesma base sem segregação por tenant?

### LGPD

- **[ALTO] Ouvidoria trata relato de denúncia sem confirmação de retenção/anonimização**
  `frontend/src/systems/ouvidoria` + proxies em
  `backend-fastapi/app/api/v1/endpoints/ouvidoria_proxy.py` — é o dado mais
  sensível do inventário (relato de denúncia interna, potencialmente sobre
  pessoas identificáveis). Não encontrei confirmação de política de retenção,
  anonimização do denunciante, nem quem tem acesso à
  `OUVIDORIA_SUPABASE_SERVICE_ROLE_KEY`. Recomendação: tratar como prioridade
  #1 de revisão LGPD.

- **[MÉDIO] Nenhuma aplicação documentada declara política de retenção definida**
  Em praticamente todas as fichas, `retencao_definida: DESCONHECIDO`. Isso
  por si só é um achado: não há (ou não está documentada) uma política de
  retenção/exclusão de dado pessoal em nenhum dos sistemas levantados.

- **[BAIXO] `analytics-dp`, `dash-rh`, `calculo-adiantamento`, `aeronord`,
  `processar-ponto`, `ponto-admin` tratam dado trabalhista/salarial** sem
  RLS/policy confirmável (backend fora deste workspace). Marcar como
  pendente de confirmação, não como incidente confirmado.

### PWA

- **[MÉDIO] Nenhuma das 25 aplicações embutidas tem manifest/service worker
  identificado neste workspace.** Não encontrei `manifest.json`,
  `manifest.webmanifest`, `vite-plugin-pwa` nem arquivo de service worker em
  nenhum `frontend/src/systems/*`, nem no `frontend/` raiz. Se alguma
  aplicação é usada em campo/mobile (ex.: ponto eletrônico), a ausência de
  PWA pode ser um problema de UX real, não só de checklist — **pergunta para
  o time**: alguma dessas aplicações precisa funcionar offline ou como app
  instalável?

---

## 3. Decisões de escopo desta rodada

- Documentei em profundidade (README + arquitetura) as aplicações do núcleo
  TI e as que eu já conhecia em detalhe por trabalho anterior nesta sessão
  (`central-suporte`). Para as demais 24 aplicações, a ficha cobre o que dá
  pra confirmar via `sistemas_seed.sql` + `registry.tsx` + grep de configs —
  sem `INSTALACAO.md`/`BANCO.md` individuais nesta primeira passada, porque
  o backend real da maioria não está neste workspace (ver seção 1). Ficam
  como próximo passo quando o time confirmar as pendências acima.
