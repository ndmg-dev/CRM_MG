# Handoff: Flyout de "Sistemas" na navegação lateral

## Overview
Refatoração da aba "Sistemas" do menu lateral (rail). Hoje a lista de sistemas por setor expande dentro da própria rail, empurrando o layout verticalmente e sem busca. A nova versão abre um painel flutuante (flyout) ancorado ao ícone "Sistemas", com busca e setores em acordeão, sem alterar a largura da rail nem empurrar o conteúdo principal.

## About the Design Files
Os arquivos deste pacote são **referências de design em HTML** — protótipos mostrando aparência e comportamento pretendidos, não código de produção para copiar diretamente. A tarefa é **recriar este design HTML no ambiente já existente do código-fonte alvo** (React, Vue, etc.), reaproveitando componentes e padrões já estabelecidos.

## Fidelity
**Baixa/média fidelidade (lofi/mid-fi)**: o protótipo comunica estrutura, hierarquia e comportamento (rail colapsada, ícones, flyout, busca, acordeão por setor). Cores, ícones e tipografia devem seguir o design system já existente na aplicação — os valores abaixo são apenas os usados no mockup como referência de proporção/contraste, não tokens finais obrigatórios.

## Screens / Views

### 1. Rail colapsada (estado padrão)
- **Purpose**: navegação persistente entre módulos do sistema.
- **Layout**: coluna vertical, largura fixa 64px, altura 100% da viewport. Ícones centralizados, `gap` ~10px entre eles, padding vertical ~14px.
- **Ordem dos ícones** (top→bottom): Dashboard, **Sistemas**, Clientes, Tarefas, Administração, Auditoria, (spacer flexível), Configurações, Avatar do usuário (círculo, fim da lista).
- **Item ativo**: fundo `#e8a33d1a` + borda 1px `#e8a33d55` (âmbar), ícone com stroke âmbar (`#e8a33d`). Aplicado ao item da rota atual.
- **Item hover/idle**: sem fundo, ícone stroke `#9a9aa2`/`#7a7a82`.
- Cada botão de ícone: 34×34px, `border-radius` 8px, área de clique = todo o botão (alvo mínimo 44px recomendado em produção, ajustar padding).

### 2. Flyout "Sistemas" (estado aberto)
- **Purpose**: acesso rápido a todos os sistemas internos, organizados por setor, com busca.
- **Trigger**: clique no ícone "Sistemas" na rail. **Não é hover** — hover só destaca visualmente o ícone (evita abertura/fechamento acidental ao passar o mouse).
- **Anchor/position**: painel flutuante (`position: fixed`/`absolute`), ancorado à direita do ícone "Sistemas", mesma altura de topo do ícone. Não ocupa espaço no layout (não empurra conteúdo).
- **Dimensões do painel**: ~230px largura, altura flexível até um máximo (ex.: 520px ou 80vh) com scroll interno se o conteúdo exceder.
- **Fechamento**: clique fora do painel, tecla Esc, ou clique em um item de sistema (navega e fecha).
- **Estrutura interna** (topo → base):
  1. Campo de busca fixo no topo (não rola com a lista): placeholder "Buscar sistema…", ícone de lupa à esquerda.
  2. Lista de setores em acordeão — **apenas um setor aberto por vez**. Ordem observada: Contábil, Departamento Pessoal, Fiscal (mais setores conforme dados reais).
  3. Cabeçalho de cada setor: nome em uppercase, weight 700, letter-spacing ~0.04em, cor distinta por setor (ex.: Contábil `#5fbf7a` verde, Dep. Pessoal `#5b9bd5` azul, Fiscal `#d97a5b` laranja/terracota) + chevron indicando aberto (▾) / fechado (▸).
  4. Itens do setor aberto: lista de sistemas, texto ~12-13px, cor `#c9c9cf`, item ativo/hover com fundo sutil e `border-radius` ~6px.
  5. Busca filtra itens de todos os setores simultaneamente (abre automaticamente os setores com resultado).

## Interactions & Behavior
- Clique no ícone "Sistemas" → abre flyout com transição rápida (fade + slide de ~4px, ~150ms).
- Clique em outro ícone da rail enquanto o flyout está aberto → fecha o flyout e navega.
- Clique no cabeçalho de um setor → expande esse setor e colapsa o anteriormente aberto (acordeão, não multi-expand).
- Digitar na busca → filtra itens em tempo real (debounce leve, ex. 150-200ms), setores sem match ficam ocultos ou esmaecidos.
- Esc ou clique fora → fecha o flyout.
- Foco no campo de busca automaticamente ao abrir o flyout (acessibilidade/teclado).

## State Management
- `activeNavItem`: id do item de rota atual (controla destaque âmbar na rail).
- `flyoutOpen`: boolean — controla montagem/visibilidade do painel de Sistemas.
- `expandedSector`: id do setor atualmente aberto no acordeão (um único valor, não array).
- `searchQuery`: string — filtra a lista de sistemas exibida.
- Dados de sistemas por setor devem vir de uma fonte já existente na aplicação (API/config) — o mockup usa dados de exemplo.

## Design Tokens (referência do mockup — validar contra o design system real)
- Fundo rail/flyout: `#131316` / `#18181c`
- Borda: `#232327`
- Texto primário: `#e6e6ea`, secundário: `#9a9aa5` / `#c9c9cf`
- Destaque/ativo: `#e8a33d` (âmbar)
- Cores de setor: Contábil `#5fbf7a`, Dep. Pessoal `#5b9bd5`, Fiscal `#d97a5b`
- Border-radius: botões de ícone 8px, painel 10px, itens de lista ~6-7px
- Sombra do flyout: `8px 0 24px -8px rgba(0,0,0,0.6)` aprox.
- Tipografia: sans-serif do sistema; labels de setor ~11px/700, itens ~12-13px/400

## Assets
Ícones desenhados em SVG inline no protótipo (grade 2x2, grade 3x3, pessoas/clientes, checklist/tarefas, escudo/administração, olho/auditoria) — recriar com o icon set já usado na aplicação (ex. mesma lib de ícones do restante do produto), mantendo a leitura visual equivalente.

## Files
- `Refactor Sidebar.dc.html` — protótipo com os dois estados (rail colapsada e flyout aberto) da opção 1a, escolhida como direção final.
