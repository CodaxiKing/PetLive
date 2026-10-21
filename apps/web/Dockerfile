# PetLive · site (apps/web) para o Coolify.
# Contexto do build: a RAIZ do repositório (monorepo pnpm).
#   docker build -f apps/web/Dockerfile -t petlive-site .
# As variáveis NEXT_PUBLIC_* entram no build (o Next as embute no JS), então
# no Coolify marque-as como "Build Variable".

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /repo

# 1) Dependências só do site (o app do celular fica de fora).
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web...

# 2) Build.
FROM deps AS build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_URL_GOOGLE_PLAY
ARG NEXT_PUBLIC_URL_APP_STORE
ENV NEXT_TELEMETRY_DISABLED=1
COPY apps/web apps/web
RUN pnpm --filter web build

# 3) Execução: só o servidor standalone, os estáticos e o public.
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S site && adduser -S site -G site
COPY --from=build --chown=site:site /repo/apps/web/.next/standalone ./
COPY --from=build --chown=site:site /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=site:site /repo/apps/web/public ./apps/web/public
USER site
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
