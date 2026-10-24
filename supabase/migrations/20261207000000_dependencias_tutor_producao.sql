-- Reconcilia dependências ausentes em produção gerida antes por SQL manual.
-- Reaplicável; preserva a exportação existente. Não recria tabelas nem dados.
begin;
create schema if not exists extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table if not exists public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('vacina', 'vermifugo', 'consulta', 'banho_tosa', 'remedio', 'outro')),
  ativo boolean not null default true,
  -- Janela de silêncio do "Não perturbe".
  nao_perturbe_inicio time,
  nao_perturbe_fim time,
  unique (tutor_id, tipo)
);
alter table public.notification_prefs enable row level security;
revoke all on public.notification_prefs from anon;
grant select,insert,update,delete on public.notification_prefs to authenticated;
drop policy if exists "notification_prefs: limite da conta" on public.notification_prefs;
create policy "notification_prefs: limite da conta" on public.notification_prefs for all to authenticated using(tutor_id=auth.uid()) with check(tutor_id=auth.uid());
-- PetLive: tela "Avisos" (ligar/desligar por tipo, horário e Não perturbe).
-- Tarefa: [APP-CLIENTE] "Tela Avisos: ligar e desligar por tipo, horário e
-- Não perturbe".
--
-- O "ligar por tipo" e a janela do "Não perturbe" já existem em
-- notification_prefs (uma linha por tipo, por tutor). Falta:
--   1. notification_settings: o "Horário dos avisos" global (hora padrão de
--      novos lembretes) e o fuso do tutor, usado pelo Não perturbe;
--   2. o push passa a respeitar as preferências: tipo desligado não avisa
--      (sem linha = padrão ligado) e dentro da janela do Não perturbe o
--      aviso espera a janela passar (o lembrete não é marcado como avisado,
--      então o próximo ciclo tenta de novo).

-- ============================================================
-- Ajustes globais dos avisos
-- ============================================================
create table if not exists public.notification_settings (
  tutor_id uuid primary key references public.profiles (id) on delete cascade,
  -- "Horário dos avisos": hora usada ao criar um lembrete e no aviso local.
  horario_avisos time not null default '09:00',
  -- Fuso do tutor para o "Não perturbe". O app é pt-BR (Brasil sem horário
  -- de verão desde 2019), então o padrão cobre todos os usuários.
  fuso text not null default 'America/Sao_Paulo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.notification_settings is
  'Ajustes globais dos avisos: horário padrão e fuso do Não perturbe.';

alter table public.notification_settings enable row level security;

drop policy if exists "notification_settings: do proprio tutor" on public.notification_settings;
create policy "notification_settings: do proprio tutor"
  on public.notification_settings
  for all
  using (auth.uid() = tutor_id)
  with check (auth.uid() = tutor_id);

-- ============================================================

-- PetLive: despesas do pet (BUSINESS.md 5.32, telas Despesas e NovaDespesa).
-- Só registro: o PetLive não paga nem cobra nada aqui. Dados privados do
-- tutor. O recibo (opcional) vai para o bucket privado `anexos`, na pasta do
-- tutor, e é apagado com a conta (lgpd-delete).

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Null = despesa de todos os pets.
  pet_id uuid references public.pets (id) on delete set null,
  categoria text not null check (categoria in ('racao', 'veterinario', 'banho_tosa', 'remedios', 'acessorios', 'hotel_creche', 'outros')),
  valor_centavos int not null check (valor_centavos between 1 and 100000000),
  data date not null default current_date,
  anotacao text check (char_length(anotacao) <= 200),
  recibo_path text,
  criado_em timestamptz not null default now()
);
create index if not exists despesas_tutor_data on public.despesas (tutor_id, data desc);

alter table public.despesas enable row level security;
revoke all on public.despesas from anon;
grant select, insert, update, delete on public.despesas to authenticated;

drop policy if exists "despesas: tutor lê as suas" on public.despesas;
create policy "despesas: tutor lê as suas" on public.despesas
  for select to authenticated using (tutor_id = auth.uid());
drop policy if exists "despesas: tutor cria as suas" on public.despesas;
create policy "despesas: tutor cria as suas" on public.despesas
  for insert to authenticated
  with check (
    tutor_id = auth.uid()
    and (pet_id is null or exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()))
    and (recibo_path is null or recibo_path like auth.uid()::text || '/%')
  );
drop policy if exists "despesas: tutor edita as suas" on public.despesas;
create policy "despesas: tutor edita as suas" on public.despesas
  for update to authenticated
  using (tutor_id = auth.uid())
  with check (
    tutor_id = auth.uid()
    and (pet_id is null or exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()))
    and (recibo_path is null or recibo_path like auth.uid()::text || '/%')
  );
drop policy if exists "despesas: tutor apaga as suas" on public.despesas;
create policy "despesas: tutor apaga as suas" on public.despesas
  for delete to authenticated using (tutor_id = auth.uid());

comment on table public.despesas is 'Gastos do tutor com os pets (só registro).';


-- Documentos de saúde privados do pet: cartão de vacina e exames.
create table if not exists public.documentos_saude (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('cartao_vacina', 'exame')),
  titulo text not null check (char_length(titulo) between 2 and 80),
  realizado_em date not null default current_date,
  arquivo_path text not null,
  criado_em timestamptz not null default now(),
  constraint documentos_saude_path_tutor check (arquivo_path like tutor_id::text || '/%')
);

create index if not exists documentos_saude_pet_data_idx on public.documentos_saude (pet_id, realizado_em desc);
alter table public.documentos_saude enable row level security;
revoke all on public.documentos_saude from anon;
grant select, insert, update, delete on public.documentos_saude to authenticated;

drop policy if exists "documentos_saude: tutor le os seus" on public.documentos_saude;
create policy "documentos_saude: tutor le os seus" on public.documentos_saude
  for select to authenticated using (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
  );
drop policy if exists "documentos_saude: tutor cria nos seus pets" on public.documentos_saude;
create policy "documentos_saude: tutor cria nos seus pets" on public.documentos_saude
  for insert to authenticated with check (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
    and arquivo_path like auth.uid()::text || '/%'
  );
drop policy if exists "documentos_saude: tutor edita os seus" on public.documentos_saude;
create policy "documentos_saude: tutor edita os seus" on public.documentos_saude
  for update to authenticated using (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
  ) with check (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
    and arquivo_path like auth.uid()::text || '/%'
  );
drop policy if exists "documentos_saude: tutor apaga os seus" on public.documentos_saude;
create policy "documentos_saude: tutor apaga os seus" on public.documentos_saude
  for delete to authenticated using (
    tutor_id = auth.uid() and public.is_pet_owner(pet_id)
  );

comment on table public.documentos_saude is 'Fotos privadas do cartão de vacina e exames do pet.';

alter table public.profiles add column if not exists cidade text check(char_length(cidade)<=60),
 add column if not exists whatsapp boolean not null default true,
 add column if not exists contato_emergencia_nome text check(char_length(contato_emergencia_nome)<=60),
 add column if not exists contato_emergencia_telefone text check(char_length(contato_emergencia_telefone)<=20);
insert into storage.buckets(id,name,public) values('pets','pets',true),('anexos','anexos',false) on conflict(id) do nothing;
drop policy if exists "petlive: pets select" on storage.objects;
create policy "petlive: pets select" on storage.objects for select to public using(bucket_id='pets');
drop policy if exists "petlive: pets insert" on storage.objects;
create policy "petlive: pets insert" on storage.objects for insert to authenticated with check(bucket_id='pets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "petlive: pets update" on storage.objects;
create policy "petlive: pets update" on storage.objects for update to authenticated using(bucket_id='pets' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='pets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "petlive: pets delete" on storage.objects;
create policy "petlive: pets delete" on storage.objects for delete to authenticated using(bucket_id='pets' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "petlive: anexos select" on storage.objects;
create policy "petlive: anexos select" on storage.objects for select to authenticated using(bucket_id='anexos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "petlive: anexos insert" on storage.objects;
create policy "petlive: anexos insert" on storage.objects for insert to authenticated with check(bucket_id='anexos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "petlive: anexos update" on storage.objects;
create policy "petlive: anexos update" on storage.objects for update to authenticated using(bucket_id='anexos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='anexos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "petlive: anexos delete" on storage.objects;
create policy "petlive: anexos delete" on storage.objects for delete to authenticated using(bucket_id='anexos' and (storage.foldername(name))[1]=auth.uid()::text);
do $bootstrap$ begin
 if to_regprocedure('public.exportar_meus_dados()') is null then
execute $base$create or replace function public.exportar_meus_dados_base()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  return jsonb_build_object(
    'exportado_em', now(),
    'perfil', (
      select to_jsonb(p) from public.profiles p where p.id = v_tutor
    ),
    'pets', (
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      from public.pets p where p.tutor_id = v_tutor
    ),
    'vacinas', (
      select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
      from public.vaccinations v
      where exists (
        select 1 from public.pets pp where pp.id = v.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'vermifugos', (
      select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
      from public.dewormings d
      where exists (
        select 1 from public.pets pp where pp.id = d.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'pesos', (
      select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
      from public.weights w
      where exists (
        select 1 from public.pets pp where pp.id = w.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'consultas', (
      select coalesce(jsonb_agg(to_jsonb(vis)), '[]'::jsonb)
      from public.visits vis
      where exists (
        select 1 from public.pets pp where pp.id = vis.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'remedios', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.medications m where m.pet_id in (
        select pp.id from public.pets pp where pp.tutor_id = v_tutor
      )
    ),
    'doses_de_remedio', (
      select coalesce(jsonb_agg(to_jsonb(dose)), '[]'::jsonb)
      from public.medication_doses dose
      where dose.medication_id in (
        select m.id from public.medications m
        where m.pet_id in (select pp.id from public.pets pp where pp.tutor_id = v_tutor)
      )
    ),
    'lembretes', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from public.reminders r where r.tutor_id = v_tutor
    ),
    'tokens_de_push', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from public.push_tokens t where t.tutor_id = v_tutor
    ),
    'avisos_por_tipo', (
      select coalesce(jsonb_agg(to_jsonb(np)), '[]'::jsonb)
      from public.notification_prefs np where np.tutor_id = v_tutor
    ),
    'ajustes_de_aviso', (
      select to_jsonb(ns) from public.notification_settings ns where ns.tutor_id = v_tutor
    ),
    'aceites', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.aceites_termos a where a.user_id = v_tutor
    )
  );
end;
$$;

$base$;
execute $wrapper$-- PetLive: a exportação LGPD leva também a caixa de avisos (notification_log).

create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  return public.exportar_meus_dados_base() || jsonb_build_object(
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.registrado_em), '[]'::jsonb)
      from public.consentimentos c where c.tutor_id = v_tutor
    ),
    'pedidos_de_privacidade', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.criado_em), '[]'::jsonb)
      from public.lgpd_requests r where r.user_id = v_tutor
    ),
    'lugares_salvos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', pl.nome, 'endereco', pl.endereco, 'salvo_em', s.saved_at, 'google_place_id', s.google_place_id
      ) order by s.saved_at), '[]'::jsonb)
      from public.saved_places s
      left join public.places pl on pl.id = s.place_id
      where s.user_id = v_tutor
    ),
    'registros_de_uso', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'detalhes', e.props, 'quando', e.ocorreu_em
      ) order by e.ocorreu_em), '[]'::jsonb)
      from public.eventos_uso e where e.user_id = v_tutor
    ),
    'caixa_de_avisos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', n.type, 'titulo', n.title, 'texto', n.body, 'enviado_em', n.sent_at, 'lido_em', n.read_at
      ) order by n.sent_at), '[]'::jsonb)
      from public.notification_log n where n.user_id = v_tutor
    )
  );
end;
$$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
$wrapper$;
 end if;
end $bootstrap$;
do $dependencias$ begin
 if to_regprocedure('public.exportar_meus_dados_sem_dependencias_tutor()') is null then
 alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_dependencias_tutor;
 execute $funcao$create or replace function public.exportar_meus_dados() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return public.exportar_meus_dados_sem_dependencias_tutor()||jsonb_build_object(
 'despesas',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.despesas d where tutor_id=auth.uid()),
 'documentos_saude',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.documentos_saude d where tutor_id=auth.uid()));
end;
$$;
$funcao$;
 end if;
end $dependencias$;
revoke all on function public.exportar_meus_dados_sem_dependencias_tutor() from public,anon,authenticated;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
do $$ begin
 if to_regprocedure('public.exportar_meus_dados_base()') is not null then
 revoke all on function public.exportar_meus_dados_base() from public,anon,authenticated;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
