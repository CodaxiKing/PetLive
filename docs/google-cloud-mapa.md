# Projeto no Google Cloud: mapa e lugares (Places API (New) + Maps SDK)

Checklist de configuração do Google Cloud Platform (GCP) para o módulo Mapa do PetLive.

**Task:** `P-CKctk — [BACKEND] Mapa: Projeto no Google Cloud: Places API (New) e Maps SDK, chaves restritas e orçamento com alerta` (Fase 1).

O que depende de conta ou dinheiro está marcado com **[você]**. Nada abaixo exige código novo: o app já consome as variáveis; este documento é a operação de nuvem e as salvaguardas de segredo.

## O que fica onde

| Componente | Variável | Onde fica (segredo, nunca no repositório) | Restrição de aplicação | Restrição de API |
|---|---|---|---|---|
| App do tutor (Android) | `GOOGLE_MAPS_ANDROID_KEY` | Segredo de build no EAS (`eas env:create`) | SHA-1 do certificado + package `app.petlive.tutor` | Somente Maps SDK for Android |
| App do tutor (iOS) | `GOOGLE_MAPS_IOS_KEY` | Segredo de build no EAS | Bundle ID `app.petlive.tutor` | Somente Maps SDK for iOS |
| Site / painel (Next.js) | `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` | Variáveis de ambiente do deploy (Vercel ou equivalente) | Referrers HTTP de domínio | Somente Maps JavaScript API |
| Edge Functions (Supabase) | `GOOGLE_PLACES_KEY` | `npx supabase secrets set` | IPs de saída do servidor, quando fixos | Somente Places API (New) |

## Passo 1: Criar o projeto e vincular o faturamento

1. No console do Google Cloud, crie um projeto com **nome identificável**, por exemplo:
   - `petlive-mapa-dev`, `petlive-mapa-homolog` e `petlive-mapa-prod` (recomendado: um por ambiente); ou
   - um único projeto `petlive-mapa` com chaves separadas por ambiente (mínimo aceitável).
2. Vincule uma **conta de faturamento (Cloud Billing)** ao projeto. **[você]**
   - Sem faturamento ativo, as APIs do Google retornam erro e o mapa não carrega.

## Passo 2: Ativar as APIs

No projeto (ou em cada projeto de ambiente), ative:

- **Places API (New)** — buscas de lugares, usada pelas Edge Functions `places-nearby`, `place-details` e `place-photo`.
- **Maps JavaScript API** — mapa do site/painel (Next.js).
- **Maps SDK for Android** — mapa do app do tutor no Android.
- **Maps SDK for iOS** — mapa do app do tutor no iOS.

## Passo 3: Criar as chaves de API (com restrições)

Crie **uma chave por plataforma e, quando possível, por ambiente**. Nunca crie uma chave genérica sem restrição; cada chave fica restrita apenas às APIs que usa.

| Chave | Restrição de aplicação | Restrição de API | Usada por |
|---|---|---|---|
| Web | Referrers HTTP de domínio: `*.petlive.app.br` (produção), `localhost` (desenvolvimento) | Somente Maps JavaScript API | `apps/web` |
| Android | Apps Android: SHA-1 do certificado de assinatura + package name `app.petlive.tutor` | Somente Maps SDK for Android | `apps/tutor` |
| iOS | Apps iOS: bundle ID `app.petlive.tutor` | Somente Maps SDK for iOS | `apps/tutor` |
| Places (servidor) | IPs de saída do servidor (Supabase Edge Functions), quando fixos; caso contrário sem restrição de aplicação | Somente Places API (New) | `supabase/functions` |

Para o Android, cadastre uma chave para o certificado de debug (desenvolvimento) e outra para o certificado de release (produção/homologação). Informe a SHA-1 do certificado de upload do Play Console e do certificado de distribuição da App Store nas respectivas chaves. **[você]**

## Passo 4: Segregação por ambiente

Recomendado: um projeto do GCP por ambiente (`dev`, `homolog`, `prod`) com seu próprio conjunto de chaves. Mínimo aceitável: chaves de produção com restrições rígidas de domínio (web) e IP/package name/bundle ID (app), e chaves de desenvolvimento restritas a `localhost` e aos certificados de debug.

No EAS, defina as variáveis por canal de build (`development`, `preview`, `production`) com `eas env:create` — elas não vão para o `eas.json` versionado. **[você]**

## Passo 5: Orçamento de faturamento e alertas

No **Google Cloud Billing**, para o projeto (ou para cada projeto de ambiente):

1. Defina um **orçamento com teto mensal** (valor a confirmar com o responsável financeiro; sugestão inicial para a Fase 1: **US$ 50,00/mês**). **[você]**
2. Configure alertas de orçamento em **50 %**, **90 %** e **100 %** do teto.
3. Os alertas devem enviar **e-mail para o responsável técnico e para o responsável financeiro**. **[você]**

Isso cobre o risco "Custo do Google Maps Platform cresce com o uso" (BUSINESS.md §8) e o item do plano de Fase 1 "teto mensal de gasto com o Google Maps Platform" (BUSINESS.md §980).

## Passo 6: Coloque cada chave no lugar certo (nunca no repositório)

### App do tutor (Expo / React Native)

As chaves são lidas pelo `app.config.js` **no momento do build** e injetadas nativamente; nunca entram no bundle JS:

```
GOOGLE_MAPS_ANDROID_KEY=<chave do Maps SDK para Android>
GOOGLE_MAPS_IOS_KEY=<chave do Maps SDK para iOS>
```

Adicione como **segredos de build no EAS** (`eas env:create` ou dashboard do EAS) para cada canal. O modelo sem valores fica em `apps/tutor/.env.example`.

### Site / painel (Next.js)

```
NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY=<chave da Maps JavaScript API>
```

Defina nas variáveis de ambiente da plataforma de deploy (Vercel ou equivalente), **não** no repositório. O modelo sem valores fica em `apps/web/.env.example`.

As buscas de lugares do site, quando existirem, chamam o backend (Edge Functions `places-*`), nunca o Google direto do navegador, então a chave do navegador precisa só da Maps JavaScript API.

### Edge Functions (Supabase)

```
npx supabase secrets set GOOGLE_PLACES_KEY=<chave restrita à Places API (New)>
npx supabase functions deploy places-nearby place-details place-photo nearest-emergency
```

Repita para cada ambiente remoto (homologação e produção). O modelo para desenvolvimento local fica em `supabase/.env.example` (serve só o `functions serve` local).

## Passo 7: Verificação funcional

| O que verificar | Como |
|---|---|
| Mapa carrega no app | Tela do mapa com `EXPO_PUBLIC_LUGARES_FONTE=google` e a chave da plataforma no build nativo. |
| Mapa carrega no web | Página do mapa com `NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY` definida no deploy. |
| Autocomplete de lugares | Busca por perto (`places-nearby`) e ficha (`place-details`) retornam resultados pelo backend. |
| Requisições com chave restrita | Chamadas ao Google retornam sucesso (HTTP 200). |
| Sem erro de "chave restrita" | Sem erro de referrer, package name, SHA-1 ou bundle ID não permitido. |
| Sem erro de "faturamento não ativado" | Confirme no console do Google Cloud que o faturamento está vinculado ao projeto. |

### Verificação local sem chave real

O repositório inclui um servidor que imita o Google (`supabase/tests/google-falso.mjs`, porta 8787) e um teste de ponta a ponta das funções:

```bash
# terminal 1
node supabase/tests/google-falso.mjs

# terminal 2 (supabase/.env com GOOGLE_PLACES_KEY=chave-teste e
# GOOGLE_PLACES_BASE_URL=http://host.docker.internal:8787)
npx supabase functions serve --env-file supabase/.env

# terminal 3
node supabase/tests/testar-lugares.mjs <ANON_KEY>
```

### Guarda contra commits acidentais

`pnpm guard:chaves-google` (raiz do monorepo) escaneia os arquivos versionados por chaves do Google (`AIza...`) e sai com erro se encontrar alguma. Rode antes de commitar ou em CI.

## Ligações

- `docs/google-maps-platform.md` — termos do Google, preços por SKU e a decisão pendente do alerta de orçamento.
- `supabase/README.md` — Edge Functions de lugares e `GOOGLE_PLACES_KEY`.
- `apps/tutor/lojas/README.md` — segredos de build do EAS para publicação nas lojas.
- `BUSINESS.md` §5.15 e §8 — lugares do mapa e riscos de custo.
