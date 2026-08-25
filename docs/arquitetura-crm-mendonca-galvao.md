# Documento de Visão de Arquitetura (Architecture Preview)
## Projeto: CRM Contábil — Escritório Mendonça Galvão

Este documento apresenta a especificação técnica e a arquitetura de software proposta para o novo **CRM Contábil da Mendonça Galvão**. O objetivo é transformar o atual portal de sistemas em uma plataforma centralizada de gestão de clientes, tarefas, produtividade e auditoria, mantendo a identidade visual premium (Dark Mode & Gold Accent) e integrando de forma nativa o ecossistema de ferramentas já desenvolvidas.

---

## 1. Visão Geral e Escopo do Projeto

O sistema evoluirá de um hub básico de acessos para um ecossistema integrado que gerencia o ciclo de vida completo do cliente contábil, dividindo a operação pelos quatro setores principais do escritório:
* **Departamento Pessoal (DP):** Gestão de folha de pagamento, controle de férias, rescisões (calculadora integrada) e prazos do eSocial.
* **Fiscal:** Controle de faturamento, apuração de impostos, emissão de guias e entrega de obrigações acessórias.
* **Contábil:** Balancetes, conciliação bancária automatizada e dashboards de Business Intelligence (BIMG).
* **Societário:** Acompanhamento e visibilidade de processos de abertura, alteração contratual e baixa de empresas.

### Objetivos Principais
1.  **Centralização Completa:** Um único ponto de entrada unificado para todas as 14 ferramentas existentes.
2.  **Segurança Corporativa:** Autenticação restrita e automatizada via Google Workspace SSO.
3.  **Produtividade Visível:** Quadro Kanban dinâmico e dashboards para acompanhamento de tarefas por funcionário/setor e monitoramento de SLAs.
4.  **Auditoria Avançada:** Registro detalhado e imutável de todas as ações administrativas e concessões de acesso (evolução do atual MG Admin).

---

## 2. Arquitetura de Alto Nível (Visão Macro)

O sistema seguirá um padrão de **Arquitetura Baseada em Serviços de Camada Única (Monólito Modular)** na fase inicial, com separação estrita entre a interface do usuário (Frontend) e a inteligência de negócios (Backend). Isso garante facilidade de implantação, excelente manutenibilidade e alta performance.

```
+-----------------------------------------------------------------------+
|                         CAMADA DE CLIENTE                             |
|    React 18 + Vite + TypeScript + Tailwind + shadcn/ui + Motion       |
+-----------------------------------------------------------------------+
                                   |
                                   | HTTPS / REST (JSON) + JWT
                                   v
+-----------------------------------------------------------------------+
|                         CAMADA DE APLICAÇÃO                           |
|       Java 21 + Spring Boot 3 + Spring Security + OAuth2 Client       |
+-----------------------------------------------------------------------+
            |                              |
            | JPA / Hibernate              | REST APIs / SSO (PostMessage)
            v                              v
+-----------------------+      +----------------------------------------+
|   CAMADA DE DADOS     |      |          ECOSSISTEMA LEGADO            |
|  PostgreSQL Database  |      | ContAI, BIMG, Copilot Contábil, etc.   |
+-----------------------+      +----------------------------------------+
```

---

## 3. Segurança e Autenticação (Restrição de Domínio)

A autenticação será totalmente delegada ao **Google Identity Platform**, configurada no modo de acesso restrito no Google Cloud Console.

### Fluxo de Autenticação e Autorização
1.  **Requisição de Login:** O usuário clica em "Entrar com o Google". O front-end injeta o parâmetro `hd=mendoncagalvao.com.br` na requisição.
2.  **Filtro do Google:** O Google exibe apenas as contas logadas no navegador que pertencem ao Workspace do escritório. Contas externas (ex: `@gmail.com`) são barradas imediatamente pelo próprio Google.
3.  **Validação de Segurança no Backend:** O token JWT retornado pelo Google é enviado ao Spring Boot, que valida a assinatura criptográfica e executa o filtro de segurança definitivo:
    ```java
    if (!email.endsWith("@mendoncagalvao.com.br")) {
        throw new AccessDeniedException("Domínio corporativo não autorizado.");
    }
    ```
4.  **Mapeamento de Perfis (RBAC):** O e-mail é verificado no banco de dados. Caso seja o primeiro acesso do colaborador, ele é registrado com o perfil padrão de visualizador com restrições máximas até que um Administrador altere seu nível de permissão no painel de controle.

---

## 4. Stack Tecnológico Detalhado

| Camada | Tecnologia | Motivação e Benefício Premium |
| :--- | :--- | :--- |
| **Frontend - Core** | React 18 + Vite + TypeScript | Inicialização instantânea do ambiente de desenvolvimento, tipagem estática que previne falhas de dados e agrupamento otimizado de arquivos (*code-splitting*). |
| **Frontend - UI** | Tailwind CSS + shadcn/ui | Construção de interfaces elegantes com suporte nativo a *Dark Mode*. A paleta usará o fundo grafite escuro com detalhes em amarelo/ouro idêntico ao protótipo atual. |
| **Frontend - Animações**| Framer Motion | Criação de efeitos visuais impressionantes nas transições de colunas do Kanban, abertura fluida de modais de tarefas e carregamento suave de gráficos. |
| **Frontend - Estado** | TanStack Query (React Query)| Gerenciamento inteligente de cache local. Reduz chamadas desnecessárias ao banco e permite atualização fluida em background. |
| **Backend - Core** | Java 21 + Spring Boot 3 | Desempenho otimizado via *Virtual Threads* (Projeto Loom), estabilidade empresarial, segurança robusta de fábrica e facilidade de integração. |
| **Backend - Security** | Spring Security | Controle de acessos granular por anotações (ex: `@PreAuthorize("hasRole('ADMIN')")`) e interceptadores automáticos de requisições para auditoria. |
| **Banco de Dados** | PostgreSQL 16 | Banco relacional maduro com suporte nativo ao tipo `JSONB`, ideal para guardar payloads flexíveis de histórico de auditoria e configurações de tarefas. |

---

## 5. Modelagem de Dados Inicial (Entidades Principais)

### Tabela: `usuarios`
Responsável por armazenar os dados de colaboradores autorizados.
* `id`: UUID (Primary Key)
* `nome`: VARCHAR(150)
* `email`: VARCHAR(100) (Unique, Indexado) — ex: `arthur.monteiro@mendoncagalvao.com.br`
* `perfil`: ENUM (ADMIN, COORDENADOR, ANALISTA, ASSISTENTE)
* `setor`: ENUM (FISCAL, CONTABIL, DP, SOCIETARIO, DIRETORIA)
* `ativo`: BOOLEAN (Garante bloqueio imediato caso o colaborador seja desligado)
* `data_criacao`: TIMESTAMP

### Tabela: `clientes`
Armazena o cadastro unificado de empresas atendidas pelo escritório.
* `id`: UUID (Primary Key)
* `razao_social`: VARCHAR(255)
* `nome_fantasia`: VARCHAR(150)
* `cnpj`: VARCHAR(14) (Unique, Indexado)
* `regime_tributario`: ENUM (SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL)
* `status_cnpj`: VARCHAR(30) (Ativa, Inapta, Suspensa)
* `contato_principal`: VARCHAR(100)

### Tabela: `tarefas`
Gerencia as obrigações e demandas internas exibidas no Kanban.
* `id`: UUID (Primary Key)
* `titulo`: VARCHAR(200)
* `descricao`: TEXT
* `cliente_id`: FK -> `clientes(id)`
* `responsavel_id`: FK -> `usuarios(id)`
* `setor_origem`: ENUM (FISCAL, CONTABIL, DP, SOCIETARIO)
* `status`: ENUM (PENDENTE, EM_PROCESSAMENTO, AGUARDANDO_CLIENTE, CONCLUIDO)
* `prioridade`: ENUM (BAIXA, MEDIA, ALTA, CRITICA)
* `data_vencimento`: TIMESTAMP (Prazo fatal acordado com o cliente ou legal)
* `data_conclusao`: TIMESTAMP

### Tabela: `logs_auditoria`
Evolução do painel de auditoria atual (`MG Admin`), rastreando mutações críticas no sistema.
* `id`: BIGSERIAL (Primary Key)
* `data_hora`: TIMESTAMP (Default: NOW())
* `usuario_id`: FK -> `usuarios(id)` (Autor da ação)
* `acao`: VARCHAR(50) (ex: `GRANT_ACCESS`, `DELETE_CLIENTE`, `UPDATE_PERMISSAO`)
* `alvo`: VARCHAR(100) (Recurso modificado, ex: `User:7d50b9ee...`)
* `detalhes`: JSONB (Armazena o estado anterior e o novo estado da informação para conferência histórica)

---

## 6. Estratégia de Integração com o Ecossistema Atual

Para que as 14 ferramentas já existentes funcionem harmoniosamente dentro do novo CRM, a integração ocorrerá em três etapas táticas:

1.  **Single Sign-On (SSO) Unificado:** O token JWT gerado pelo novo back-end após o login via Google será propagado para os subsistemas. Os sistemas antigos lerão esse token para autenticar o usuário, extinguindo telas de login duplicadas.
2.  **Visualização via Secure Iframes / Microfrontends:** No painel do CRM, ao acessar o "Copilot Contábil" ou o "ContAI", a aplicação carregará o sistema correspondente dentro de um componente `<iframe>` protegido por atributos de `sandbox`. A comunicação de metadados e redimensionamento será feita de forma segura via API `window.postMessage`.
3.  **Consumo de APIs Centralizadas:** Os sistemas satélites deixarão de consultar bancos isolados para checar se uma empresa cliente está ativa. Eles passarão a consumir os endpoints REST do novo CRM (ex: `/api/v1/clientes/{cnpj}`), garantindo integridade absoluta dos dados.

---

## 7. Desempenho e Fluidez Visual (User Experience Premium)

Para garantir que a aplicação impressione visualmente e mantenha performance excelente, os seguintes padrões de engenharia de software serão implementados:

* **Atualizações Otimistas (Optimistic Updates):** Ao arrastar um card no Kanban de tarefas de *Pendente* para *Em Processamento*, a interface do React atualiza instantaneamente a posição do card usando o cache local do React Query, enquanto a requisição HTTP acontece em background. Se a rede falhar, o card retorna suavemente à posição original com um alerta discreto (*Toast Notification*).
* **Carregamento Sob Demanda (Lazy Loading & Code Splitting):** O código de ferramentas pesadas de gráficos ou relatórios do BIMG só será baixado pelo navegador do usuário no momento exato em que ele abrir a respectiva aba, reduzindo o tempo de carregamento inicial do CRM para menos de 1.5 segundos.
* **Aceleração por Hardware:** Todas as animações de interface controladas pelo *Framer Motion* utilizarão propriedades CSS otimizadas (`transform` e `opacity`), garantindo taxas estáveis de 60 FPS mesmo em computadores ou notebooks corporativos mais antigos.
