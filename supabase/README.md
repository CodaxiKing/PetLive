# Supabase

Banco de dados, regras de acesso (RLS), storage e funções do servidor.

- `migrations/`: schema do banco em SQL, uma migração por mudança.
- `seeds/`: dados de apoio (ex.: lugares do mapa importados do OSM).
- `functions/`: funções do servidor (lembretes, horários livres, pagamentos).

Tarefas: `[BACKEND]` no [board](https://github.com/users/CodaxiKing/projects/5).
Modelo de dados: seção 7 do [BUSINESS.md](../BUSINESS.md).

## Eventos pet

A migração `20261122000000_eventos_pet.sql` cria eventos, organizadores,
presenças e denúncias com RLS. A criação por RPC limita cada pessoa a três
envios por mês (calendário de Brasília), incluindo os cancelados. A linha do
perfil é bloqueada durante a criação para serializar requisições da mesma
pessoa. Eventos de organizadores verificados publicam direto; os demais
aguardam análise. A verificação só pode ser alterada pelo backend, nunca
pelo próprio usuário via API. Eventos oficiais exigem permissão administrativa.

Com o banco local e as migrações anteriores disponíveis, execute na raiz:

```powershell
./supabase/tests/testar-eventos.ps1
```

O teste aplica a migração e cria usuários temporários dentro de uma transação
com rollback. Verifica limite mensal, cancelamento, mudança de mês,
verificação e revogação, vagas, presença e privacidade entre usuários e
visitantes. Não publica no ambiente remoto nem persiste dados de teste.

A migração `20261123000000_eventos_jobs.sql` agenda os lembretes de 1 dia
e 2 horas a cada 15 minutos, e encerra eventos publicados vencidos a cada
hora. Requer `pg_cron` e `pg_net` no ambiente. Avisos globais, categoria
Eventos, dispositivos ativos e Não perturbe são respeitados. O horário
final da janela de silêncio é exclusivo; horários iguais desativam a janela.
Fuso inválido usa Brasília. Cada lembrete gera um aviso no histórico e um
push por dispositivo ativo, com link para a ficha do evento.

O registro de entrega indica que o envio foi colocado na fila HTTP, sem
confirmar recebimento pelo aparelho. A chave por evento, pessoa e
antecedência impede duplicidade na fila. Uma falha HTTP posterior ao
enfileiramento não tem retentativa automática nesta versão.

O mesmo comando de teste também verifica os jobs e seus agendamentos,
simulando `net.http_post` dentro da transação para não enviar push real.
Usa o usuário administrativo do container local para simular o transporte;
a função original é restaurada pelo rollback.

A fila administrativa em `/admin/eventos` permite aprovar, pedir ajustes,
recusar e tratar eventos ocultos. Cada estado oferece apenas suas decisões
válidas. Moderação e super admin podem decidir com 2FA; o papel leitura
apenas consulta. Os testes de eventos também cobrem essa autorização,
motivos obrigatórios, transições e registro das decisões na auditoria.

A ficha do app em `/eventos/[id]` usa `evento_detalhe`, criada pela migração
`20261124000000_evento_detalhe.sql`. Retorna dados públicos do evento,
nome público da organização, verificação e quantidade de presenças.
Eventos não publicados ou vencidos ficam indisponíveis, inclusive antes
do cron encerrar. Não retorna contatos, IDs de usuários ou participantes.
O teste transacional também cobre esses campos e estados.

A migração `20261125000000_evento_presenca.sql` acrescenta `eu_vou` à ficha
(somente a presença da própria sessão) e a RPC `evento_definir_presenca`.
Ela recebe o estado desejado, confirma ou cancela sem alternar em caso de
repetição de requisição e devolve a ficha com a contagem atualizada. O bloqueio
do evento serializa a disputa por vagas. Cancelar remove a presença; ao
confirmar novamente, apenas lembretes ainda não enviados ficam pendentes.
O botão na ficha permite cancelar mesmo quando o evento está lotado.
As preferências de avisos incluem a categoria Eventos, com lembretes de
1 dia e 2 horas. Os testes cobrem repetição, lotação e retomada dos lembretes.

O Perfil oferece **Meus eventos**, com os estados, motivos de moderação,
edição e cancelamento. A migração `20261126000000_evento_edicao.sql` reenvia
para análise alterações de data, horário ou local (incluindo coordenadas e
Place ID), e correções de eventos com ajustes solicitados. As presenças
são mantidas; mudanças de local ou horário geram avisos no histórico.
O limite de vagas não pode cair abaixo da contagem de presenças.
Cancelar pode ser repetido sem duplicar avisos e pushes. O formulário
base também valida datas, duração, coordenadas, ingresso e vagas.
A criação inclui seletor de ponto no mapa com busca por endereço. Quando
o mapa do Google está configurado, também permite escolher lugares por
perto, persistindo apenas o Place ID e o nome de local escrito pela pessoa.
A foto de divulgação é opcional, com seleção na galeria e prévia.

A migração `20261127000000_evento_foto.sql` cria o bucket público `eventos`
com limite de 5 MB e formatos JPEG, PNG e WebP. Cada usuário envia arquivos
novos apenas em sua própria pasta, sem sobrescrever os anteriores. O app
reutiliza um upload bem-sucedido ao repetir o salvamento. Alterar ou remover
a foto volta o evento para análise. As URLs das fotos precisam usar HTTPS.
Os testes de eventos verificam o bucket, as políticas, a criação com foto,
a edição e a reanálise; os testes do app cobrem limites e falhas de upload.

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

## Entrar com Apple (iPhone)

A App Store exige "Entrar com Apple" em app que oferece o login do Google
(diretriz 4.8). O app usa o login nativo (`expo-apple-authentication`) e troca
o token por sessão com `signInWithIdToken` — não precisa de segredo nem de
página de retorno. Para ligar em produção:

1. Apple Developer › Identifiers › `app.petlive.tutor`: marcar **Sign in with Apple**.
2. Supabase › Auth › Providers › Apple: ligar e pôr `app.petlive.tutor` em
   **Client IDs** (o campo de segredo fica vazio no login nativo).
3. Build de iOS pelo EAS (o `app.json` já tem `usesAppleSignIn`).

O botão só aparece no iPhone; a Apple manda o nome só no primeiro login, e o
app guarda nessa hora.

## Painel admin (`/admin` no site)

Acesso só da equipe, com o código do app autenticador (2FA) em toda entrada.
As regras ficam no banco: as funções `admin_*` exigem um membro ativo de
`admin_members` e o token com `aal2`; o que altera dados vai para `audit_log`.

1. **2FA ligado:** Authentication › Multi-Factor (TOTP habilitado — no
   hosted já vem ligado; local: `[auth.mfa.totp]` no `config.toml`).
2. **Primeiro super admin** (a pessoa já precisa ter conta), no SQL Editor:
   ```sql
   insert into admin_members (user_id, papel)
   select id, 'super' from auth.users where email = '<e-mail>';
   ```
3. Entrar em `https://<site>/admin`: no primeiro acesso aparece o QR para
   cadastrar o app autenticador. As outras pessoas o super admin põe pela
   tela **Equipe**.

Teste das regras: `node supabase/tests/testar-admin.mjs <ANON_KEY>` (precisa
de `admin@petlive.dev` como super, sem 2FA, e do `demo@petlive.dev`).
