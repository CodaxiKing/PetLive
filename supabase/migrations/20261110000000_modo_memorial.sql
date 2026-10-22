-- PetLive: modo memorial (BUSINESS.md 5.39, telas RegistrarPartida,
-- ConfirmarPartida, Memorial e ReativarPet). Nada é apagado: o pet sai da
-- lista ativa, os lembretes e remédios dele são pausados, links e acessos
-- de cuidador são encerrados, e dá para reativar quando quiser. Sem
-- campanhas comerciais por 60 dias.

alter table public.pets add column em_memoria boolean not null default false;

create table public.memorial (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  data_partida date not null,
  mensagem text check (char_length(mensagem) <= 300),
  criado_em timestamptz not null default now(),
  reativado_em timestamptz
);
alter table public.memorial enable row level security;
revoke all on public.memorial from anon, authenticated;
grant select on public.memorial to authenticated;
create policy "memorial: tutor vê o dos seus pets" on public.memorial
  for select to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()));

-- O que a partida pausou (para devolver exatamente isso ao reativar).
alter table public.reminders add column pausado_memorial boolean not null default false;
alter table public.medications add column pausado_memorial boolean not null default false;

create or replace function public.registrar_partida(p_pet uuid, p_data date, p_mensagem text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pets where id = p_pet and tutor_id = auth.uid()) then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  if p_data is null or p_data > current_date then raise exception 'Informe uma data até hoje.'; end if;

  insert into memorial (pet_id, data_partida, mensagem, criado_em, reativado_em)
  values (p_pet, p_data, nullif(trim(coalesce(p_mensagem, '')), ''), now(), null)
  on conflict (pet_id) do update
    set data_partida = excluded.data_partida, mensagem = excluded.mensagem, criado_em = now(), reativado_em = null;
  update pets set em_memoria = true where id = p_pet;

  update reminders set ativo = false, pausado_memorial = true where pet_id = p_pet and ativo;
  update medications set ativo = false, pausado_memorial = true where pet_id = p_pet and ativo;
  -- Links da carteirinha e fichas deixam de abrir; acessos de cuidador terminam.
  update carteirinha_links set cancelado_em = now() where pet_id = p_pet and cancelado_em is null;
  update cuidador_acessos set revogado_em = now() where p_pet = any (pet_ids) and revogado_em is null;
end;
$$;

/** Reativa: devolve o pet e o que foi pausado; lembretes vencidos na pausa não são refeitos. */
create or replace function public.reativar_pet(p_pet uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r reminders;
  v_proxima timestamptz;
begin
  if not exists (select 1 from pets where id = p_pet and tutor_id = auth.uid() and em_memoria) then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  update pets set em_memoria = false where id = p_pet;
  update memorial set reativado_em = now() where pet_id = p_pet;

  for r in select * from reminders where pet_id = p_pet and pausado_memorial loop
    v_proxima := r.proxima_em;
    -- Repetição: anda até a próxima ocorrência futura; sem repetição e já passado, fica desligado.
    while v_proxima <= now() and r.repetir is not null and r.repetir <> 'nao' loop
      v_proxima := public.proximo_disparo(v_proxima, r.repetir, r.intervalo_dias);
      exit when v_proxima is null;
    end loop;
    update reminders set
      pausado_memorial = false,
      ativo = v_proxima is not null and v_proxima > now(),
      proxima_em = coalesce(v_proxima, proxima_em)
    where id = r.id;
  end loop;
  update medications set ativo = (fim is null or fim >= current_date), pausado_memorial = false
  where pet_id = p_pet and pausado_memorial;
end;
$$;

revoke all on function public.registrar_partida(uuid, date, text) from public, anon;
revoke all on function public.reativar_pet(uuid) from public, anon;
grant execute on function public.registrar_partida(uuid, date, text) to authenticated;
grant execute on function public.reativar_pet(uuid) to authenticated;

-- ============================================================
-- Campanhas: nada comercial por 60 dias depois da partida, e os públicos
-- por pet ignoram pets em memória.
-- ============================================================
create or replace function public.campanha_destinatarios(p_publico text)
returns table (tutor_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with aceite as (
    select distinct on (c.tutor_id) c.tutor_id, c.aceito
    from consentimentos c
    where c.tipo = 'dicas_novidades'
    order by c.tutor_id, c.registrado_em desc
  )
  select p.id
  from profiles p
  join aceite a on a.tutor_id = p.id and a.aceito
  join auth.users u on u.id = p.id
  where coalesce(p.notificacoes_ativas, true)
    and (u.banned_until is null or u.banned_until < now())
    -- Luto: nada comercial por 60 dias depois de registrar a partida de um pet.
    and not exists (
      select 1 from memorial m join pets pm on pm.id = m.pet_id
      where pm.tutor_id = p.id and m.reativado_em is null and m.criado_em > now() - interval '60 days'
    )
    and not exists (
      select 1 from notification_log n
      where n.user_id = p.id and n.type = 'campanha' and n.sent_at > now() - interval '20 hours'
    )
    and case p_publico
      when 'todos' then true
      when 'caes' then exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria and especie = 'cao')
      when 'gatos' then exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria and especie = 'gato')
      when 'sem_pet' then not exists (select 1 from pets where tutor_id = p.id and ativo and not em_memoria)
      when 'vacina_vencendo' then exists (
        select 1 from vaccinations v join pets pe on pe.id = v.pet_id
        where pe.tutor_id = p.id and pe.ativo and not pe.em_memoria and v.proxima_dose between current_date and current_date + 14
      )
      when 'inativos' then not exists (
        select 1 from eventos_uso e where e.user_id = p.id and e.evento = 'app_aberto' and e.ocorreu_em > now() - interval '30 days'
      )
      else false
    end
$$;
