-- PetLive: selos de cuidado (BUSINESS.md 5.27, tela Selos). Sem ranking,
-- sem pontos e sem aviso: o selo aparece quando a condição vale e some, em
-- silêncio, quando deixa de valer. Calculado no servidor uma vez por dia
-- (badges-recalc) e também quando o tutor abre a tela, para não esperar.
-- "Passeios em dia" entra com os passeios com GPS.

create table public.pet_selos (
  pet_id uuid not null references public.pets (id) on delete cascade,
  selo text not null check (selo in ('vacinas', 'rotina', 'peso', 'um_ano', 'primeira_consulta', 'cartao_completo')),
  desde timestamptz not null default now(),
  primary key (pet_id, selo)
);
alter table public.pet_selos enable row level security;
revoke all on public.pet_selos from anon, authenticated;
grant select on public.pet_selos to authenticated;
create policy "pet_selos: tutor vê os dos seus pets" on public.pet_selos
  for select to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()));

/** Selos que o pet merece hoje (regras fixas do BUSINESS.md 5.27). */
create or replace function public.selos_do_pet(p pets)
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select array_remove(array[
    -- Vacinas em dia: tem vacina registrada e nenhuma vencida (a dose mais recente de cada uma).
    case when exists (select 1 from vaccinations where pet_id = p.id)
      and not exists (
        select 1 from (select distinct on (nome) proxima_dose from vaccinations where pet_id = p.id order by nome, aplicada_em desc) v
        where v.proxima_dose < current_date
      ) then 'vacinas' end,
    -- Rotina em dia: tem cuidados da rotina ligados e nenhum atrasado há mais de 7 dias,
    -- ou um vermífugo registrado nos últimos 3 meses.
    case when (
        exists (select 1 from reminders where pet_id = p.id and origem = 'rotina' and ativo)
        and not exists (select 1 from reminders where pet_id = p.id and origem = 'rotina' and ativo and proxima_em < now() - interval '7 days')
      ) or exists (select 1 from dewormings where pet_id = p.id and aplicado_em > current_date - 90)
      then 'rotina' end,
    -- Peso em dia: pesagem nos últimos 3 meses.
    case when exists (select 1 from weights where pet_id = p.id and medido_em > current_date - 90) then 'peso' end,
    case when p.criado_em <= now() - interval '1 year' then 'um_ano' end,
    case when exists (select 1 from visits where pet_id = p.id) then 'primeira_consulta' end,
    -- Cartão completo: os dados básicos e as seções da carteirinha preenchidos.
    case when p.foto_url is not null and p.nascimento is not null and p.raca is not null and p.peso_atual is not null
      and p.sexo is not null and p.castrado is not null
      and exists (select 1 from vaccinations where pet_id = p.id)
      and nullif(trim(coalesce(p.alergias, '')), '') is not null
      and nullif(trim(coalesce(p.veterinario, '')), '') is not null
      then 'cartao_completo' end
  ], null)
$$;
revoke all on function public.selos_do_pet(pets) from public, anon, authenticated;

create or replace function public.recalcular_selos_pet(p_pet uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p pets;
  v_selos text[];
begin
  select * into p from pets where id = p_pet;
  if p.id is null then return; end if;
  -- Pet em memória mantém os selos que já tinha (BUSINESS.md 5.39).
  if p.em_memoria then return; end if;
  v_selos := public.selos_do_pet(p);
  delete from pet_selos where pet_id = p.id and not (selo = any (v_selos));
  insert into pet_selos (pet_id, selo) select p.id, s from unnest(v_selos) s on conflict do nothing;
end;
$$;
revoke all on function public.recalcular_selos_pet(uuid) from public, anon, authenticated;

/** O app pede ao abrir a tela de selos ou o perfil do pet. */
create or replace function public.conferir_selos(p_pet uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pets where id = p_pet and tutor_id = auth.uid()) then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  perform public.recalcular_selos_pet(p_pet);
  return coalesce((select array_agg(selo order by selo) from pet_selos where pet_id = p_pet), '{}');
end;
$$;
revoke all on function public.conferir_selos(uuid) from public, anon;
grant execute on function public.conferir_selos(uuid) to authenticated;

create or replace function public.recalcular_selos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet uuid;
begin
  for v_pet in select id from pets where ativo and not em_memoria loop
    perform public.recalcular_selos_pet(v_pet);
  end loop;
end;
$$;
revoke all on function public.recalcular_selos() from public, anon, authenticated;
select cron.schedule('petlive-selos', '30 6 * * *', $$select public.recalcular_selos();$$);
