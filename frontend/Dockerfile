# Build stage
FROM node:22-alpine as build
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_SUPORTE_SUPABASE_URL
ARG VITE_SUPORTE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_FERIAS_SUPABASE_URL
ARG VITE_FERIAS_SUPABASE_ANON_KEY
ARG VITE_CRONOS_API_URL
ARG VITE_COPILOT_SUPABASE_URL
ARG VITE_COPILOT_SUPABASE_ANON_KEY
ARG VITE_COPILOT_API_URL
ARG VITE_BIMG_SUPABASE_URL
ARG VITE_BIMG_SUPABASE_ANON_KEY
ARG VITE_BIMG_API_URL
ARG VITE_CONTAI_API_URL
ARG VITE_OUVIDORIA_SUPABASE_URL
ARG VITE_OUVIDORIA_SUPABASE_ANON_KEY
ARG VITE_CARNE_LEAO_API_URL
ARG VITE_DOCCONTABIL_API_URL
ARG VITE_CNPJ_API_URL
ARG VITE_TASKFLOW_SUPABASE_URL
ARG VITE_TASKFLOW_SUPABASE_ANON_KEY
ARG VITE_TASKFLOW_API_URL
ARG VITE_ANALYTICS_DP_API_URL
ARG VITE_DASHRH_API_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_SUPORTE_SUPABASE_URL=$VITE_SUPORTE_SUPABASE_URL
ENV VITE_SUPORTE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPORTE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_FERIAS_SUPABASE_URL=$VITE_FERIAS_SUPABASE_URL
ENV VITE_FERIAS_SUPABASE_ANON_KEY=$VITE_FERIAS_SUPABASE_ANON_KEY
ENV VITE_CRONOS_API_URL=$VITE_CRONOS_API_URL
ENV VITE_COPILOT_SUPABASE_URL=$VITE_COPILOT_SUPABASE_URL
ENV VITE_COPILOT_SUPABASE_ANON_KEY=$VITE_COPILOT_SUPABASE_ANON_KEY
ENV VITE_COPILOT_API_URL=$VITE_COPILOT_API_URL
ENV VITE_BIMG_SUPABASE_URL=$VITE_BIMG_SUPABASE_URL
ENV VITE_BIMG_SUPABASE_ANON_KEY=$VITE_BIMG_SUPABASE_ANON_KEY
ENV VITE_BIMG_API_URL=$VITE_BIMG_API_URL
ENV VITE_CONTAI_API_URL=$VITE_CONTAI_API_URL
ENV VITE_OUVIDORIA_SUPABASE_URL=$VITE_OUVIDORIA_SUPABASE_URL
ENV VITE_OUVIDORIA_SUPABASE_ANON_KEY=$VITE_OUVIDORIA_SUPABASE_ANON_KEY
ENV VITE_CARNE_LEAO_API_URL=$VITE_CARNE_LEAO_API_URL
ENV VITE_DOCCONTABIL_API_URL=$VITE_DOCCONTABIL_API_URL
ENV VITE_CNPJ_API_URL=$VITE_CNPJ_API_URL
ENV VITE_TASKFLOW_SUPABASE_URL=$VITE_TASKFLOW_SUPABASE_URL
ENV VITE_TASKFLOW_SUPABASE_ANON_KEY=$VITE_TASKFLOW_SUPABASE_ANON_KEY
ENV VITE_TASKFLOW_API_URL=$VITE_TASKFLOW_API_URL
ENV VITE_ANALYTICS_DP_API_URL=$VITE_ANALYTICS_DP_API_URL
ENV VITE_DASHRH_API_URL=$VITE_DASHRH_API_URL
# Subiu de 3072 quando a hipótese era falta de memória — a causa real do
# deploy falhando acabou sendo EMFILE (ver CHOKIDAR_USEPOLLING mais
# abaixo), não memória, mas manter esse teto um pouco mais folgado não faz
# mal.
ENV NODE_OPTIONS="--max-old-space-size=4608"
COPY package*.json ./
COPY packages/ ./packages/
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
# Causa real dos deploys falhando (achada no log RAW do Coolify, o resumo
# sempre cortava antes disso): "Error: EMFILE: too many open files, watch
# '/app'", do watcher de arquivo que o compilador do @vanilla-extract
# (usado pelo @mg/ui) abre sobre /app inteiro mesmo num build único — sobe
# um vite.createServer() interno pra processar os .css.ts com
# server.hmr:false mas SEM desligar o watcher (confirmado em
# node_modules/@vanilla-extract/compiler/dist/*.cjs.dev.js; não dá pra
# desligar pelas options públicas do plugin).
#
# 1ª tentativa (ulimit -n 65536) e 2ª (subir pro hard limit físico,
# 524288 medido em produção) NÃO resolveram — o log confirmou soft=hard
# depois do ulimit e o erro persistiu idêntico. Isso descarta file
# descriptor como causa: o teto de verdade é
# fs.inotify.max_user_instances do KERNEL do host, que `ulimit` não
# controla (só dá pra mudar com sysctl, que exige privilégio que o
# container de build não tem).
#
# Fix de verdade: CHOKIDAR_USEPOLLING=true. Confirmado lendo o bundle do
# watcher (node_modules/@vanilla-extract/compiler/node_modules/vite/dist/
# node/chunks/dep-*.js) — ele lê essa env var e troca pra polling (fica
# checando os arquivos periodicamente) em vez de inotify, contornando o
# limite inteiro em vez de tentar caber nele. Mais lento que inotify, mas
# isso não importa aqui: é só um watcher que nem deveria existir num build
# de produção de uma vez só.
ENV CHOKIDAR_USEPOLLING=true
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx config: SPA routing (React Router) + cache-control.
# index.html nunca é cacheado (todo deploy é pego na hora); assets com hash
# são cacheados agressivamente. Evita usuários presos a bundle JS antigo.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
