# Supabase

Banco de dados, regras de acesso (RLS), storage e funções do servidor.

- `migrations/`: schema do banco em SQL, uma migração por mudança.
- `seeds/`: dados de apoio (ex.: lugares do mapa importados do OSM).
- `functions/`: funções do servidor (lembretes, horários livres, pagamentos).

Tarefas: `[BACKEND]` no [board](https://github.com/users/CodaxiKing/projects/5).
Modelo de dados: seção 7 do [BUSINESS.md](../BUSINESS.md).

## Rotina de backup

- **Local** (`npx supabase start`): `pnpm backup` na raiz — gera
  `backups/petlive-AAAAAMMDD-HHMMSS.sql` (esquema + dados) e mantém os 10
  mais recentes. Pasta ignorada pelo git.
- **Remoto**: depois de criar o projeto (tarefa P0) e logar o CLI
  (`npx supabase login` + `npx supabase link --project-ref <ref>`):

  ```powershell
  # senha = "Database Settings > DB Password" (ou a do pooler)
  npx supabase db dump --linked -p <senha> -f backups/remoto.sql
  npx supabase db dump --linked -p <senha> --data-only -f backups/remoto-dados.sql
  ```

  Agende no agendador do seu SO (Task Scheduler/`cron`) ou num GitHub Actions
  semanal com `secrets.SUPABASE_DB_PASSWORD`. No plano Pro, ative também
  PITR (point-in-time recovery) no dashboard como rede de segurança.

## Monitoramento

`pnpm monitor` na raiz verifica: `/auth/v1/health`, `/storage/v1/health`,
REST respondendo com a anon key, e invariantes de segurança (tabela `pets`
sem vazamento de linhas para anon; RPC `lugares_por_perto` sem EXECUTE para
anon). Exit code 1 em falha — apt para cron/CI.

O app envia erros de runtime ao Sentry quando `EXPO_PUBLIC_SENTRY_DSN`
está definido (ver `apps/tutor/.env.example`).

## Exclusão de conta com prazo (LGPD)

Pedir a exclusão no app agenda a remoção para 30 dias (`lgpd_requests`). Todo
dia às 03:00 (Brasília) o `pg_cron` chama a Edge Function `lgpd-delete`, que
apaga os arquivos do Storage e a conta (o resto cai em cascata).

Uma vez por ambiente remoto:

```powershell
npx supabase functions deploy lgpd-delete --no-verify-jwt
```

E, no SQL Editor, os dois secrets que o cron usa:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('<service_role key>', 'service_role_key');
```

Sem os secrets o cron roda e não faz nada. Para testar localmente:
`npx supabase functions serve --no-verify-jwt` e um `POST` em
`/functions/v1/lgpd-delete` com `Authorization: Bearer <service_role>`.

## Lugares do Google (Places API New)

As Edge Functions `places-nearby`, `place-details`, `place-photo` e
`nearest-emergency` chamam o Google com a chave guardada só no servidor, pedem
os campos mínimos e contam cada chamada em `places_usage` (limite diário por
usuário: 80 buscas, 40 fichas, 120 fotos).

Uma vez por ambiente remoto:

```powershell
npx supabase secrets set GOOGLE_PLACES_KEY=<chave restrita à Places API (New)>
npx supabase functions deploy places-nearby place-details place-photo nearest-emergency
```

Sem a chave, as funções respondem `503 sem_chave` e o app segue com os
lugares do OpenStreetMap. No app, `EXPO_PUBLIC_LUGARES_FONTE=google` liga a
fonte do Google (junto com o mapa do Google, exigência dos termos).

Teste local sem chave real, com um servidor que imita o Google:

```powershell
node supabase/tests/google-falso.mjs   # porta 8787
# arquivo .env com GOOGLE_PLACES_KEY=chave-teste e
# GOOGLE_PLACES_BASE_URL=http://host.docker.internal:8787/v1
npx supabase functions serve --env-file <esse .env>
node supabase/tests/testar-lugares.mjs <ANON_KEY>
```

## Auth: redirecionamentos do app

O app usa `petlive://auth/callback` (login com Google) e `petlive://auth/nova-senha`
("Esqueci minha senha"). Em produção, cadastre `petlive://**` em
Auth › URL Configuration › Redirect URLs; localmente já está em `config.toml`
(depois de mudar, `npx supabase stop && npx supabase start` para o Auth recarregar).

## Mensagens do site

`site_contacts` guarda o formulário de contato e o interesse de lojistas do site
(`apps/web`). Só grava pela função `registrar_contato_site` (valida, descarta robôs
pelo campo isca, 3 por e-mail por dia e 500 por dia no total); a API não lê a
tabela. A equipe consulta no painel do Supabase e apaga em até 12 meses
(política de privacidade).

## Indicações de lugares pet friendly (moderação)

Tutores indicam restaurantes, hotéis, praias e parques que aceitam pets
(tabela `sugestoes_lugar`, até 5 por dia). Tudo entra **em análise** e só vai
para o mapa depois de aprovado — mesma regra dos eventos (BUSINESS.md 5.16),
em até 1 dia útil. Até o painel admin (Fase 2), a equipe modera no SQL Editor
do Supabase:

```sql
-- fila
select id, nome, categoria, aceita, endereco, observacao, criado_em
from sugestoes_lugar where status = 'em_analise' order by criado_em;

select aprovar_sugestao_lugar('<id>');                 -- publica em places (fonte 'tutor')
select recusar_sugestao_lugar('<id>', 'Motivo curto'); -- o tutor vê o motivo no app
```
