# Tabelas do banco de dados (PetLive)

Todas as tabelas do esquema `public` do Supabase que o app do tutor, o site, o painel admin, o painel do lojista e as funções do servidor usam.

## Como foi levantado

- **Fonte:** as 139 migrações de `supabase/migrations`, aplicadas em ordem num Postgres em memória (`supabase/tests/banco-memoria.mjs`). O banco hospedado `petlive-dev` foi conferido e tem exatamente as mesmas 135 tabelas.
- **Uso:** nomes de tabelas e funções do banco citados no código de `apps/tutor`, `apps/web/src` (site, `admin` e `lojista`) e `supabase/functions`.
  - **direto**: o código lê ou grava a tabela pela API (`from(...)`).
  - **função**: o código chama uma função do banco (`rpc(...)`) que lê ou grava a tabela, inclusive por funções que ela chama.
  - **cron**: tarefa agendada no `pg_cron` que mexe na tabela.
- **Atualizar:** depois de uma migração nova, gere este arquivo de novo com o mesmo levantamento.

## Resumo

| | Tabelas |
|---|---|
| Total no banco | 135 |
| Usadas pelo app do tutor | 113 |
| Usadas pelo site | 19 |
| Usadas pelo painel admin | 70 |
| Usadas pelo painel do lojista | 7 |
| Usadas pelas funções do servidor | 34 |
| Tocadas por tarefas agendadas (cron) | 49 |
| Sem uso atual | 1 (`carteirinha_acessos`) |

## Quem usa cada tabela

| Tabela | Assunto | App do tutor | Site | Painel admin | Painel do lojista | Funções do servidor | Cron |
|---|---|---|---|---|---|---|---|
| [`dewormings`](#dewormings) | Schema inicial | função | função |  |  |  | sim |
| [`medication_doses`](#medication_doses) | Schema inicial | direto | função | função |  |  |  |
| [`medications`](#medications) | Schema inicial | direto | função | função |  |  |  |
| [`notification_prefs`](#notification_prefs) | Schema inicial | direto |  | função |  | função | sim |
| [`pets`](#pets) | Schema inicial | direto | função | direto |  | direto | sim |
| [`profiles`](#profiles) | Schema inicial | direto | função | função |  | função | sim |
| [`push_tokens`](#push_tokens) | Schema inicial | função |  | função |  | função | sim |
| [`reminders`](#reminders) | Schema inicial | direto |  | função |  |  | sim |
| [`vaccinations`](#vaccinations) | Schema inicial | direto | função | função |  |  | sim |
| [`vaccine_schedule`](#vaccine_schedule) | Schema inicial | direto |  | função |  |  |  |
| [`visits`](#visits) | Schema inicial | direto |  |  |  |  | sim |
| [`weights`](#weights) | Schema inicial | direto |  |  |  |  | sim |
| [`aceites_termos`](#aceites_termos) | Aceite termos lgpd | função |  |  |  |  |  |
| [`notification_settings`](#notification_settings) | Tela avisos | direto |  | função |  | função | sim |
| [`places`](#places) | Places mapa | direto |  | função |  | direto | sim |
| [`consentimentos`](#consentimentos) | Consentimentos lgpd | direto |  | função |  | função | sim |
| [`lgpd_requests`](#lgpd_requests) | Lgpd pedidos com prazo | função |  | função |  | função |  |
| [`content_packs`](#content_packs) | Content pack | direto |  | função |  |  |  |
| [`saved_places`](#saved_places) | Saved places | direto |  | função |  |  |  |
| [`places_usage`](#places_usage) | Places usage |  |  |  |  | função |  |
| [`site_contacts`](#site_contacts) | Site contatos |  | função | função |  |  |  |
| [`eventos_uso`](#eventos_uso) | Eventos uso | direto |  | função |  |  | sim |
| [`sugestoes_lugar`](#sugestoes_lugar) | Sugestoes lugar | direto |  | função |  |  |  |
| [`notification_log`](#notification_log) | Caixa avisos | direto | função | função |  | função | sim |
| [`admin_members`](#admin_members) | Painel admin | função |  | função |  | função |  |
| [`audit_log`](#audit_log) | Painel admin |  |  | função |  |  |  |
| [`campanhas`](#campanhas) | Admin painel dependencias |  |  | direto |  |  | sim |
| [`companhias_aereas`](#companhias_aereas) | Admin painel dependencias | direto |  | função |  |  |  |
| [`conteudo_versoes`](#conteudo_versoes) | Admin painel dependencias |  |  | função |  |  |  |
| [`datas_fogos`](#datas_fogos) | Admin painel dependencias | direto |  | função |  |  | sim |
| [`site_contact_notas`](#site_contact_notas) | Admin painel dependencias |  |  | função |  |  |  |
| [`viagem_itens`](#viagem_itens) | Admin painel dependencias | direto |  | função |  |  |  |
| [`viagens`](#viagens) | Admin painel dependencias | direto |  |  |  |  |  |
| [`carteirinha_links`](#carteirinha_links) | Carteirinha por link | direto | função | função |  | função | sim |
| [`app_config`](#app_config) | Admin sistema | função |  | função |  |  |  |
| [`recursos`](#recursos) | Admin sistema | função | direto | função |  | função |  |
| [`carteirinha_acessos`](#carteirinha_acessos) | Ficha emergencia |  |  |  |  |  |  |
| [`cuidador_acessos`](#cuidador_acessos) | Cuidador temporario | direto | função |  |  |  | sim |
| [`cuidador_registros`](#cuidador_registros) | Cuidador temporario | função | função |  |  |  |  |
| [`despesas`](#despesas) | Despesas | direto |  |  |  | função | sim |
| [`marcos`](#marcos) | Linha do tempo | direto |  |  |  |  |  |
| [`memorial`](#memorial) | Modo memorial | direto |  | função |  |  | sim |
| [`idade_senior`](#idade_senior) | Pet senior | função |  | função |  |  | sim |
| [`qualidade_vida`](#qualidade_vida) | Pet senior | direto |  |  |  |  |  |
| [`senior`](#senior) | Pet senior | direto |  |  |  |  | sim |
| [`receitas`](#receitas) | Admin financeiro |  |  | função |  |  |  |
| [`fogos_avisos`](#fogos_avisos) | Fogos e trovao |  |  |  |  |  | sim |
| [`fogos_prefs`](#fogos_prefs) | Fogos e trovao | direto |  | função |  |  | sim |
| [`pet_selos`](#pet_selos) | Selos de cuidado | função |  |  |  |  | sim |
| [`documentos_saude`](#documentos_saude) | Documentos saude | direto |  |  |  |  |  |
| [`pet_members`](#pet_members) | Acesso familia | função | função |  |  | função |  |
| [`event_moderation_actions`](#event_moderation_actions) | Eventos pet |  |  | função |  |  |  |
| [`event_reminder_deliveries`](#event_reminder_deliveries) | Eventos pet | função |  |  |  |  | sim |
| [`event_reports`](#event_reports) | Eventos pet | função |  | função |  |  |  |
| [`event_rsvps`](#event_rsvps) | Eventos pet | função |  | função |  |  | sim |
| [`events`](#events) | Eventos pet | função |  | função |  |  | sim |
| [`organizers`](#organizers) | Eventos pet | função |  | função |  |  |  |
| [`pet_qr_settings`](#pet_qr_settings) | Qr coleira | direto | função |  |  |  |  |
| [`qr_limites`](#qr_limites) | Qr coleira |  | função |  |  |  |  |
| [`passeios_tutor`](#passeios_tutor) | Passeios tutor | direto |  |  |  |  | sim |
| [`eventos_avisos_proximos`](#eventos_avisos_proximos) | Eventos por regiao | função |  |  |  |  | sim |
| [`eventos_regioes`](#eventos_regioes) | Eventos por regiao | função |  |  |  |  | sim |
| [`despesas_resumo_preferencias`](#despesas_resumo_preferencias) | Exportar despesas | direto |  |  |  |  | sim |
| [`despesas_resumos_enviados`](#despesas_resumos_enviados) | Exportar despesas | função |  |  |  |  | sim |
| [`adocao_contatos`](#adocao_contatos) | Catalogo adocao | função |  |  |  |  |  |
| [`adocao_favoritos`](#adocao_favoritos) | Catalogo adocao | função |  |  |  |  |  |
| [`adocao_ongs`](#adocao_ongs) | Catalogo adocao | função |  | função |  |  |  |
| [`adocao_pets`](#adocao_pets) | Catalogo adocao | função |  | função |  |  |  |
| [`lugares_destaques_pagos`](#lugares_destaques_pagos) | Destaques pagos lugares | função |  |  |  |  |  |
| [`ong_cadastros`](#ong_cadastros) | Cadastro ong documentos | função |  | função |  |  |  |
| [`carteirinha_limites`](#carteirinha_limites) | Reconciliar carteirinha |  | função |  |  |  | sim |
| [`carteirinha_envios`](#carteirinha_envios) | Historico envios fichas | função |  |  |  |  |  |
| [`ficha_push_fila`](#ficha_push_fila) | Push abertura ficha | função |  | função |  | função | sim |
| [`pet_activity`](#pet_activity) | Guarda compartilhada | direto |  |  |  |  |  |
| [`pet_invites`](#pet_invites) | Guarda compartilhada | função | função |  |  |  |  |
| [`plano_limites_config`](#plano_limites_config) | Limites plano desativados | função |  |  |  |  |  |
| [`subscriptions`](#subscriptions) | Consulta assinatura | função |  | função |  | função | sim |
| [`premium_cupons_rascunho`](#premium_cupons_rascunho) | Planos cupons rascunho |  |  | função |  | função |  |
| [`premium_planos_rascunho`](#premium_planos_rascunho) | Planos cupons rascunho |  |  | função |  | função |  |
| [`catalogo_racas`](#catalogo_racas) | Catalogo racas | função |  | função |  |  |  |
| [`catalogo_categorias_mapa`](#catalogo_categorias_mapa) | Catalogo categorias mapa | função |  | função |  |  |  |
| [`admin_eventos_pedidos`](#admin_eventos_pedidos) | Admin eventos organizadores |  |  | função |  |  |  |
| [`cartao_leituras`](#cartao_leituras) | Leitura cartao vacina |  |  |  |  | função |  |
| [`qr_localizacoes`](#qr_localizacoes) | Qr localizacao achado | direto | função |  |  |  |  |
| [`lost_alert_receipts`](#lost_alert_receipts) | Pet perdido | função |  | função |  |  |  |
| [`lost_alert_sightings`](#lost_alert_sightings) | Pet perdido | direto |  | função |  |  |  |
| [`lost_alerts`](#lost_alerts) | Pet perdido | direto | função | função |  | função | sim |
| [`perdidos_regioes`](#perdidos_regioes) | Pet perdido | função |  |  |  |  | sim |
| [`insurance_clicks`](#insurance_clicks) | Parceiros seguro | função |  | função |  |  |  |
| [`insurance_partners`](#insurance_partners) | Parceiros seguro | direto |  | função |  |  |  |
| [`achei_buscas`](#achei_buscas) | Achei pet foto |  |  |  |  | função | sim |
| [`escala_itens`](#escala_itens) | Conteudo luto senior escala | direto |  | função |  |  |  |
| [`luto_recursos`](#luto_recursos) | Conteudo luto senior escala | direto |  | função |  |  |  |
| [`comments`](#comments) | Comunidade | função |  | função |  |  |  |
| [`comunidade_denuncias`](#comunidade_denuncias) | Comunidade | função |  | função |  |  |  |
| [`follows`](#follows) | Comunidade | função |  |  |  |  |  |
| [`likes`](#likes) | Comunidade | função |  |  |  |  |  |
| [`pet_public_profiles`](#pet_public_profiles) | Comunidade | função |  | função |  |  |  |
| [`posts`](#posts) | Comunidade | função |  | função |  |  |  |
| [`app_reviews`](#app_reviews) | Avaliacoes apps |  |  | função |  | função |  |
| [`app_reviews_sync`](#app_reviews_sync) | Avaliacoes apps |  |  | função |  | função |  |
| [`lgpd_exclusoes`](#lgpd_exclusoes) | Lgpd worker seguro | função |  |  |  | função |  |
| [`lgpd_worker_config`](#lgpd_worker_config) | Lgpd worker seguro | função |  |  |  | função |  |
| [`addresses`](#addresses) | Marketplace base | direto |  |  |  |  |  |
| [`products`](#products) | Marketplace base | função |  | função | função | função | sim |
| [`request_events`](#request_events) | Marketplace base | função |  |  |  |  |  |
| [`request_items`](#request_items) | Marketplace base | função |  |  |  | função | sim |
| [`requests`](#requests) | Marketplace base | função |  |  |  | função | sim |
| [`services`](#services) | Marketplace base | função |  | função | função |  | sim |
| [`store_hours`](#store_hours) | Marketplace base | função |  |  | função |  |  |
| [`store_members`](#store_members) | Marketplace base | função |  | função | função | função | sim |
| [`stores`](#stores) | Marketplace base | função |  | função | função | função | sim |
| [`time_off`](#time_off) | Marketplace base | função |  |  |  |  |  |
| [`conversations`](#conversations) | Chat loja | função |  |  |  |  |  |
| [`messages`](#messages) | Chat loja | direto |  |  |  |  |  |
| [`reviews`](#reviews) | Avaliacoes lojas estoque | função |  | função |  |  |  |
| [`store_documents`](#store_documents) | Loja cadastro moderacao |  |  | função | função |  |  |
| [`store_place_claims`](#store_place_claims) | Loja cadastro moderacao |  |  | função | função |  |  |
| [`store_reports`](#store_reports) | Loja cadastro moderacao | função |  | função |  |  |  |
| [`daycare_plans`](#daycare_plans) | Regras servico | função |  |  |  |  |  |
| [`lodging_rates`](#lodging_rates) | Regras servico | função |  |  |  |  |  |
| [`request_days`](#request_days) | Regras servico | função |  |  |  |  |  |
| [`service_extras`](#service_extras) | Regras servico | função |  |  |  |  |  |
| [`walk_rules`](#walk_rules) | Regras servico | função |  |  |  |  | sim |
| [`walk_events`](#walk_events) | Passeio ao vivo | direto |  |  |  |  |  |
| [`walk_points`](#walk_points) | Passeio ao vivo | direto |  |  |  |  |  |
| [`walks`](#walks) | Passeio ao vivo | direto |  |  |  |  | sim |
| [`deliveries`](#deliveries) | Entregas | função |  |  |  |  |  |
| [`coupon_uses`](#coupon_uses) | Pagamentos pix | função |  |  |  |  |  |
| [`coupons`](#coupons) | Pagamentos pix | função |  |  |  |  |  |
| [`payment_customers`](#payment_customers) | Pagamentos pix |  |  |  |  | função |  |
| [`payments`](#payments) | Pagamentos pix | função |  |  |  | função | sim |
| [`sos_arrivals`](#sos_arrivals) | Sos pre chegada | função |  |  |  |  |  |
| [`album_formatos`](#album_formatos) | Album pedido | função |  |  |  |  |  |
| [`album_orders`](#album_orders) | Album pedido | função |  |  |  | função | sim |

## Colunas de cada tabela

Tipo como no Postgres. **Obrigatória** = `not null`. **Referência** = chave estrangeira.

### Schema inicial

<a id="dewormings"></a>
#### `dewormings`

- **Usada por:** App do tutor, Site, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `aplicado_em` | date | sim |  |  |
| `produto` | text |  |  |  |
| `proxima_dose` | date |  |  |  |
| `observacao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `criado_por` | uuid |  | `auth.uid()` | `profiles` |

<a id="medication_doses"></a>
#### `medication_doses`

- **Usada por:** App do tutor, Site, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `medication_id` | uuid | sim |  | `medications` |
| `prevista_para` | timestamp with time zone | sim |  |  |
| `confirmada_em` | timestamp with time zone |  |  |  |
| `pulada` | boolean | sim | `false` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `origem` | text |  |  |  |
| `adiada_ate` | timestamp with time zone |  |  |  |
| `confirmada_por` | text |  |  |  |
| `confirmada_por_id` | uuid |  |  | `profiles` |

<a id="medications"></a>
#### `medications`

- **Usada por:** App do tutor, Site, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `nome` | text | sim |  |  |
| `dose` | text | sim |  |  |
| `frequencia` | text | sim |  |  |
| `horarios` | time without time zone[] | sim | `'{}'::time without time zone[]` |  |
| `inicio` | date | sim |  |  |
| `fim` | date |  |  |  |
| `ativo` | boolean | sim | `true` |  |
| `observacao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `pausado_memorial` | boolean | sim | `false` |  |
| `criado_por` | uuid |  | `auth.uid()` | `profiles` |

<a id="notification_prefs"></a>
#### `notification_prefs`

Preferências de aviso por tipo, com Não perturbe.

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `tipo` | text | sim |  |  |
| `ativo` | boolean | sim | `true` |  |
| `nao_perturbe_inicio` | time without time zone |  |  |  |
| `nao_perturbe_fim` | time without time zone |  |  |  |

<a id="pets"></a>
#### `pets`

Pets do tutor. Cada tutor só vê os seus.

- **Usada por:** App do tutor, Site, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `nome` | text | sim |  |  |
| `especie` | text | sim |  |  |
| `raca` | text |  |  |  |
| `nascimento` | date |  |  |  |
| `sexo` | text |  |  |  |
| `peso_atual` | numeric(5,2) |  |  |  |
| `castrado` | boolean |  |  |  |
| `foto_url` | text |  |  |  |
| `cor_etiqueta` | text |  |  |  |
| `ativo` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `alergias` | text |  |  |  |
| `veterinario` | text |  |  |  |
| `observacoes` | text |  |  |  |
| `em_memoria` | boolean | sim | `false` |  |

<a id="profiles"></a>
#### `profiles`

Perfil do tutor. Um registro por usuário do Auth.

- **Usada por:** App do tutor, Site, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim |  | `users` |
| `nome` | text | sim |  |  |
| `email` | text |  |  |  |
| `telefone` | text |  |  |  |
| `avatar_url` | text |  |  |  |
| `aceite_termos` | boolean | sim | `false` |  |
| `aceite_termos_em` | timestamp with time zone |  |  |  |
| `plano` | text | sim | `'gratis'::text` |  |
| `notificacoes_ativas` | boolean | sim | `true` |  |
| `fuso_horario` | text | sim | `'America/Sao_Paulo'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `role` | text | sim | `'tutor'::text` |  |
| `provider` | text | sim | `'email'::text` |  |
| `cidade` | text |  |  |  |
| `whatsapp` | boolean | sim | `true` |  |
| `contato_emergencia_nome` | text |  |  |  |
| `contato_emergencia_telefone` | text |  |  |  |

<a id="push_tokens"></a>
#### `push_tokens`

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `token` | text | sim |  |  |
| `plataforma` | text | sim |  |  |
| `ativo` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="reminders"></a>
#### `reminders`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `pet_id` | uuid |  |  | `pets` |
| `tipo` | text | sim |  |  |
| `titulo` | text | sim |  |  |
| `proxima_em` | timestamp with time zone | sim |  |  |
| `repetir` | text |  |  |  |
| `intervalo_dias` | integer |  |  |  |
| `ativo` | boolean | sim | `true` |  |
| `ultimo_aviso_em` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `aviso_antes` | boolean | sim | `true` |  |
| `origem` | text | sim | `'manual'::text` |  |
| `rotina_item` | text |  |  |  |
| `pausado_memorial` | boolean | sim | `false` |  |

<a id="vaccinations"></a>
#### `vaccinations`

Vacinas aplicadas, com a próxima dose agendada.

- **Usada por:** App do tutor, Site, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `nome` | text | sim |  |  |
| `aplicada_em` | date | sim |  |  |
| `proxima_dose` | date |  |  |  |
| `lote` | text |  |  |  |
| `local` | text |  |  |  |
| `observacao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `criado_por` | uuid |  | `auth.uid()` | `profiles` |

<a id="vaccine_schedule"></a>
#### `vaccine_schedule`

Calendário sugerido de vacinas por espécie e idade.

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `especie` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `primeira_dose_meses` | integer | sim |  |  |
| `reforco_meses` | integer |  |  |  |
| `descricao` | text |  |  |  |
| `ordem` | integer | sim | `0` |  |
| `obrigatoria` | boolean | sim | `false` |  |

<a id="visits"></a>
#### `visits`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `motivo` | text | sim |  |  |
| `realizada_em` | date | sim |  |  |
| `local` | text |  |  |  |
| `veterinario` | text |  |  |  |
| `diagnostico` | text |  |  |  |
| `valor` | numeric(10,2) |  |  |  |
| `observacao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `criado_por` | uuid |  | `auth.uid()` | `profiles` |
| `request_id` | uuid |  |  | `requests` |

<a id="weights"></a>
#### `weights`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020000001_schema_inicial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `peso` | numeric(5,2) | sim |  |  |
| `medido_em` | date | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `criado_por` | uuid |  | `auth.uid()` | `profiles` |

### Aceite termos lgpd

<a id="aceites_termos"></a>
#### `aceites_termos`

Registro de consentimento (LGPD): qual termo o usuário aceitou e quando.

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020160000_aceite_termos_lgpd.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `user_id` | uuid | sim |  | `profiles` |
| `termos_vigentes` | text | sim |  |  |
| `versao` | text | sim |  |  |
| `aceito_em` | timestamp with time zone | sim | `now()` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Tela avisos

<a id="notification_settings"></a>
#### `notification_settings`

Ajustes globais dos avisos: horário padrão e fuso do Não perturbe.

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261020180000_tela_avisos.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `profiles` |
| `horario_avisos` | time without time zone | sim | `'09:00:00'::time without time zone` |  |
| `fuso` | text | sim | `'America/Sao_Paulo'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Places mapa

<a id="places"></a>
#### `places`

Lugares pet de fontes abertas (OpenStreetMap e Overture Maps): serviços e pet friendly, para o mapa.

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261022000000_places_mapa.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `osm_type` | text |  |  |  |
| `osm_id` | bigint |  |  |  |
| `nome` | text | sim |  |  |
| `categoria` | text | sim |  |  |
| `endereco` | text |  |  |  |
| `telefone` | text |  |  |  |
| `horario` | text |  |  |  |
| `website` | text |  |  |  |
| `lat` | double precision | sim |  |  |
| `lng` | double precision | sim |  |  |
| `aberto_24h` | boolean | sim | `false` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `fonte` | text | sim | `'osm'::text` |  |
| `fonte_id` | text | sim |  |  |
| `aceita_caes` | boolean |  |  |  |
| `area_caes` | boolean | sim | `false` |  |
| `aceita_gatos` | boolean |  |  |  |

### Consentimentos lgpd

<a id="consentimentos"></a>
#### `consentimentos`

Log append-only de consentimentos (LGPD): o estado atual de cada tipo é a linha mais recente.

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261023000000_consentimentos_lgpd.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim | `auth.uid()` | `profiles` |
| `tipo` | text | sim |  |  |
| `versao` | text | sim |  |  |
| `aceito` | boolean | sim |  |  |
| `origem` | text | sim | `'app'::text` |  |
| `registrado_em` | timestamp with time zone | sim | `now()` |  |

### Lgpd pedidos com prazo

<a id="lgpd_requests"></a>
#### `lgpd_requests`

Pedidos de privacidade (LGPD): exportar, apagar, corrigir. Sobrevive à conta como registro.

- **Usada por:** App do tutor, Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261024030000_lgpd_pedidos_com_prazo.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim |  |  |
| `email` | text |  |  |  |
| `tipo` | text | sim |  |  |
| `status` | text | sim | `'novo'::text` |  |
| `due_at` | timestamp with time zone | sim | `(now() + '15 days'::interval)` |  |
| `executar_em` | timestamp with time zone |  |  |  |
| `done_at` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Content pack

<a id="content_packs"></a>
#### `content_packs`

Pacotes de conteúdo offline (emergência, tabelas das calculadoras), versionados.

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261024040000_content_pack.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tipo` | text | sim |  |  |
| `versao` | integer | sim |  |  |
| `conteudo` | jsonb | sim |  |  |
| `revisado_por` | text |  |  |  |
| `crmv` | text |  |  |  |
| `revisado_em` | timestamp with time zone |  |  |  |
| `publicado` | boolean | sim | `false` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Saved places

<a id="saved_places"></a>
#### `saved_places`

Lugares salvos pelo tutor (favoritos do mapa).

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261024050000_saved_places.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim | `auth.uid()` | `profiles` |
| `place_id` | uuid |  |  | `places` |
| `google_place_id` | text |  |  |  |
| `label` | text |  |  |  |
| `saved_at` | timestamp with time zone | sim | `now()` |  |

### Places usage

<a id="places_usage"></a>
#### `places_usage`

Chamadas ao Google Places por usuário e dia (limite diário e custo).

- **Usada por:** Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261025000000_places_usage.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `user_id` | uuid | sim |  | `profiles` |
| `day` | date | sim | `CURRENT_DATE` |  |
| `nearby_calls` | integer | sim | `0` |  |
| `detail_calls` | integer | sim | `0` |  |
| `photo_calls` | integer | sim | `0` |  |

### Site contatos

<a id="site_contacts"></a>
#### `site_contacts`

- **Usada por:** Site, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261026000000_site_contatos.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tipo` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `email` | text | sim |  |  |
| `telefone` | text |  |  |  |
| `mensagem` | text |  |  |  |
| `loja_nome` | text |  |  |  |
| `loja_tipo` | text |  |  |  |
| `cidade` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `status` | text | sim | `'aberto'::text` |  |
| `prioridade` | text | sim | `'normal'::text` |  |
| `atribuido_a` | uuid |  |  | `users` |
| `respondido_em` | timestamp with time zone |  |  |  |
| `fechado_em` | timestamp with time zone |  |  |  |

### Eventos uso

<a id="eventos_uso"></a>
#### `eventos_uso`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261028000000_eventos_uso.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `user_id` | uuid | sim | `auth.uid()` | `users` |
| `evento` | text | sim |  |  |
| `props` | jsonb | sim | `'{}'::jsonb` |  |
| `ocorreu_em` | timestamp with time zone | sim | `now()` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Sugestoes lugar

<a id="sugestoes_lugar"></a>
#### `sugestoes_lugar`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261029000000_sugestoes_lugar.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim | `auth.uid()` | `users` |
| `nome` | text | sim |  |  |
| `categoria` | text | sim |  |  |
| `aceita` | text | sim |  |  |
| `endereco` | text |  |  |  |
| `lat` | double precision | sim |  |  |
| `lng` | double precision | sim |  |  |
| `observacao` | text |  |  |  |
| `status` | text | sim | `'em_analise'::text` |  |
| `motivo_recusa` | text |  |  |  |
| `place_id` | uuid |  |  | `places` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `revisado_em` | timestamp with time zone |  |  |  |

### Caixa avisos

<a id="notification_log"></a>
#### `notification_log`

- **Usada por:** App do tutor, Site, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261030000000_caixa_avisos.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim |  | `users` |
| `pet_id` | uuid |  |  | `pets` |
| `type` | text | sim |  |  |
| `title` | text | sim |  |  |
| `body` | text |  |  |  |
| `deep_link` | text |  |  |  |
| `sent_at` | timestamp with time zone | sim | `now()` |  |
| `read_at` | timestamp with time zone |  |  |  |
| `campanha_id` | uuid |  |  | `campanhas` |

### Painel admin

<a id="admin_members"></a>
#### `admin_members`

- **Usada por:** App do tutor, Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031000000_painel_admin.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `user_id` | uuid | sim |  | `users` |
| `papel` | text | sim |  |  |
| `ativo` | boolean | sim | `true` |  |
| `convidado_por` | uuid |  |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `ultimo_acesso_em` | timestamp with time zone |  |  |  |

<a id="audit_log"></a>
#### `audit_log`

- **Usada por:** Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031000000_painel_admin.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `admin_id` | uuid |  |  | `users` |
| `acao` | text | sim |  |  |
| `alvo_tipo` | text |  |  |  |
| `alvo_id` | text |  |  |  |
| `detalhes` | jsonb | sim | `'{}'::jsonb` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Admin painel dependencias

<a id="campanhas"></a>
#### `campanhas`

- **Usada por:** Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `titulo` | text | sim |  |  |
| `mensagem` | text | sim |  |  |
| `publico` | text | sim |  |  |
| `link` | text |  |  |  |
| `status` | text | sim | `'rascunho'::text` |  |
| `agendada_para` | timestamp with time zone |  |  |  |
| `enviada_em` | timestamp with time zone |  |  |  |
| `destinatarios` | integer |  |  |  |
| `criada_por` | uuid |  |  | `users` |
| `criada_em` | timestamp with time zone | sim | `now()` |  |
| `revisao` | bigint | sim | `1` |  |

<a id="companhias_aereas"></a>
#### `companhias_aereas`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `nome` | text | sim |  |  |
| `regras` | text |  |  |  |
| `link` | text | sim |  |  |
| `revisado_em` | date |  |  |  |

<a id="conteudo_versoes"></a>
#### `conteudo_versoes`

- **Usada por:** Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `tipo` | text | sim |  |  |
| `versao` | integer | sim |  |  |
| `resumo` | text | sim |  |  |
| `conteudo` | jsonb | sim |  |  |
| `publicado_por` | uuid |  |  | `users` |
| `publicado_em` | timestamp with time zone | sim | `now()` |  |

<a id="datas_fogos"></a>
#### `datas_fogos`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `nome` | text | sim |  |  |
| `data` | date | sim |  |  |
| `regiao` | text |  |  |  |
| `dica` | text |  |  |  |
| `revisado_em` | date |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="site_contact_notas"></a>
#### `site_contact_notas`

- **Usada por:** Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `contato_id` | uuid | sim |  | `site_contacts` |
| `autor_id` | uuid |  |  | `users` |
| `tipo` | text | sim |  |  |
| `texto` | text | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="viagem_itens"></a>
#### `viagem_itens`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `modo` | text | sim |  |  |
| `titulo` | text | sim |  |  |
| `detalhe` | text |  |  |  |
| `automatico` | text |  |  |  |
| `ordem` | integer | sim | `0` |  |
| `ativo` | boolean | sim | `true` |  |
| `revisado_em` | date |  |  |  |

<a id="viagens"></a>
#### `viagens`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261031030000_admin_painel_dependencias.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim | `auth.uid()` | `profiles` |
| `pet_id` | uuid | sim |  | `pets` |
| `modo` | text | sim |  |  |
| `destino` | text |  |  |  |
| `data` | date |  |  |  |
| `companhia_id` | uuid |  |  | `companhias_aereas` |
| `marcados` | uuid[] | sim | `'{}'::uuid[]` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Carteirinha por link

<a id="carteirinha_links"></a>
#### `carteirinha_links`

Links temporários da carteirinha do pet (sem login).

- **Usada por:** App do tutor, Site, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261103000000_carteirinha_por_link.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `codigo` | text | sim |  |  |
| `pet_id` | uuid | sim |  | `pets` |
| `tutor_id` | uuid | sim |  | `profiles` |
| `secoes` | text[] | sim |  |  |
| `conteudo` | jsonb | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `expira_em` | timestamp with time zone | sim |  |  |
| `cancelado_em` | timestamp with time zone |  |  |  |
| `aberturas` | integer | sim | `0` |  |
| `ultima_abertura_em` | timestamp with time zone |  |  |  |
| `tipo` | text | sim | `'carteirinha'::text` |  |
| `lugar_id` | text |  |  |  |
| `canal` | text |  |  |  |
| `avisado_em` | timestamp with time zone |  |  |  |

### Admin sistema

<a id="app_config"></a>
#### `app_config`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261104000000_admin_sistema.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `chave` | text | sim |  |  |
| `valor` | jsonb | sim |  |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_por` | uuid |  |  | `users` |

<a id="recursos"></a>
#### `recursos`

- **Usada por:** App do tutor, Site, Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261104000000_admin_sistema.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `chave` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `descricao` | text | sim |  |  |
| `ligado` | boolean | sim | `true` |  |
| `ordem` | integer | sim | `0` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_por` | uuid |  |  | `users` |

### Ficha emergencia

<a id="carteirinha_acessos"></a>
#### `carteirinha_acessos`

- **Usada por:** nenhum app hoje
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261106000000_ficha_emergencia.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `ip_hash` | text | sim |  |  |
| `link_id` | uuid |  |  | `carteirinha_links` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Cuidador temporario

<a id="cuidador_acessos"></a>
#### `cuidador_acessos`

- **Usada por:** App do tutor, Site, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261107000000_cuidador_temporario.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `codigo` | text | sim |  |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `pet_ids` | uuid[] | sim |  |  |
| `cuidador` | text | sim |  |  |
| `inicio` | timestamp with time zone | sim | `now()` |  |
| `fim` | timestamp with time zone | sim |  |  |
| `ver_vacinas` | boolean | sim | `true` |  |
| `ver_remedios` | boolean | sim | `true` |  |
| `ver_contatos` | boolean | sim | `true` |  |
| `revogado_em` | timestamp with time zone |  |  |  |
| `aviso_expira_em` | timestamp with time zone |  |  |  |
| `aberturas` | integer | sim | `0` |  |
| `ultima_abertura_em` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="cuidador_registros"></a>
#### `cuidador_registros`

- **Usada por:** App do tutor, Site
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261107000000_cuidador_temporario.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `acesso_id` | uuid | sim |  | `cuidador_acessos` |
| `acao` | text | sim |  |  |
| `detalhe` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Despesas

<a id="despesas"></a>
#### `despesas`

Gastos do tutor com os pets (só registro).

- **Usada por:** App do tutor, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261108000000_despesas.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim | `auth.uid()` | `profiles` |
| `pet_id` | uuid |  |  | `pets` |
| `categoria` | text | sim |  |  |
| `valor_centavos` | integer | sim |  |  |
| `data` | date | sim | `CURRENT_DATE` |  |
| `anotacao` | text |  |  |  |
| `recibo_path` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Linha do tempo

<a id="marcos"></a>
#### `marcos`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261109000000_linha_do_tempo.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `tutor_id` | uuid | sim | `auth.uid()` | `profiles` |
| `data` | date | sim |  |  |
| `titulo` | text | sim |  |  |
| `descricao` | text |  |  |  |
| `foto_path` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Modo memorial

<a id="memorial"></a>
#### `memorial`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261110000000_modo_memorial.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pet_id` | uuid | sim |  | `pets` |
| `data_partida` | date | sim |  |  |
| `mensagem` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `reativado_em` | timestamp with time zone |  |  |  |

### Pet senior

<a id="idade_senior"></a>
#### `idade_senior`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261111000000_pet_senior.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `especie` | text | sim |  |  |
| `peso_min` | numeric | sim | `0` |  |
| `peso_max` | numeric |  |  |  |
| `anos` | integer | sim |  |  |
| `descricao` | text | sim |  |  |
| `revisado_por` | text |  |  |  |
| `revisado_em` | date |  |  |  |

<a id="qualidade_vida"></a>
#### `qualidade_vida`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261111000000_pet_senior.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `tutor_id` | uuid | sim | `auth.uid()` | `profiles` |
| `data` | date | sim | `CURRENT_DATE` |  |
| `notas` | jsonb | sim |  |  |
| `total` | integer | sim |  |  |
| `observacao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="senior"></a>
#### `senior`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261111000000_pet_senior.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pet_id` | uuid | sim |  | `pets` |
| `desde` | date | sim |  |  |
| `avisado_em` | timestamp with time zone | sim | `now()` |  |

### Admin financeiro

<a id="receitas"></a>
#### `receitas`

- **Usada por:** Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261112000000_admin_financeiro.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `origem` | text | sim |  |  |
| `valor_centavos` | integer | sim |  |  |
| `status` | text | sim | `'pago'::text` |  |
| `pago_em` | timestamp with time zone | sim | `now()` |  |
| `tutor_id` | uuid |  |  | `profiles` |
| `provedor` | text |  |  |  |
| `referencia` | text |  |  |  |
| `descricao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Fogos e trovao

<a id="fogos_avisos"></a>
#### `fogos_avisos`

- **Usada por:** cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261113000000_fogos_e_trovao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `profiles` |
| `data_id` | uuid | sim |  | `datas_fogos` |
| `tipo` | text | sim |  |  |
| `enviado_em` | timestamp with time zone | sim | `now()` |  |

<a id="fogos_prefs"></a>
#### `fogos_prefs`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261113000000_fogos_e_trovao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `profiles` |
| `avisar` | boolean | sim | `true` |  |
| `lembrar_em_casa` | boolean | sim | `true` |  |
| `checklist` | text[] | sim | `'{}'::text[]` |  |
| `modo_calmo_em` | date |  |  |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Selos de cuidado

<a id="pet_selos"></a>
#### `pet_selos`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261115000000_selos_de_cuidado.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pet_id` | uuid | sim |  | `pets` |
| `selo` | text | sim |  |  |
| `desde` | timestamp with time zone | sim | `now()` |  |

### Documentos saude

<a id="documentos_saude"></a>
#### `documentos_saude`

Fotos privadas do cartão de vacina e exames do pet.

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261120000000_documentos_saude.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `tutor_id` | uuid | sim | `auth.uid()` | `profiles` |
| `tipo` | text | sim |  |  |
| `titulo` | text | sim |  |  |
| `realizado_em` | date | sim | `CURRENT_DATE` |  |
| `arquivo_path` | text | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Acesso familia

<a id="pet_members"></a>
#### `pet_members`

- **Usada por:** App do tutor, Site, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261121000000_acesso_familia.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pet_id` | uuid | sim |  | `pets` |
| `user_id` | uuid | sim |  | `profiles` |
| `role` | text | sim | `'guardian'::text` |  |
| `criado_por` | uuid | sim | `auth.uid()` | `profiles` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `aceito_em` | timestamp with time zone | sim | `now()` |  |

### Eventos pet

<a id="event_moderation_actions"></a>
#### `event_moderation_actions`

- **Usada por:** Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261122000000_eventos_pet.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `event_id` | uuid | sim |  | `events` |
| `admin_id` | uuid | sim |  | `users` |
| `acao` | text | sim |  |  |
| `motivo` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="event_reminder_deliveries"></a>
#### `event_reminder_deliveries`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261122000000_eventos_pet.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `event_id` | uuid | sim |  | `events` |
| `user_id` | uuid | sim |  | `users` |
| `intervalo` | text | sim |  |  |
| `enviado_em` | timestamp with time zone | sim | `now()` |  |

<a id="event_reports"></a>
#### `event_reports`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261122000000_eventos_pet.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `event_id` | uuid | sim |  | `events` |
| `user_id` | uuid | sim |  | `users` |
| `motivo` | text | sim |  |  |
| `detalhe` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="event_rsvps"></a>
#### `event_rsvps`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261122000000_eventos_pet.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `event_id` | uuid | sim |  | `events` |
| `user_id` | uuid | sim |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="events"></a>
#### `events`

- **Usada por:** App do tutor, Painel admin, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261122000000_eventos_pet.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `organizador_id` | uuid |  |  | `users` |
| `oficial` | boolean | sim | `false` |  |
| `titulo` | text | sim |  |  |
| `tipo` | text | sim |  |  |
| `descricao` | text | sim |  |  |
| `inicio_em` | timestamp with time zone | sim |  |  |
| `fim_em` | timestamp with time zone | sim |  |  |
| `local_nome` | text | sim |  |  |
| `place_id` | text |  |  |  |
| `lat` | double precision |  |  |  |
| `lng` | double precision |  |  |  |
| `foto_url` | text |  |  |  |
| `gratuito` | boolean | sim | `true` |  |
| `preco_centavos` | integer |  |  |  |
| `ingresso_url` | text |  |  |  |
| `vagas` | integer |  |  |  |
| `status` | text | sim | `'em_analise'::text` |  |
| `motivo_status` | text |  |  |  |
| `criado_por` | uuid |  |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

<a id="organizers"></a>
#### `organizers`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261122000000_eventos_pet.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `user_id` | uuid | sim |  | `users` |
| `nome_publico` | text | sim |  |  |
| `verificado` | boolean | sim | `false` |  |
| `verificado_em` | timestamp with time zone |  |  |  |
| `verificado_por` | uuid |  |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `verificacao_versao` | integer | sim | `1` |  |

### Qr coleira

<a id="pet_qr_settings"></a>
#### `pet_qr_settings`

- **Usada por:** App do tutor, Site
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261130000000_qr_coleira.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pet_id` | uuid | sim |  | `pets` |
| `code` | text | sim | `encode(extensions.gen_random_bytes(24), 'hex'::text)` |  |
| `show_photo` | boolean | sim | `false` |  |
| `show_phone` | boolean | sim | `false` |  |
| `show_allergies` | boolean | sim | `false` |  |
| `active` | boolean | sim | `true` |  |

<a id="qr_limites"></a>
#### `qr_limites`

- **Usada por:** Site
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261130000000_qr_coleira.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `chave` | text | sim |  |  |
| `janela` | timestamp with time zone | sim |  |  |
| `total` | integer | sim |  |  |

### Passeios tutor

<a id="passeios_tutor"></a>
#### `passeios_tutor`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261203000000_passeios_tutor.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `users` |
| `id` | uuid | sim |  |  |
| `pet_id` | uuid |  |  | `pets` |
| `dados` | jsonb | sim |  |  |
| `versao` | integer | sim | `1` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Eventos por regiao

<a id="eventos_avisos_proximos"></a>
#### `eventos_avisos_proximos`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261204000000_eventos_por_regiao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `users` |
| `evento_id` | uuid | sim |  | `events` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="eventos_regioes"></a>
#### `eventos_regioes`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261204000000_eventos_por_regiao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `users` |
| `ativo` | boolean | sim | `false` |  |
| `raio_km` | integer | sim | `10` |  |
| `lat` | numeric(5,2) |  |  |  |
| `lng` | numeric(5,2) |  |  |  |
| `atualizado_em` | timestamp with time zone |  |  |  |
| `expira_em` | timestamp with time zone |  |  |  |

### Exportar despesas

<a id="despesas_resumo_preferencias"></a>
#### `despesas_resumo_preferencias`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261205000000_exportar_despesas.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `profiles` |
| `ativo` | boolean | sim | `false` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

<a id="despesas_resumos_enviados"></a>
#### `despesas_resumos_enviados`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261205000000_exportar_despesas.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `profiles` |
| `mes` | date | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Catalogo adocao

<a id="adocao_contatos"></a>
#### `adocao_contatos`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261206000000_catalogo_adocao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `pet_id` | uuid | sim |  | `adocao_pets` |
| `mensagem` | text | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `email_resposta` | text |  |  |  |

<a id="adocao_favoritos"></a>
#### `adocao_favoritos`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261206000000_catalogo_adocao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `tutor_id` | uuid | sim |  | `profiles` |
| `pet_id` | uuid | sim |  | `adocao_pets` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="adocao_ongs"></a>
#### `adocao_ongs`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261206000000_catalogo_adocao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `responsavel_id` | uuid | sim |  | `profiles` |
| `nome` | text | sim |  |  |
| `cidade` | text | sim |  |  |
| `bairro` | text | sim |  |  |
| `status` | text | sim | `'pendente'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `revisao` | integer | sim | `1` |  |
| `motivo_decisao` | text |  |  |  |

<a id="adocao_pets"></a>
#### `adocao_pets`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261206000000_catalogo_adocao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `ong_id` | uuid | sim |  | `adocao_ongs` |
| `nome` | text | sim |  |  |
| `especie` | text | sim |  |  |
| `nascimento` | date |  |  |  |
| `porte` | text | sim |  |  |
| `sexo` | text | sim |  |  |
| `castrado` | boolean |  |  |  |
| `vacinado` | boolean |  |  |  |
| `vermifugado` | boolean |  |  |  |
| `descricao` | text | sim |  |  |
| `fotos` | text[] | sim | `'{}'::text[]` |  |
| `status` | text | sim | `'rascunho'::text` |  |
| `confirmado_em` | timestamp with time zone | sim | `now()` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `versao` | integer | sim | `1` |  |
| `moderacao_motivo` | text |  |  |  |
| `moderacao_em` | timestamp with time zone |  |  |  |

### Destaques pagos lugares

<a id="lugares_destaques_pagos"></a>
#### `lugares_destaques_pagos`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261213000000_destaques_pagos_lugares.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `lugar_id` | text | sim |  |  |
| `pagamento_ref` | text | sim |  |  |
| `pagamento_confirmado_em` | timestamp with time zone | sim |  |  |
| `inicio_em` | timestamp with time zone | sim |  |  |
| `fim_em` | timestamp with time zone | sim |  |  |
| `status` | text | sim | `'ativo'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Cadastro ong documentos

<a id="ong_cadastros"></a>
#### `ong_cadastros`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261214000000_cadastro_ong_documentos.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim |  |  |
| `responsavel_id` | uuid | sim |  | `profiles` |
| `cnpj` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `cidade` | text | sim |  |  |
| `bairro` | text | sim |  |  |
| `responsavel_nome` | text | sim |  |  |
| `email` | text | sim |  |  |
| `telefone` | text | sim |  |  |
| `documentos` | jsonb | sim | `'{}'::jsonb` |  |
| `status` | text | sim | `'rascunho'::text` |  |
| `enviado_em` | timestamp with time zone |  |  |  |
| `versao` | integer | sim | `1` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `correcao_motivo` | text |  |  |  |

### Reconciliar carteirinha

<a id="carteirinha_limites"></a>
#### `carteirinha_limites`

- **Usada por:** Site, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261218000000_reconciliar_carteirinha.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `ip_hash` | text | sim |  |  |
| `janela` | timestamp with time zone | sim |  |  |
| `total` | integer | sim |  |  |

### Historico envios fichas

<a id="carteirinha_envios"></a>
#### `carteirinha_envios`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261220000000_historico_envios_fichas.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `link_id` | uuid | sim |  | `carteirinha_links` |
| `tutor_id` | uuid | sim |  | `profiles` |
| `tipo` | text | sim |  |  |
| `acao` | text | sim |  |  |
| `lugar_id` | uuid |  |  | `places` |
| `canal` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Push abertura ficha

<a id="ficha_push_fila"></a>
#### `ficha_push_fila`

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261221000000_push_abertura_ficha.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `aviso_id` | uuid | sim |  | `notification_log` |
| `link_id` | uuid | sim |  | `carteirinha_links` |
| `tutor_id` | uuid | sim |  | `profiles` |
| `push_token_id` | uuid | sim |  | `push_tokens` |
| `token_hash` | text | sim |  |  |
| `estado` | text | sim | `'pendente'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `disponivel_em` | timestamp with time zone | sim | `now()` |  |
| `requisicao_id` | bigint |  |  |  |
| `requisitado_em` | timestamp with time zone |  |  |  |
| `ticket_id` | text |  |  |  |
| `envios` | integer | sim | `0` |  |
| `consultas` | integer | sim | `0` |  |
| `motivo` | text |  |  |  |

### Guarda compartilhada

<a id="pet_activity"></a>
#### `pet_activity`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261224000000_guarda_compartilhada.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `autor_id` | uuid |  |  | `profiles` |
| `tipo` | text | sim |  |  |
| `ref_id` | uuid |  |  |  |
| `resumo` | text | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="pet_invites"></a>
#### `pet_invites`

- **Usada por:** App do tutor, Site
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261224000000_guarda_compartilhada.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `titular_id` | uuid | sim |  | `profiles` |
| `email` | text | sim |  |  |
| `pet_ids` | uuid[] | sim |  |  |
| `token_hash` | text | sim |  |  |
| `status` | text | sim | `'enviado'::text` |  |
| `convidado_id` | uuid |  |  | `profiles` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `expira_em` | timestamp with time zone | sim | `(now() + '7 days'::interval)` |  |
| `respondido_em` | timestamp with time zone |  |  |  |

### Limites plano desativados

<a id="plano_limites_config"></a>
#### `plano_limites_config`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261226000000_limites_plano_desativados.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | boolean | sim | `true` |  |
| `ativo` | boolean | sim | `false` |  |
| `pets_gratis` | integer | sim | `1` |  |

### Consulta assinatura

<a id="subscriptions"></a>
#### `subscriptions`

- **Usada por:** App do tutor, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20261228000000_consulta_assinatura.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `provedor` | text | sim |  |  |
| `referencia_provedor` | text | sim |  |  |
| `ciclo` | text | sim |  |  |
| `status` | text | sim |  |  |
| `periodo_inicio` | timestamp with time zone | sim |  |  |
| `periodo_fim` | timestamp with time zone | sim |  |  |
| `forma_pagamento` | text |  |  |  |
| `valor_centavos` | integer |  |  |  |
| `moeda` | text | sim | `'BRL'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `cancelamento_pedido_em` | timestamp with time zone |  |  |  |
| `cancelamento_motivo` | text |  |  |  |
| `cancelar_no_provedor` | boolean | sim | `false` |  |

### Planos cupons rascunho

<a id="premium_cupons_rascunho"></a>
#### `premium_cupons_rascunho`

- **Usada por:** Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270103000000_planos_cupons_rascunho.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim |  |  |
| `codigo` | text | sim |  |  |
| `tipo` | text | sim |  |  |
| `valor` | integer | sim |  |  |
| `inicio` | timestamp with time zone | sim |  |  |
| `fim` | timestamp with time zone | sim |  |  |
| `limite_usos` | integer | sim |  |  |
| `minimo_centavos` | integer | sim | `0` |  |
| `arquivado` | boolean | sim | `false` |  |
| `versao` | integer | sim | `1` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

<a id="premium_planos_rascunho"></a>
#### `premium_planos_rascunho`

- **Usada por:** Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270103000000_planos_cupons_rascunho.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `ciclo` | text | sim |  |  |
| `preco_centavos` | integer |  |  |  |
| `dias_teste` | integer | sim | `7` |  |
| `versao` | integer | sim | `1` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Catalogo racas

<a id="catalogo_racas"></a>
#### `catalogo_racas`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270105000000_catalogo_racas.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `especie` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `ativo` | boolean | sim | `true` |  |
| `versao` | integer | sim | `1` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Catalogo categorias mapa

<a id="catalogo_categorias_mapa"></a>
#### `catalogo_categorias_mapa`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270106000000_catalogo_categorias_mapa.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `codigo` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `plural` | text | sim |  |  |
| `versao` | integer | sim | `1` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Admin eventos organizadores

<a id="admin_eventos_pedidos"></a>
#### `admin_eventos_pedidos`

- **Usada por:** Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270107000000_admin_eventos_organizadores.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `chave` | uuid | sim |  |  |
| `admin_id` | uuid | sim |  | `users` |
| `evento_id` | uuid | sim |  | `events` |
| `parametros` | jsonb | sim |  |  |

### Leitura cartao vacina

<a id="cartao_leituras"></a>
#### `cartao_leituras`

- **Usada por:** Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108120000_leitura_cartao_vacina.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tutor_id` | uuid | sim |  | `profiles` |
| `pet_id` | uuid |  |  | `pets` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `status` | text | sim | `'iniciada'::text` |  |
| `vacinas_lidas` | integer |  |  |  |

### Qr localizacao achado

<a id="qr_localizacoes"></a>
#### `qr_localizacoes`

- **Usada por:** App do tutor, Site
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108130000_qr_localizacao_achado.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `lat` | double precision | sim |  |  |
| `lng` | double precision | sim |  |  |
| `precisao_m` | integer |  |  |  |
| `mensagem` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Pet perdido

<a id="lost_alert_receipts"></a>
#### `lost_alert_receipts`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108140000_pet_perdido.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `alert_id` | uuid | sim |  | `lost_alerts` |
| `user_id` | uuid | sim |  | `profiles` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="lost_alert_sightings"></a>
#### `lost_alert_sightings`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108140000_pet_perdido.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `alert_id` | uuid | sim |  | `lost_alerts` |
| `autor_id` | uuid |  |  | `profiles` |
| `lat` | double precision | sim |  |  |
| `lng` | double precision | sim |  |  |
| `visto_em` | timestamp with time zone | sim | `now()` |  |
| `mensagem` | text |  |  |  |
| `foto_path` | text |  |  |  |
| `com_a_pessoa` | boolean | sim | `false` |  |
| `origem` | text | sim | `'app'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="lost_alerts"></a>
#### `lost_alerts`

- **Usada por:** App do tutor, Site, Painel admin, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108140000_pet_perdido.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `tutor_id` | uuid | sim |  | `profiles` |
| `lat` | double precision | sim |  |  |
| `lng` | double precision | sim |  |  |
| `raio_km` | integer | sim | `2` |  |
| `visto_em` | timestamp with time zone | sim |  |  |
| `mensagem` | text |  |  |  |
| `mostrar_telefone` | boolean | sim | `false` |  |
| `status` | text | sim | `'ativo'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `expira_em` | timestamp with time zone | sim | `(now() + '7 days'::interval)` |  |
| `encerrado_em` | timestamp with time zone |  |  |  |
| `reconhecimento` | boolean | sim | `false` |  |

<a id="perdidos_regioes"></a>
#### `perdidos_regioes`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108140000_pet_perdido.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `user_id` | uuid | sim |  | `profiles` |
| `lat` | numeric(5,2) | sim |  |  |
| `lng` | numeric(5,2) | sim |  |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `expira_em` | timestamp with time zone | sim | `(now() + '7 days'::interval)` |  |

### Parceiros seguro

<a id="insurance_clicks"></a>
#### `insurance_clicks`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108150000_parceiros_seguro.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `partner_id` | uuid | sim |  | `insurance_partners` |
| `user_id` | uuid |  |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="insurance_partners"></a>
#### `insurance_partners`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108150000_parceiros_seguro.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `nome` | text | sim |  |  |
| `tipo` | text | sim | `'plano'::text` |  |
| `beneficios` | text | sim |  |  |
| `preco_texto` | text |  |  |  |
| `url` | text | sim |  |  |
| `logo_url` | text |  |  |  |
| `ordem` | integer | sim | `100` |  |
| `ativo` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Achei pet foto

<a id="achei_buscas"></a>
#### `achei_buscas`

- **Usada por:** Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108160000_achei_pet_foto.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim |  | `users` |
| `lat` | numeric(6,3) | sim |  |  |
| `lng` | numeric(6,3) | sim |  |  |
| `status` | text | sim | `'reservada'::text` |  |
| `candidatos` | jsonb |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Conteudo luto senior escala

<a id="escala_itens"></a>
#### `escala_itens`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108200000_conteudo_luto_senior_escala.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `chave` | text | sim |  |  |
| `rotulo` | text | sim |  |  |
| `pergunta` | text | sim |  |  |
| `ordem` | integer | sim |  |  |
| `revisado_por` | text |  |  |  |
| `revisado_em` | date |  |  |  |

<a id="luto_recursos"></a>
#### `luto_recursos`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108200000_conteudo_luto_senior_escala.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `tipo` | text | sim |  |  |
| `titulo` | text | sim |  |  |
| `texto` | text | sim |  |  |
| `link` | text |  |  |  |
| `ordem` | integer | sim | `100` |  |
| `ativo` | boolean | sim | `true` |  |
| `revisado_por` | text |  |  |  |
| `revisado_em` | date |  |  |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Comunidade

<a id="comments"></a>
#### `comments`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108210000_comunidade.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `post_id` | uuid | sim |  | `posts` |
| `autor_id` | uuid | sim |  | `users` |
| `texto` | text | sim |  |  |
| `status` | text | sim | `'publicado'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="comunidade_denuncias"></a>
#### `comunidade_denuncias`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108210000_comunidade.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `alvo_tipo` | text | sim |  |  |
| `alvo_id` | uuid | sim |  |  |
| `autor_id` | uuid | sim |  | `users` |
| `motivo` | text | sim |  |  |
| `status` | text | sim | `'aberta'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="follows"></a>
#### `follows`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108210000_comunidade.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `seguidor_id` | uuid | sim |  | `users` |
| `pet_id` | uuid | sim |  | `pets` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="likes"></a>
#### `likes`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108210000_comunidade.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `post_id` | uuid | sim |  | `posts` |
| `user_id` | uuid | sim |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="pet_public_profiles"></a>
#### `pet_public_profiles`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108210000_comunidade.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pet_id` | uuid | sim |  | `pets` |
| `ativo` | boolean | sim | `false` |  |
| `bio` | text |  |  |  |
| `mostrar_cidade` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

<a id="posts"></a>
#### `posts`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108210000_comunidade.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `pet_id` | uuid | sim |  | `pets` |
| `autor_id` | uuid | sim |  | `users` |
| `foto_path` | text | sim |  |  |
| `legenda` | text |  |  |  |
| `status` | text | sim | `'publicado'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Avaliacoes apps

<a id="app_reviews"></a>
#### `app_reviews`

- **Usada por:** Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108220000_avaliacoes_apps.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `platform` | text | sim |  |  |
| `external_id` | text | sim |  |  |
| `rating` | integer | sim |  |  |
| `author` | text |  |  |  |
| `title` | text |  |  |  |
| `text` | text |  |  |  |
| `app_version` | text |  |  |  |
| `at` | timestamp with time zone | sim |  |  |
| `reply_text` | text |  |  |  |
| `replied_at` | timestamp with time zone |  |  |  |
| `reply_status` | text |  |  |  |
| `reply_erro` | text |  |  |  |
| `respondida_por` | uuid |  |  | `users` |
| `importada_em` | timestamp with time zone | sim | `now()` |  |

<a id="app_reviews_sync"></a>
#### `app_reviews_sync`

- **Usada por:** Painel admin, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270108220000_avaliacoes_apps.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `platform` | text | sim |  |  |
| `ultima_execucao` | timestamp with time zone |  |  |  |
| `ok` | boolean |  |  |  |
| `mensagem` | text |  |  |  |

### Lgpd worker seguro

<a id="lgpd_exclusoes"></a>
#### `lgpd_exclusoes`

- **Usada por:** App do tutor, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270109000000_lgpd_worker_seguro.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `pedido_id` | uuid | sim |  |  |
| `user_id` | uuid |  |  |  |
| `titular_hash` | text | sim |  |  |
| `status` | text | sim |  |  |
| `executar_em` | timestamp with time zone | sim |  |  |
| `lease` | uuid |  |  |  |
| `lease_ate` | timestamp with time zone |  |  |  |
| `tentativas` | integer | sim | `0` |  |
| `ultimo_erro` | text |  |  |  |
| `concluida_em` | timestamp with time zone |  |  |  |

<a id="lgpd_worker_config"></a>
#### `lgpd_worker_config`

- **Usada por:** App do tutor, Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270109000000_lgpd_worker_seguro.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | boolean | sim | `true` |  |
| `ativo` | boolean | sim | `false` |  |
| `ultima_execucao` | timestamp with time zone |  |  |  |

### Marketplace base

<a id="addresses"></a>
#### `addresses`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim | `auth.uid()` | `users` |
| `label` | text |  |  |  |
| `street` | text | sim |  |  |
| `number` | text |  |  |  |
| `complement` | text |  |  |  |
| `neighborhood` | text |  |  |  |
| `city` | text |  |  |  |
| `lat` | double precision |  |  |  |
| `lng` | double precision |  |  |  |
| `note` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `cep` | text |  |  |  |

<a id="products"></a>
#### `products`

- **Usada por:** App do tutor, Painel admin, Painel do lojista, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `store_id` | uuid | sim |  | `stores` |
| `name` | text | sim |  |  |
| `categoria` | text | sim | `'outros'::text` |  |
| `description` | text |  |  |  |
| `price_cents` | integer | sim |  |  |
| `photo_url` | text |  |  |  |
| `barcode` | text |  |  |  |
| `venda` | text | sim | `'app'::text` |  |
| `receita_msg` | text |  |  |  |
| `mostrar_preco` | boolean | sim | `true` |  |
| `mostrar_estoque` | boolean | sim | `false` |  |
| `mensagem_tutor` | text |  |  |  |
| `stock` | integer | sim | `0` |  |
| `stock_min` | integer | sim | `0` |  |
| `hide_when_zero` | boolean | sim | `true` |  |
| `active` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `bloqueado_admin` | boolean | sim | `false` |  |

<a id="request_events"></a>
#### `request_events`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `request_id` | uuid | sim |  | `requests` |
| `from_status` | text |  |  |  |
| `to_status` | text | sim |  |  |
| `actor_id` | uuid |  |  | `users` |
| `reason` | text |  |  |  |
| `at` | timestamp with time zone | sim | `now()` |  |

<a id="request_items"></a>
#### `request_items`

- **Usada por:** App do tutor, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `request_id` | uuid | sim |  | `requests` |
| `product_id` | uuid |  |  | `products` |
| `service_id` | uuid |  |  | `services` |
| `nome` | text | sim |  |  |
| `qty` | integer | sim |  |  |
| `unit_cents` | integer | sim |  |  |

<a id="requests"></a>
#### `requests`

- **Usada por:** App do tutor, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `numero` | bigint | sim |  |  |
| `user_id` | uuid | sim |  | `users` |
| `store_id` | uuid | sim |  | `stores` |
| `kind` | text | sim | `'produto'::text` |  |
| `status` | text | sim | `'enviada'::text` |  |
| `fulfillment` | text |  |  |  |
| `starts_at` | timestamp with time zone |  |  |  |
| `ends_at` | timestamp with time zone |  |  |  |
| `pet_id` | uuid |  |  | `pets` |
| `subtotal_cents` | integer | sim | `0` |  |
| `delivery_fee_cents` | integer | sim | `0` |  |
| `discount_cents` | integer | sim | `0` |  |
| `total_cents` | integer | sim | `0` |  |
| `pay_method` | text | sim | `'na_loja'::text` |  |
| `message` | text |  |  |  |
| `address_id` | uuid |  |  | `addresses` |
| `endereco_texto` | text |  |  |  |
| `codigo_entrega` | text |  |  |  |
| `motivo` | text |  |  |  |
| `expira_em` | timestamp with time zone |  |  |  |
| `estoque_baixado` | boolean | sim | `false` |  |
| `responded_at` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `service_id` | uuid |  |  | `services` |
| `vagas` | integer | sim | `1` |  |
| `ocupado_ate` | timestamp with time zone |  |  |  |
| `lembrete_enviado` | boolean | sim | `false` |  |
| `extras` | jsonb |  |  |  |
| `coupon_id` | uuid |  |  | `coupons` |

<a id="services"></a>
#### `services`

- **Usada por:** App do tutor, Painel admin, Painel do lojista, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `store_id` | uuid | sim |  | `stores` |
| `name` | text | sim |  |  |
| `description` | text |  |  |  |
| `modelo` | text | sim | `'horario'::text` |  |
| `duration_min` | integer |  |  |  |
| `capacity` | integer | sim | `1` |  |
| `buffer_min` | integer | sim | `0` |  |
| `price_cents` | integer |  |  |  |
| `active` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `requires_vaccines` | boolean | sim | `false` |  |
| `entrada_ate` | time without time zone |  |  |  |
| `retirada_desde` | time without time zone |  |  |  |
| `tipo_clinico` | text |  |  |  |

<a id="store_hours"></a>
#### `store_hours`

- **Usada por:** App do tutor, Painel do lojista
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `store_id` | uuid | sim |  | `stores` |
| `weekday` | integer | sim |  |  |
| `opens` | time without time zone | sim |  |  |
| `closes` | time without time zone | sim |  |  |

<a id="store_members"></a>
#### `store_members`

- **Usada por:** App do tutor, Painel admin, Painel do lojista, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `store_id` | uuid | sim |  | `stores` |
| `user_id` | uuid | sim |  | `users` |
| `role` | text | sim | `'staff'::text` |  |
| `funcao` | text |  |  |  |
| `active` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="stores"></a>
#### `stores`

- **Usada por:** App do tutor, Painel admin, Painel do lojista, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `name` | text | sim |  |  |
| `kind` | text | sim | `'petshop'::text` |  |
| `oferece` | text | sim | `'ambos'::text` |  |
| `status` | text | sim | `'rascunho'::text` |  |
| `is_open` | boolean | sim | `true` |  |
| `place_id` | uuid |  |  | `places` |
| `address` | text |  |  |  |
| `neighborhood` | text |  |  |  |
| `city` | text |  |  |  |
| `lat` | double precision |  |  |  |
| `lng` | double precision |  |  |  |
| `phone` | text |  |  |  |
| `photo_url` | text |  |  |  |
| `response_deadline_min` | integer | sim | `60` |  |
| `auto_confirm` | boolean | sim | `false` |  |
| `cancel_until_min` | integer | sim | `120` |  |
| `pickup_enabled` | boolean | sim | `true` |  |
| `pickup_prepare_min` | integer | sim | `60` |  |
| `delivery_enabled` | boolean | sim | `false` |  |
| `delivery_mode` | text | sim | `'fixa'::text` |  |
| `delivery_fee_cents` | integer | sim | `0` |  |
| `delivery_radius_km` | numeric(5,1) | sim | `5` |  |
| `delivery_min_order_cents` | integer | sim | `0` |  |
| `delivery_free_over_cents` | integer |  |  |  |
| `delivery_eta_min` | integer | sim | `30` |  |
| `delivery_eta_max` | integer | sim | `90` |  |
| `rating_avg` | numeric(2,1) |  |  |  |
| `rating_count` | integer | sim | `0` |  |
| `criado_por` | uuid |  |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `documento` | text |  |  |  |
| `responsavel` | text |  |  |  |
| `motivo_status` | text |  |  |  |
| `enviada_em` | timestamp with time zone |  |  |  |
| `decidida_em` | timestamp with time zone |  |  |  |
| `emergencia_24h` | boolean | sim | `false` |  |

<a id="time_off"></a>
#### `time_off`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110000000_marketplace_base.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `store_id` | uuid | sim |  | `stores` |
| `starts_at` | timestamp with time zone | sim |  |  |
| `ends_at` | timestamp with time zone | sim |  |  |
| `reason` | text |  |  |  |

### Chat loja

<a id="conversations"></a>
#### `conversations`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110010000_chat_loja.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `request_id` | uuid | sim |  | `requests` |
| `store_id` | uuid | sim |  | `stores` |
| `user_id` | uuid | sim |  | `users` |
| `closed_at` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="messages"></a>
#### `messages`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110010000_chat_loja.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `conversation_id` | uuid | sim |  | `conversations` |
| `sender_id` | uuid | sim |  | `users` |
| `da_loja` | boolean | sim |  |  |
| `body` | text | sim |  |  |
| `read_at` | timestamp with time zone |  |  |  |
| `at` | timestamp with time zone | sim | `now()` |  |

### Avaliacoes lojas estoque

<a id="reviews"></a>
#### `reviews`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110020000_avaliacoes_lojas_estoque.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `request_id` | uuid | sim |  | `requests` |
| `store_id` | uuid | sim |  | `stores` |
| `user_id` | uuid | sim |  | `users` |
| `rating` | integer | sim |  |  |
| `tags` | text[] | sim | `'{}'::text[]` |  |
| `text` | text |  |  |  |
| `photo_path` | text |  |  |  |
| `reply_text` | text |  |  |  |
| `replied_at` | timestamp with time zone |  |  |  |
| `hidden` | boolean | sim | `false` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Loja cadastro moderacao

<a id="store_documents"></a>
#### `store_documents`

- **Usada por:** Painel admin, Painel do lojista
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110030000_loja_cadastro_moderacao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `store_id` | uuid | sim |  | `stores` |
| `tipo` | text | sim |  |  |
| `path` | text | sim |  |  |
| `status` | text | sim | `'enviado'::text` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="store_place_claims"></a>
#### `store_place_claims`

- **Usada por:** Painel admin, Painel do lojista
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110030000_loja_cadastro_moderacao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `store_id` | uuid | sim |  | `stores` |
| `place_id` | uuid | sim |  | `places` |
| `status` | text | sim | `'pendente'::text` |  |
| `observacao` | text |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `decidido_em` | timestamp with time zone |  |  |  |

<a id="store_reports"></a>
#### `store_reports`

- **Usada por:** App do tutor, Painel admin
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110030000_loja_cadastro_moderacao.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `kind` | text | sim |  |  |
| `target_id` | uuid | sim |  |  |
| `store_id` | uuid | sim |  | `stores` |
| `reporter_id` | uuid | sim |  | `users` |
| `reason` | text | sim |  |  |
| `status` | text | sim | `'aberta'::text` |  |
| `handled_by` | uuid |  |  | `users` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Regras servico

<a id="daycare_plans"></a>
#### `daycare_plans`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110050000_regras_servico.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `service_id` | uuid | sim |  | `services` |
| `period` | text | sim |  |  |
| `price_cents` | integer | sim |  |  |
| `package_days` | integer |  |  |  |
| `package_cents` | integer |  |  |  |

<a id="lodging_rates"></a>
#### `lodging_rates`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110050000_regras_servico.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `service_id` | uuid | sim |  | `services` |
| `size` | text | sim |  |  |
| `night_cents` | integer | sim |  |  |

<a id="request_days"></a>
#### `request_days`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110050000_regras_servico.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `request_id` | uuid | sim |  | `requests` |
| `dia` | date | sim |  |  |
| `periodo` | text | sim | `'dia'::text` |  |

<a id="service_extras"></a>
#### `service_extras`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110050000_regras_servico.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `service_id` | uuid | sim |  | `services` |
| `nome` | text | sim |  |  |
| `price_cents` | integer | sim |  |  |
| `por_dia` | boolean | sim | `false` |  |
| `active` | boolean | sim | `true` |  |

<a id="walk_rules"></a>
#### `walk_rules`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110050000_regras_servico.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `service_id` | uuid | sim |  | `services` |
| `price_30_cents` | integer | sim |  |  |
| `price_60_cents` | integer | sim |  |  |
| `radius_km` | numeric(4,1) | sim | `3` |  |
| `max_pets` | integer | sim | `3` |  |
| `weekdays` | integer[] | sim | `ARRAY[1, 2, 3, 4, 5]` |  |
| `window_start` | time without time zone | sim | `'07:00:00'::time without time zone` |  |
| `window_end` | time without time zone | sim | `'19:00:00'::time without time zone` |  |

### Passeio ao vivo

<a id="walk_events"></a>
#### `walk_events`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110060000_passeio_ao_vivo.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `walk_id` | uuid | sim |  | `walks` |
| `type` | text | sim |  |  |
| `media_path` | text |  |  |  |
| `at` | timestamp with time zone | sim | `now()` |  |

<a id="walk_points"></a>
#### `walk_points`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110060000_passeio_ao_vivo.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | bigint | sim |  |  |
| `walk_id` | uuid | sim |  | `walks` |
| `lat` | double precision | sim |  |  |
| `lng` | double precision | sim |  |  |
| `at` | timestamp with time zone | sim |  |  |

<a id="walks"></a>
#### `walks`

- **Usada por:** App do tutor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110060000_passeio_ao_vivo.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `request_id` | uuid | sim |  | `requests` |
| `store_id` | uuid | sim |  | `stores` |
| `walker_id` | uuid |  |  | `users` |
| `status` | text | sim | `'agendado'::text` |  |
| `fase` | text | sim | `'buscou'::text` |  |
| `started_at` | timestamp with time zone |  |  |  |
| `ended_at` | timestamp with time zone |  |  |  |
| `distance_m` | integer | sim | `0` |  |
| `summary` | text |  |  |  |
| `ultimo_lat` | double precision |  |  |  |
| `ultimo_lng` | double precision |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Entregas

<a id="deliveries"></a>
#### `deliveries`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270110070000_entregas.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `request_id` | uuid | sim |  | `requests` |
| `store_id` | uuid | sim |  | `stores` |
| `status` | text | sim | `'preparando'::text` |  |
| `courier_id` | uuid |  |  | `users` |
| `eta_at` | timestamp with time zone |  |  |  |
| `left_at` | timestamp with time zone |  |  |  |
| `delivered_at` | timestamp with time zone |  |  |  |
| `fail_reason` | text |  |  |  |
| `tentativas` | integer | sim | `0` |  |
| `ultimo_lat` | double precision |  |  |  |
| `ultimo_lng` | double precision |  |  |  |
| `posicao_em` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

### Pagamentos pix

<a id="coupon_uses"></a>
#### `coupon_uses`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111000000_pagamentos_pix.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `coupon_id` | uuid | sim |  | `coupons` |
| `user_id` | uuid | sim |  | `users` |
| `request_id` | uuid | sim |  | `requests` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="coupons"></a>
#### `coupons`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111000000_pagamentos_pix.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `store_id` | uuid |  |  | `stores` |
| `code` | text | sim |  |  |
| `descricao` | text |  |  |  |
| `tipo` | text | sim |  |  |
| `valor` | integer | sim |  |  |
| `minimo_cents` | integer | sim | `0` |  |
| `primeiro_pedido` | boolean | sim | `false` |  |
| `valido_ate` | timestamp with time zone |  |  |  |
| `usos_max` | integer |  |  |  |
| `usos` | integer | sim | `0` |  |
| `ativo` | boolean | sim | `true` |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="payment_customers"></a>
#### `payment_customers`

- **Usada por:** Funções do servidor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111000000_pagamentos_pix.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `user_id` | uuid | sim |  | `users` |
| `provider` | text | sim |  |  |
| `customer_id` | text | sim |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |

<a id="payments"></a>
#### `payments`

- **Usada por:** App do tutor, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111000000_pagamentos_pix.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `codigo` | bigint | sim |  |  |
| `user_id` | uuid | sim |  | `users` |
| `request_id` | uuid |  |  | `requests` |
| `provider` | text | sim | `'asaas'::text` |  |
| `provider_id` | text |  |  |  |
| `method` | text | sim | `'pix'::text` |  |
| `amount_cents` | integer | sim |  |  |
| `status` | text | sim | `'criando'::text` |  |
| `descricao` | text | sim |  |  |
| `pix_payload` | text |  |  |  |
| `pix_qr` | text |  |  |  |
| `expires_at` | timestamp with time zone | sim | `(now() + '00:30:00'::interval)` |  |
| `paid_at` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |
| `album_order_id` | uuid |  |  | `album_orders` |

### Sos pre chegada

<a id="sos_arrivals"></a>
#### `sos_arrivals`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111030000_sos_pre_chegada.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `user_id` | uuid | sim |  | `users` |
| `pet_id` | uuid | sim |  | `pets` |
| `store_id` | uuid | sim |  | `stores` |
| `link_id` | uuid |  |  | `carteirinha_links` |
| `eta_min` | integer | sim |  |  |
| `eta_at` | timestamp with time zone | sim |  |  |
| `status` | text | sim | `'enviada'::text` |  |
| `resposta` | text |  |  |  |
| `substituido_por` | uuid |  |  | `sos_arrivals` |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `vista_em` | timestamp with time zone |  |  |  |
| `preparando_em` | timestamp with time zone |  |  |  |
| `pronta_em` | timestamp with time zone |  |  |  |
| `chegou_em` | timestamp with time zone |  |  |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

### Album pedido

<a id="album_formatos"></a>
#### `album_formatos`

- **Usada por:** App do tutor
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111040000_album_pedido.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | text | sim |  |  |
| `nome` | text | sim |  |  |
| `descricao` | text | sim |  |  |
| `preco_cents` | integer | sim |  |  |
| `extra_20_cents` | integer | sim | `0` |  |
| `frete_cents` | integer | sim | `0` |  |
| `prazo_dias_uteis` | integer | sim |  |  |
| `ordem` | integer | sim | `0` |  |
| `ativo` | boolean | sim | `true` |  |

<a id="album_orders"></a>
#### `album_orders`

- **Usada por:** App do tutor, Funções do servidor, cron
- **Segurança por linha (RLS):** ligada
- **Criada em:** `supabase/migrations/20270111040000_album_pedido.sql`

| Coluna | Tipo | Obrigatória | Padrão | Referência |
|---|---|---|---|---|
| `id` | uuid | sim | `gen_random_uuid()` |  |
| `numero` | bigint | sim |  |  |
| `user_id` | uuid | sim |  | `users` |
| `pet_id` | uuid |  |  | `pets` |
| `pet_nome` | text | sim |  |  |
| `ano` | integer | sim |  |  |
| `formato` | text | sim |  | `album_formatos` |
| `paginas` | integer | sim |  |  |
| `itens` | jsonb | sim |  |  |
| `address_id` | uuid |  |  | `addresses` |
| `endereco_texto` | text | sim |  |  |
| `cep` | text | sim |  |  |
| `preco_cents` | integer | sim |  |  |
| `frete_cents` | integer | sim |  |  |
| `total_cents` | integer | sim |  |  |
| `prazo_dias_uteis` | integer | sim |  |  |
| `status` | text | sim | `'aguardando_pagamento'::text` |  |
| `rastreio` | text |  |  |  |
| `pago_em` | timestamp with time zone |  |  |  |
| `criado_em` | timestamp with time zone | sim | `now()` |  |
| `atualizado_em` | timestamp with time zone | sim | `now()` |  |

## Arquivos (Storage)

Buckets criados pelas migrações: `anexos`, `avaliacoes`, `avistamentos`, `comunidade`, `eventos`, `lojas-docs`, `ong-documentos`, `passeios-loja`, `perfis`, `pets`.

## Visões

`metricas_doses`, `metricas_retencao`, `metricas_semanais`.
