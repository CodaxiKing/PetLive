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
    globals.css           # tokens de cor PetLive (tema Tailwind v4)
  components/
    Logo.tsx  Cabecalho.tsx  Rodape.tsx  PaginaLegal.tsx
```

Os tokens de cor (`bg-azul`, `text-cinza`, `bg-suave`…) vêm de `globals.css`
e espelham o design system do app do tutor e do protótipo `prototipo/SitePetLive.dc.html`.

## Pendências

- Botões das lojas de apps (Google Play / App Store) ainda são decorativos.
- Paginação/OG image e sitemap entram junto do SEO.
