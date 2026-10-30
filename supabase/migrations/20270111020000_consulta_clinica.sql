-- Consulta na clínica (BUSINESS.md 5.6, Fase 3): a clínica que está no
-- PetLive oferece consulta, vacina e retorno como serviços por horário. O
-- tutor agenda pelo mesmo motor de reservas (servico_reservar). Quando a
-- clínica confirma, a consulta entra no histórico do pet (visits) como
-- agendada; remarcar muda a data e cancelar ou recusar tira do histórico.

alter table public.services add column if not exists tipo_clinico text check (tipo_clinico in ('consulta', 'vacina', 'retorno'));
alter table public.visits add column if not exists request_id uuid references public.requests (id) on delete set null;
create unique index if not exists visits_request on public.visits (request_id) where request_id is not null;

-- Vitrine com o tipo clínico de cada serviço (a tela da clínica agrupa por ele).
create or replace function public.loja_vitrine(p_store uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s stores;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into s from stores where id = p_store;
  if s.id is null or (s.status <> 'aprovada' and not public.loja_membro(s.id)) then return jsonb_build_object('disponivel', false); end if;
  return jsonb_build_object('disponivel', true, 'loja', public.loja_publica_json(s),
    'produtos', case when s.oferece = 'servicos' then '[]'::jsonb else coalesce((
      select jsonb_agg(public.produto_json(p) order by p.categoria, p.name) from products p where p.store_id = s.id and public.produto_visivel(p)), '[]'::jsonb) end,
    'servicos', case when s.oferece = 'produtos' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', sv.id, 'name', sv.name, 'description', sv.description, 'modelo', sv.modelo,
                                          'duration_min', sv.duration_min, 'price_cents', sv.price_cents, 'tipo_clinico', sv.tipo_clinico) order by sv.name)
      from services sv where sv.store_id = s.id and sv.active), '[]'::jsonb) end);
end;
$$;

-- Consulta confirmada vira registro no histórico do pet; os passos seguintes o mantêm em dia.
create or replace function public.consulta_no_historico()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_loja text; v_dia date;
begin
  if new.kind <> 'servico' or new.pet_id is null or new.starts_at is null then return new; end if;
  select sv.tipo_clinico, s.name into v_tipo, v_loja
  from services sv join stores s on s.id = sv.store_id where sv.id = new.service_id and s.kind = 'clinica';
  if v_tipo is null then return new; end if;
  v_dia := (new.starts_at at time zone public.loja_fuso())::date;

  if new.status in ('confirmada', 'em_andamento', 'concluida') then
    insert into visits (pet_id, motivo, realizada_em, local, observacao, request_id, criado_por)
    values (new.pet_id, case v_tipo when 'consulta' then 'Consulta' when 'vacina' then 'Vacina' else 'Retorno' end, v_dia, v_loja,
            'Agendada pelo PetLive às ' || to_char(new.starts_at at time zone public.loja_fuso(), 'HH24:MI') || '.', new.id, new.user_id)
    on conflict (request_id) where request_id is not null do update set realizada_em = excluded.realizada_em, observacao = excluded.observacao;
  elsif new.status in ('cancelada', 'recusada', 'expirada', 'nao_compareceu') then
    delete from visits where request_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists requests_consulta_historico on public.requests;
create trigger requests_consulta_historico after update of status, starts_at on public.requests
  for each row execute function public.consulta_no_historico();

-- A clínica (dono ou gerente) marca o tipo de cada serviço por horário.
create or replace function public.loja_servico_tipo_clinico(p_service uuid, p_tipo text)
returns void language plpgsql security definer set search_path = public as $$
declare sv services;
begin
  select * into sv from services where id = p_service;
  if sv.id is null or not public.loja_membro(sv.store_id, array['owner', 'manager']) then raise exception 'Serviço não encontrado.' using errcode = '42501'; end if;
  if p_tipo is not null and sv.modelo <> 'horario' then raise exception 'Consulta, vacina e retorno são por horário.' using errcode = '22023'; end if;
  update services set tipo_clinico = p_tipo where id = sv.id;
end;
$$;

revoke all on function public.consulta_no_historico() from public, anon, authenticated;
revoke all on function public.loja_servico_tipo_clinico(uuid, text) from public, anon;
grant execute on function public.loja_servico_tipo_clinico(uuid, text) to authenticated;

notify pgrst, 'reload schema';
