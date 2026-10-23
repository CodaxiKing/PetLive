# PetLive · site (apps/web)

Site público do PetLive em [Next.js 16](https://nextjs.org) (App Router, Turbopack)
+ [Tailwind CSS v4](https://tailwindcss.com) + TypeScript.

Parte do workspace pnpm na raiz do repositório — não há `pnpm install` local;
sempre rode os comandos a partir da raiz ou com `pnpm --filter web <script>`.

## Rodando

```bash
pnpm --filter web dev      # http://localhost:3000
pnpm --filter web build    # build de produção
pnpm --filter web lint     # ESLint
```

## Estrutura

```
src/
  app/
    layout.tsx            # raiz: fonte Plus Jakarta Sans, cabeçalho e rodapé
    page.tsx              # home (herói, recursos, passos, serviços, planos, FAQ)
    termos/page.tsx       # Termos de uso
    privacidade/page.tsx  # Política de privacidade
    lgpd/page.tsx         # Direitos na LGPD
    (tutor)/contato       # Contato (formulário)
    lojistas/             # Para lojistas: layout escuro próprio e formulário de interesse
    globals.css           # tokens de cor PetLive (tema Tailwind v4)
  components/
    Logo.tsx  Cabecalho.tsx  Rodape.tsx  PaginaLegal.tsx
```

Os tokens de cor (`bg-azul`, `text-cinza`, `bg-suave`…) vêm de `globals.css`
e espelham o design system do app do tutor e do protótipo `prototipo/SitePetLive.dc.html`.

## Pendências

- Botões das lojas de apps (Google Play / App Store) ainda são decorativos.
- Paginação/OG image e sitemap entram junto do SEO.

## Variáveis de ambiente

| Variável | Para quê |
| --- | --- |
| `NEXT_PUBLIC_URL_GOOGLE_PLAY` | Link do app no Google Play. Sem ela, o botão mostra "Em breve". |
| `NEXT_PUBLIC_URL_APP_STORE` | Link do app na App Store. Sem ela, o botão mostra "Em breve". |
| `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Formulários de contato e de lojistas (função `registrar_contato_site`). Sem elas, o formulário mostra o e-mail. |
| `NEXT_PUBLIC_GA_ID` | ID do Google Analytics 4 (`G-...`). Só carrega depois do "Aceitar" no aviso de cookies; sem ela, nada é medido. |

SEO: `src/app/sitemap.ts`, `src/app/robots.ts` e os dados estruturados
(`MobileApplication`) na home.

## Publicar no Coolify

O site sobe como imagem Docker (`apps/web/Dockerfile`, saída `standalone` do Next).

1. **New Resource › Public/Private Repository** › este repositório, branch `main`.
2. **Build Pack:** `Dockerfile`.
   - **Base Directory:** `/` (a raiz: é um monorepo pnpm)
   - **Dockerfile Location:** `/apps/web/Dockerfile`
3. **Ports Exposes:** `3000`.
4. **Domains:** `https://petlive.app` (e `https://www.petlive.app`, se usar).
   No DNS, aponte um registro `A` para o IP do servidor do Coolify; o
   certificado HTTPS sai sozinho.
5. **Environment Variables** — marque **Build Variable** em todas (o Next
   embute as `NEXT_PUBLIC_*` no build; mudar exige novo deploy):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (projeto de produção)
   - opcionais: `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_URL_GOOGLE_PLAY`, `NEXT_PUBLIC_URL_APP_STORE`
6. **Deploy.** O container tem healthcheck; para atualizar, um push na `main`
   (com o deploy automático ligado) ou "Redeploy".

Testar a imagem no computador:

```bash
docker build -f apps/web/Dockerfile -t petlive-site .
docker run --rm -p 3000:3000 petlive-site
```
