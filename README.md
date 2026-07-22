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
3. Crie o arquivo de variáveis de ambiente a partir do modelo e preencha os valores:
```bash
cp .env.example .env
```
4. No terminal (dentro da raiz do projeto), execute:
```bash
docker-compose up -d --build
```
5. O Docker vai subir quatro containers. As portas **publicadas no seu host** (configuráveis via `HOST_*_PORT` no `.env`) são:
   | Serviço | Porta interna | Porta no host (padrão) | Acesso |
   | --- | --- | --- | --- |
   | Frontend | `80` | `3009` | [http://localhost:3009](http://localhost:3009) |
   | Backend (API) | `8080` | `8089` | [http://localhost:8089/docs](http://localhost:8089/docs) |
   | PostgreSQL | `5432` | `5439` | `localhost:5439` |
   | pgAdmin | `80` | `5059` | [http://localhost:5059](http://localhost:5059) |
6. Abra o navegador e acesse o Frontend em [http://localhost:3009](http://localhost:3009).

*(A senha padrão do banco em desenvolvimento é `crm_dev_password_2024`, conforme o `docker-compose.yml`.)*

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
