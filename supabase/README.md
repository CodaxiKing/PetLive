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
