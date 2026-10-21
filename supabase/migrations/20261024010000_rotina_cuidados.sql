-- PetLive: rotina de cuidados (BUSINESS.md 5.21, protótipo Rotina).
-- Tarefas: [APP-CLIENTE] "Rotina de cuidados: antipulgas, vermífugo, banho,
-- dentes e aniversário" e [BACKEND] "Lembretes recorrentes de rotina e aviso
-- de aniversário".
--
-- Os itens da rotina são lembretes comuns (mesmo push agendado, mesma tela
-- Avisos, mesmo Não perturbe), marcados com origem = 'rotina' e a chave do
-- item. Um item por pet: desligar guarda ativo = false e mantém a escolha.

alter table public.reminders
  add column origem text not null default 'manual' check (origem in ('manual', 'rotina')),
  add column rotina_item text check (
    rotina_item in ('antipulgas', 'vermifugo', 'banho', 'dentes', 'aniversario')
  );

alter table public.reminders
  add constraint reminders_rotina_coerente check ((origem = 'rotina') = (rotina_item is not null));

-- NULL não colide em unique: os lembretes manuais (sem item) não são afetados.
alter table public.reminders
  add constraint reminders_pet_rotina_item_key unique (pet_id, rotina_item);

comment on column public.reminders.origem is 'manual (criado pelo tutor) ou rotina (tela Rotina de cuidados).';
comment on column public.reminders.rotina_item is 'Item da rotina: antipulgas, vermifugo, banho, dentes ou aniversario.';
