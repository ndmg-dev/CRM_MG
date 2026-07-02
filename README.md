# CRM Mendonça Galvão

Um sistema de CRM de alta performance focado na gestão contábil, tributária e departamental, criado exclusivamente para a Mendonça Galvão. O sistema é segmentado por setores (Dep. Pessoal, Contábil, Fiscal, Societário, TI, etc.) e utiliza uma arquitetura moderna e segura para garantir a confiabilidade dos dados dos clientes.

## 🚀 Arquitetura e Tecnologias

O projeto é dividido em duas camadas principais, orquestradas via **Docker Compose**:

### Frontend
- **React.js / Vite**: Framework de alta performance para a interface.
- **TypeScript**: Tipagem estática para maior segurança no código.
- **Tailwind CSS**: Estilização baseada em utilitários para um design moderno e responsivo.
- **Zustand**: Gerenciamento de estado global (incluindo Autenticação e UI).
- **React Query**: Cache e sincronização inteligente de requisições de API.
- **Lucide React**: Biblioteca de ícones modernos.

### Backend
- **Python / FastAPI**: Framework assíncrono extremamente rápido para construção da API.
- **PostgreSQL**: Banco de dados relacional robusto.
- **SQLAlchemy (Async)**: ORM moderno para comunicação assíncrona com o banco.
- **Alembic**: Gerenciador de migrações de banco de dados (Migrations).
- **JWT (JSON Web Tokens)**: Sistema de autenticação e proteção de rotas.

---

## 🔒 Segurança

O sistema passou por uma auditoria completa de segurança, garantindo proteção contra as principais vulnerabilidades de aplicações web:
- **Proteção contra IDOR**: Todos os downloads e acessos a documentos validam a função (role) gerencial do usuário antes de liberar o arquivo.
- **Proteção contra Path Traversal**: Sanitização rigorosa nos uploads de arquivos para impedir que invasores manipulem as pastas do sistema operacional.
- **Role-Based Access Control (RBAC)**: Apenas usuários com nível `ADMIN` ou `COORDENADOR` podem criar/editar clientes ou atribuir tarefas.
- **Criptografia Rígida**: O Segredo do Token de Sessão (JWT_SECRET) foi removido do código-fonte e só aceita injeção via variáveis de ambiente seguras.

---

## 📦 Como Rodar Localmente (Desenvolvimento)

O projeto usa Docker Compose, o que significa que todas as dependências (Banco, Backend e Frontend) podem ser iniciadas com um único comando.

1. Clone este repositório.
2. Certifique-se de ter o [Docker Desktop](https://www.docker.com/) instalado e rodando.
3. No terminal (dentro da raiz do projeto), execute:
```bash
docker-compose up -d --build
```
4. A mágica acontecerá! O Docker vai subir três containers:
   - **PostgreSQL**: Rodando na porta `5432`.
   - **Backend**: Rodando na porta `8080`.
   - **Frontend**: Rodando na porta `3000`.
5. Abra o navegador e acesse: [http://localhost:3000](http://localhost:3000).

*(A senha padrão para desenvolvimento no painel de administração é `crm_dev_password_2024`, conforme o arquivo `docker-compose.yml`)*

---

## ☁️ Como Fazer o Deploy no Coolify (Produção)

Este projeto já está inteiramente preparado para ser implantado na infraestrutura **Coolify** (como na Hostinger ou DigitalOcean), orquestrando automaticamente o Backend, Frontend e Banco de Dados.

1. Acesse o Painel do seu servidor **Coolify**.
2. Clique em **Add New Resource** (Adicionar Novo Recurso).
3. Selecione **Git Repository** (Repositório Git).
4. Em Build Pack (ou método de build), selecione **Docker Compose**.
5. Selecione este repositório na lista.
6. O Coolify vai ler automaticamente o arquivo `docker-compose.yml` da raiz do projeto, criando a rede, baixando o banco de dados e compilando todo o código fonte (O frontend foi adaptado com um `Dockerfile` próprio com **Nginx** para alta performance).
7. Vá na aba **Domains** (Domínios) de cada serviço criado e defina a sua URL:
   - No serviço do **Frontend**: aponte para `crm.mendoncagalvao.com.br` (exemplo).
   - No serviço do **Backend**: aponte para `api.mendoncagalvao.com.br` (exemplo).
8. Adicione as variáveis de ambiente necessárias (como `JWT_SECRET`, `OPENAI_API_KEY`, etc.) na aba **Environment Variables** do backend no Coolify.
9. Clique em **Deploy** e aproveite!

---

## 🏗️ Estrutura de Diretórios

```
CRM_MG/
│
├── backend-fastapi/      # Código fonte da API e Banco de Dados (Python)
│   ├── app/              # Modelos, Rotas (Endpoints) e Lógicas de Negócio
│   ├── alembic/          # Histórico de Migrações do Banco
│   └── Dockerfile        # Imagem do Backend
│
├── frontend/             # Código fonte da interface (React/TypeScript)
│   ├── src/              # Componentes, Páginas, Hooks e Configuração
│   ├── public/           # Favicons e Assets públicos
│   └── Dockerfile        # Imagem do Frontend com servidor NGINX
│
└── docker-compose.yml    # Orquestrador Mestre para ambiente Local / Coolify
```
