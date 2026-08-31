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
# Subiu de 3072 quando a hipótese era falta de memória — a causa real
# acabou sendo outra (EMFILE, ver comentário abaixo do `ulimit -n`), mas
# manter esse teto um pouco mais folgado não faz mal.
ENV NODE_OPTIONS="--max-old-space-size=4608"
COPY package*.json ./
COPY packages/ ./packages/
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
# Causa real dos deploys falhando (achada no log RAW do Coolify, o resumo
# sempre cortava antes disso): não é memória — é
# "Error: EMFILE: too many open files, watch '/app'", do watcher de arquivo
# que o compilador do @vanilla-extract (usado pelo @mg/ui) abre sobre /app
# inteiro mesmo num build único (não é modo watch de verdade — o próprio
# vanilla-extract sobe um vite.createServer() interno pra processar os
# .css.ts, com server.hmr:false mas SEM desligar o watcher — dá pra
# confirmar em node_modules/@vanilla-extract/compiler/dist/*.cjs.dev.js,
# não é algo que dá pra desligar pelas options públicas do plugin). Sem
# suporte nativo de inotify otimizado nesse filesystem, o chokidar cai no
# fallback _watchWithNodeFs, que abre 1 file descriptor POR DIRETÓRIO sob
# /app — um monorepo deste tamanho (25+ sistemas vendorizados, cada um com
# node_modules próprio nalguns casos) facilmente passa de 65536 diretórios.
# `ulimit -n 65536` (tentativa anterior) não foi suficiente — foi
# substituído por "sobe pro teto físico que o container permitir", sem
# chutar um número: imprime os valores no log (senão fica no escuro nas
# próximas falhas, de novo) e usa o hard limit como soft limit.
RUN echo "ulimit antes: soft=$(ulimit -Sn) hard=$(ulimit -Hn)" \
 && ulimit -n "$(ulimit -Hn)" \
 && echo "ulimit depois: soft=$(ulimit -Sn) hard=$(ulimit -Hn)" \
 && npm run build

# Production stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Nginx config: SPA routing (React Router) + cache-control.
# index.html nunca é cacheado (todo deploy é pego na hora); assets com hash
# são cacheados agressivamente. Evita usuários presos a bundle JS antigo.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
