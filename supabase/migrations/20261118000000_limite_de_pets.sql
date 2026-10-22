-- PetLive: vários pets com limite por plano (BUSINESS.md 5.13, 5.39 e 10).
-- Grátis: 1 pet ativo editável. Premium: até 20. Pets em memória não contam.
-- Os pets além do limite ficam **somente leitura**: nada é apagado nem
-- escondido, e a regra é calculada na hora (voltar ao Premium libera tudo
-- sem outra ação). Quem continua editável é o pet ativo há mais tempo
-- (ativo_desde: o cadastro, ou a volta do modo memorial).
--
-- As recusas usam o SQLSTATE PT402: o PostgREST responde HTTP 402 e o app
-- abre o convite Premium. O hint diz o motivo: limite_pets ou somente_leitura.
-- Os gatilhos valem para o tutor pela API (current_user = authenticated);
-- funções do servidor (security definer), jobs e o service_role passam.

alter table public.pets add column ativo_desde timestamptz not null default now();
alter table public.pets disable trigger pets_touch;
update public.pets set ativo_desde = criado_em;
alter table public.pets enable trigger pets_touch;
comment on column public.pets.ativo_desde is 'Desde quando o pet está ativo (cadastro ou reativação). Define quem fica editável no plano grátis.';

/** Quantos pets ativos o plano permite (BUSINESS.md 10). */
create or replace function public.limite_pets(p_plano text)
returns int
language sql
immutable
as $$
  select case when p_plano = 'premium' then 20 else 1 end
$$;

/**
 * O pet está só para consulta: ativo, fora do modo memorial e além do limite
 * do plano, contando os pets ativos há mais tempo. Também é campo calculado
 * do PostgREST: pets?select=*,somente_leitura.
 */
create or replace function public.somente_leitura(p pets)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p.ativo and not p.em_memoria and (
    select count(*) from pets o
    where o.tutor_id = p.tutor_id and o.ativo and not o.em_memoria and o.id <> p.id
      and (o.ativo_desde, o.id) < (p.ativo_desde, p.id)
  ) >= public.limite_pets((select plano from profiles where id = p.tutor_id))
$$;

create or replace function public.exigir_pet_editavel(p_pet uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pet pets;
begin
  select * into v_pet from pets where id = p_pet;
  -- Pet inexistente (ou apagado em cascata): a RLS cuida do resto.
  if found and public.somente_leitura(v_pet) then
    raise exception 'Este pet está só para consulta no plano grátis. Assine o Premium para editar.'
      using errcode = 'PT402', hint = 'somente_leitura';
  end if;
end;
$$;

-- ============================================================
-- Pets: limite no cadastro e nada de editar o que está só para consulta
-- ============================================================
create or replace function public.pets_limite_do_plano()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_plano text;
begin
  if current_user <> 'authenticated' then return new; end if;

  if tg_op = 'INSERT' then
    -- Trava o perfil: dois cadastros ao mesmo tempo não passam juntos do limite.
    select plano into v_plano from profiles where id = new.tutor_id for update;
    if (select count(*) from pets where tutor_id = new.tutor_id and ativo and not em_memoria)
       >= public.limite_pets(v_plano) then
      raise exception '%', case when coalesce(v_plano, 'gratis') = 'premium'
          then 'Você chegou ao limite de pets da sua conta.'
          else 'No plano grátis é 1 pet ativo. Assine o Premium para cadastrar mais pets.' end
        using errcode = 'PT402', hint = 'limite_pets';
    end if;
    new.ativo_desde := now();
    return new;
  end if;

  perform public.exigir_pet_editavel(old.id);
  -- A ordem de quem fica editável e o modo memorial só mudam pelo servidor.
  if new.ativo_desde is distinct from old.ativo_desde
     or new.em_memoria is distinct from old.em_memoria
     or new.tutor_id is distinct from old.tutor_id then
    raise exception 'Alteração não permitida.' using errcode = '42501';
  end if;
  if new.ativo and not old.ativo then new.ativo_desde := now(); end if;
  return new;
end;
$$;

create trigger pets_limite_do_plano before insert or update on public.pets
  for each row execute function public.pets_limite_do_plano();

-- ============================================================
-- Saúde e cuidados do pet: só no pet editável
-- ============================================================
create or replace function public.guardar_pet_somente_leitura()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_linha jsonb := to_jsonb(coalesce(new, old));
  v_antiga jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
begin
  if current_user <> 'authenticated' then return coalesce(new, old); end if;

  if tg_table_name = 'medication_doses' then
    -- As linhas das doses de hoje o app cria sozinho; dar, pular ou adiar é editar.
    if tg_op = 'INSERT' and v_linha ->> 'confirmada_em' is null and v_linha ->> 'adiada_ate' is null
       and not coalesce((v_linha ->> 'pulada')::boolean, false) then
      return new;
    end if;
    perform public.exigir_pet_editavel((select pet_id from medications where id = (v_linha ->> 'medication_id')::uuid));
  else
    if v_linha ->> 'pet_id' is not null then
      perform public.exigir_pet_editavel((v_linha ->> 'pet_id')::uuid);
    end if;
    if v_antiga ->> 'pet_id' is not null and v_antiga ->> 'pet_id' is distinct from v_linha ->> 'pet_id' then
      perform public.exigir_pet_editavel((v_antiga ->> 'pet_id')::uuid);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger vaccinations_somente_leitura before insert or update or delete on public.vaccinations
  for each row execute function public.guardar_pet_somente_leitura();
create trigger dewormings_somente_leitura before insert or update or delete on public.dewormings
  for each row execute function public.guardar_pet_somente_leitura();
create trigger weights_somente_leitura before insert or update or delete on public.weights
  for each row execute function public.guardar_pet_somente_leitura();
create trigger visits_somente_leitura before insert or update or delete on public.visits
  for each row execute function public.guardar_pet_somente_leitura();
create trigger medications_somente_leitura before insert or update or delete on public.medications
  for each row execute function public.guardar_pet_somente_leitura();
create trigger medication_doses_somente_leitura before insert or update or delete on public.medication_doses
  for each row execute function public.guardar_pet_somente_leitura();
create trigger reminders_somente_leitura before insert or update or delete on public.reminders
  for each row execute function public.guardar_pet_somente_leitura();
create trigger marcos_somente_leitura before insert or update or delete on public.marcos
  for each row execute function public.guardar_pet_somente_leitura();
create trigger qualidade_vida_somente_leitura before insert or update or delete on public.qualidade_vida
  for each row execute function public.guardar_pet_somente_leitura();
-- Listas de viagem e despesas do pet (despesa sem pet, de todos, passa).
create trigger viagens_somente_leitura before insert or update or delete on public.viagens
  for each row execute function public.guardar_pet_somente_leitura();
create trigger despesas_somente_leitura before insert or update or delete on public.despesas
  for each row execute function public.guardar_pet_somente_leitura();

-- ============================================================
-- Cuidador temporário: o cuidador marca doses, então o acesso só vale para
-- pets editáveis. Os acessos nascem por RPC (security definer), por isso a
-- checagem olha o tutor da requisição (auth.uid()), não o current_user.
-- Revogar continua liberado. Compartilhar a carteirinha e a ficha de
-- emergência também: é consulta, não muda o pet, e o que protege o pet não
-- fica atrás de assinatura (BUSINESS.md 10).
-- ============================================================
create or replace function public.cuidador_acessos_somente_leitura()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pet uuid;
begin
  if auth.uid() is null then return new; end if;
  foreach v_pet in array new.pet_ids loop
    perform public.exigir_pet_editavel(v_pet);
  end loop;
  return new;
end;
$$;

create trigger cuidador_acessos_somente_leitura before insert on public.cuidador_acessos
  for each row execute function public.cuidador_acessos_somente_leitura();

/** O cuidador marca a dose como dada; o tutor é avisado. Pet só para consulta: recusa. */
create or replace function public.cuidador_marcar_dose(p_codigo text, p_medication uuid, p_prevista_para timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a cuidador_acessos := public.cuidador_acesso_valido(p_codigo);
  m medications;
  v_pet pets;
begin
  if a.id is null then raise exception 'Este acesso terminou.' using errcode = '42501'; end if;
  if not a.ver_remedios then raise exception 'O tutor não liberou os remédios.' using errcode = '42501'; end if;
  select * into m from medications where id = p_medication;
  if m.id is null or not (m.pet_id = any (a.pet_ids)) then raise exception 'Remédio não encontrado.' using errcode = '42501'; end if;
  if abs(extract(epoch from (p_prevista_para - now()))) > 86400 then raise exception 'Só dá para marcar as doses de hoje.'; end if;
  perform public.exigir_pet_editavel(m.pet_id);

  insert into medication_doses (medication_id, prevista_para, confirmada_em, origem, confirmada_por)
  values (m.id, p_prevista_para, now(), 'cuidador', a.cuidador)
  on conflict (medication_id, prevista_para) do update
    set confirmada_em = coalesce(medication_doses.confirmada_em, now()),
        origem = coalesce(medication_doses.origem, 'cuidador'),
        confirmada_por = coalesce(medication_doses.confirmada_por, a.cuidador);

  insert into cuidador_registros (acesso_id, acao, detalhe) values (a.id, 'dose', m.nome);
  select * into v_pet from pets where id = m.pet_id;
  perform public.avisar_tutor(a.tutor_id, v_pet.id, 'dose',
    a.cuidador || ' deu o ' || m.nome || ' ' || case when v_pet.sexo = 'femea' then 'da ' else 'do ' end || v_pet.nome,
    'Marcado pelo acesso de cuidador às ' || to_char(now() at time zone 'America/Sao_Paulo', 'HH24:MI') || '.',
    '/pet/' || v_pet.id || '/medicamentos');
end;
$$;

-- ============================================================
-- O plano só muda pelo servidor (pagamento, admin), nunca pelo próprio tutor
-- ============================================================
create or replace function public.profiles_plano_do_servidor()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'authenticated' and new.plano is distinct from old.plano then
    raise exception 'O plano muda só pela assinatura.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_plano_do_servidor before update on public.profiles
  for each row execute function public.profiles_plano_do_servidor();

-- ============================================================
-- Reativar do modo memorial: o pet volta como o mais novo da fila. No grátis,
-- se já houver um pet ativo, ele volta só para consulta (BUSINESS.md 5.39).
-- ============================================================
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
  update pets set em_memoria = false, ativo_desde = now() where id = p_pet;
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

revoke all on function public.limite_pets(text) from public, anon;
revoke all on function public.somente_leitura(pets) from public, anon;
revoke all on function public.exigir_pet_editavel(uuid) from public, anon;
revoke all on function public.pets_limite_do_plano() from public, anon;
revoke all on function public.guardar_pet_somente_leitura() from public, anon;
revoke all on function public.profiles_plano_do_servidor() from public, anon;
revoke all on function public.cuidador_acessos_somente_leitura() from public, anon;
grant execute on function public.limite_pets(text) to authenticated;
grant execute on function public.somente_leitura(pets) to authenticated;
-- Os gatilhos rodam como o tutor (invoker) e chamam a checagem.
grant execute on function public.exigir_pet_editavel(uuid) to authenticated;

-- ============================================================
-- Painel admin (Usuários): a contagem inclui os pets só para consulta
-- ============================================================
create or replace function public.admin_usuarios(p_busca text default null, p_limite int default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_busca text := nullif(trim(coalesce(p_busca, '')), '');
begin
  perform public.admin_exigir(array['suporte', 'moderacao', 'leitura']);
  return coalesce((
    select jsonb_agg(linha order by (linha ->> 'criado_em') desc)
    from (
      select jsonb_build_object(
        'id', u.id,
        'nome', coalesce(p.nome, split_part(u.email, '@', 1)),
        'email', u.email,
        'plano', coalesce(p.plano, 'free'),
        'pets', coalesce((select string_agg(pt.nome, ', ' order by pt.criado_em) from pets pt where pt.tutor_id = u.id and pt.ativo), ''),
        'pets_total', (select count(*) from pets pt where pt.tutor_id = u.id and pt.ativo),
        'pets_somente_leitura', (select count(*) from pets pt where pt.tutor_id = u.id and public.somente_leitura(pt)),
        'criado_em', u.created_at,
        'ultimo_acesso', u.last_sign_in_at,
        'suspenso', coalesce(u.banned_until > now(), false)
      ) as linha
      from auth.users u
      left join profiles p on p.id = u.id
      where v_busca is null
         or u.email ilike '%' || v_busca || '%'
         or p.nome ilike '%' || v_busca || '%'
         or exists (select 1 from pets pt where pt.tutor_id = u.id and pt.nome ilike '%' || v_busca || '%')
      order by u.created_at desc
      limit least(greatest(coalesce(p_limite, 50), 1), 200)
    ) t
  ), '[]'::jsonb);
end;
$$;

/** Ficha do tutor: cada pet diz se está em memória ou só para consulta. */
create or replace function public.admin_usuario(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte', 'moderacao', 'leitura']);
  return (
    select jsonb_build_object(
      'id', u.id,
      'nome', coalesce(p.nome, split_part(u.email, '@', 1)),
      'email', u.email,
      'plano', coalesce(p.plano, 'free'),
      'criado_em', u.created_at,
      'ultimo_acesso', u.last_sign_in_at,
      'suspenso', coalesce(u.banned_until > now(), false),
      'pets', coalesce((
        select jsonb_agg(jsonb_build_object(
          'nome', pt.nome, 'especie', pt.especie, 'raca', pt.raca,
          'em_memoria', pt.em_memoria, 'somente_leitura', public.somente_leitura(pt)
        ) order by pt.criado_em)
        from pets pt where pt.tutor_id = u.id and pt.ativo
      ), '[]'::jsonb),
      'vacinas', (select count(*) from vaccinations v join pets pt on pt.id = v.pet_id where pt.tutor_id = u.id),
      'lembretes_ativos', (select count(*) from reminders r where r.tutor_id = u.id and r.ativo),
      'remedios', (select count(*) from medications m join pets pt on pt.id = m.pet_id where pt.tutor_id = u.id),
      'lugares_salvos', (select count(*) from saved_places s where s.user_id = u.id),
      'indicacoes', (select count(*) from sugestoes_lugar s where s.user_id = u.id),
      'pedidos_lgpd', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', l.tipo, 'status', l.status, 'criado_em', l.criado_em) order by l.criado_em desc)
        from lgpd_requests l where l.user_id = u.id
      ), '[]'::jsonb)
    )
    from auth.users u
    left join profiles p on p.id = u.id
    where u.id = p_id
  );
end;
$$;
