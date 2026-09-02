# Segurança — decisões registradas

Este arquivo existe pra guardar decisões de segurança que não são óbvias só
lendo o código (riscos aceitos conscientemente, por quê, e o que reavaliar
se a situação mudar). Não é um changelog de correções — essas ficam nos
commits/PRs de `security:`.

## Dependências com vulnerabilidade conhecida, mantidas de propósito

`npm audit` (frontend) aponta 2 vulnerabilidades que **não foram corrigidas**
porque a correção automática (`npm audit fix --force`) rebaixaria/trocaria
pacotes usados de verdade em produção, e — verificado lendo o código
instalado, não só confiando no advisory — o caminho vulnerável nunca é
alcançado do jeito que usamos essas libs:

### `node-fetch` (via `@tensorflow/tfjs-core` → `face-api.js`, usado em
`frontend/src/systems/ponto-admin/hooks/useFaceDetection.ts` — reconhecimento
facial do ponto)

`npm audit fix --force` rebaixaria `face-api.js` de 0.22.2 pra 0.20.0 (perda
de 2 versões) só pra resolver isso. Inspecionando o bundle instalado
(`node_modules/@tensorflow/tfjs-core/dist/tf-core.esm.js`): o `require("node-fetch")`
só existe dentro da classe de *platform* usada quando tfjs roda em **Node.js**
— a classe de *platform* de **browser** (a que de fato é instanciada aqui,
já que face-api.js só roda no navegador via Vite/React) usa `fetch` nativo do
browser e nunca toca nisso. Nem `require()` existe no bundle final do browser.
Risco real: nenhum, nesse uso. Reavaliar se algum dia o CRM passar a rodar
tfjs no servidor (SSR, worker Node etc.).

### `uuid` (via `exceljs`, usado em
`frontend/src/systems/analytics-dp/pages/EmployeesPage.tsx` — exportação de
planilha)

`npm audit fix --force` trocaria `exceljs` por uma major mais nova (breaking).
A vulnerabilidade (`GHSA-w5hq-g745-h8pq`) é especificamente sobre checagem de
limite quando um `buf` é passado pra `uuidv4(buf)`. Conferido em
`node_modules/exceljs/lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js`: o
único lugar em que exceljs chama `uuidv4()` é sempre **sem argumento nenhum**
— o parâmetro vulnerável nunca é usado. Risco real: nenhum, nesse uso.

## `xlsx` (SheetJS) — corrigido via CDN oficial, não npm

`xlsx` (usado em `frontend/src/systems/ponto-admin/pages/Employees.tsx` pra
**ler** planilha enviada por um admin ao importar funcionários — esse sim é
um caminho que processa arquivo de fora) tinha 2 CVEs (prototype pollution +
ReDoS) sem correção publicada no pacote `xlsx` do npm — o mantenedor
descontinuou o registro npm em favor de um CDN próprio.
`package.json` aponta pra `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
(versão pinada, não `-latest`, pra build ficar reprodutível) — é a
distribuição oficial recomendada pelo próprio SheetJS pra quem não pode pagar
a versão comercial. Ver https://cdn.sheetjs.com/ pra versões mais novas no
futuro.
