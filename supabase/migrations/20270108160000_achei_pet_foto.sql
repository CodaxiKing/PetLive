-- Achei um pet: reconhecer por foto (BUSINESS.md 5.38). Quem achou fotografa o
-- pet; a Edge Function find-lost-pet compara a foto só com as fotos de alertas
-- ativos por perto, cujo tutor aceitou esse uso. A foto de quem buscou não é
-- guardada: vai só para o serviço de comparação. A busca (região aproximada e
-- candidatos) é apagada em 24 horas. A função só abre quando o admin liga a
-- recurso 'achei_foto' (Sistema), depois de medir a precisão.

alter table public.lost_alerts add column if not exists reconhecimento boolean not null default false;

create table if not exists public.achei_buscas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lat numeric(6,3) not null,
  lng numeric(6,3) not null,
  status text not null default 'reservada' check (status in ('reservada', 'concluida', 'falhou')),
  candidatos jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists achei_buscas_user on public.achei_buscas (user_id, criado_em);
alter table public.achei_buscas enable row level security;
revoke all on public.achei_buscas from public, anon, authenticated;

-- Liga e desliga a busca por foto pelo admin (Sistema), sem publicar o app. Começa desligada.
insert into public.recursos (chave, nome, descricao, ligado, ordem) values
  ('achei_foto', 'Achei um pet por foto', 'Quem achou um pet compara a foto com alertas de pets perdidos por perto. Ligar só depois de medir a precisão.', false, 40)
on conflict (chave) do nothing;

-- O tutor aceita o uso da foto do pet na busca ao criar o alerta.
drop function if exists public.perdido_alertar(uuid, double precision, double precision, timestamptz, int, text, boolean);
create or replace function public.perdido_alertar(p_pet_id uuid, p_lat double precision, p_lng double precision,
  p_visto_em timestamptz default now(), p_raio int default 2, p_mensagem text default null, p_mostrar_telefone boolean default false,
  p_reconhecimento boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_tutor uuid;
  v_avisados int;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select tutor_id into v_tutor from public.pets where id = p_pet_id and ativo and not em_memoria;
  if v_tutor is null or not public.is_pet_owner(p_pet_id) then raise exception 'Este pet não está disponível nesta conta.' using errcode = '42501'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Marque onde o pet foi visto pela última vez.' using errcode = '22023';
  end if;
  if p_raio not in (1, 2, 5, 10) then raise exception 'Escolha um raio disponível.' using errcode = '22023'; end if;
  if p_visto_em is null or p_visto_em > now() + interval '5 minutes' or p_visto_em < now() - interval '7 days' then
    raise exception 'Confira quando o pet foi visto.' using errcode = '22023';
  end if;
  if exists (select 1 from public.lost_alerts where pet_id = p_pet_id and status = 'ativo') then
    raise exception 'Este pet já tem um alerta ativo.' using errcode = '23505';
  end if;
  -- Limite contra abuso: até 3 alertas ativos e 5 por mês por conta.
  if (select count(*) from public.lost_alerts where tutor_id = v_tutor and status = 'ativo') >= 3
     or (select count(*) from public.lost_alerts where tutor_id = v_tutor and criado_em > now() - interval '30 days') >= 5 then
    raise exception 'Limite de alertas atingido. Fale com o suporte se precisar de outro.' using errcode = '23514';
  end if;
  insert into public.lost_alerts (pet_id, tutor_id, lat, lng, raio_km, visto_em, mensagem, mostrar_telefone, reconhecimento)
  values (p_pet_id, v_tutor, p_lat, p_lng, p_raio, p_visto_em, nullif(left(btrim(coalesce(p_mensagem, '')), 300), ''),
          coalesce(p_mostrar_telefone, false), coalesce(p_reconhecimento, false))
  returning id into v_id;
  v_avisados := public.perdido_enviar(v_id);
  return jsonb_build_object('id', v_id, 'avisados', v_avisados);
end;
$$;

-- Reserva uma busca (limite de 5 por dia) e devolve os alertas que podem ser comparados:
-- ativos, com foto, com o aceite do tutor, a até 15 km, no máximo 8 (os mais perto).
create or replace function public.achei_reservar(p_lat double precision, p_lng double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_alertas jsonb;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if not coalesce((select ligado from recursos where chave = 'achei_foto'), false) then
    raise exception 'A busca por foto ainda não está disponível.' using errcode = '55000', hint = 'desligada';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Autorize a localização para buscar alertas perto de você.' using errcode = '22023';
  end if;
  if (select count(*) from achei_buscas where user_id = auth.uid() and criado_em > now() - interval '1 day') >= 5 then
    raise exception 'Você chegou ao limite de buscas de hoje. Abra os alertas perto de você no app.' using errcode = '23514', hint = 'limite';
  end if;
  select coalesce(jsonb_agg(x order by x.distancia_km), '[]'::jsonb) into v_alertas from (
    select a.id as alert_id, p.nome, p.especie, p.foto_url, a.visto_em,
           round(public.perdido_distancia_km(p_lat, p_lng, a.lat, a.lng)::numeric, 1) as distancia_km
    from lost_alerts a join pets p on p.id = a.pet_id
    where a.status = 'ativo' and a.expira_em > now() and a.reconhecimento and p.foto_url is not null
      and a.tutor_id <> auth.uid()
      and public.perdido_distancia_km(p_lat, p_lng, a.lat, a.lng) <= 15
    order by public.perdido_distancia_km(p_lat, p_lng, a.lat, a.lng)
    limit 8
  ) x;
  insert into achei_buscas (user_id, lat, lng) values (auth.uid(), round(p_lat::numeric, 3), round(p_lng::numeric, 3)) returning id into v_id;
  return jsonb_build_object('id', v_id, 'alertas', v_alertas);
end;
$$;

-- Guarda os candidatos com o nível em palavras (sem porcentagem).
create or replace function public.achei_concluir(p_id uuid, p_ok boolean, p_candidatos jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update achei_buscas set status = case when p_ok then 'concluida' else 'falhou' end,
    candidatos = case when p_ok then (
      select coalesce(jsonb_agg(jsonb_build_object('alert_id', c->>'alert_id', 'nivel', c->>'nivel')), '[]'::jsonb)
      from jsonb_array_elements(coalesce(p_candidatos, '[]'::jsonb)) c
      where c->>'nivel' in ('muito_parecido', 'parecido', 'pouco_parecido')) end
  where id = p_id and user_id = auth.uid() and status = 'reservada';
  -- Busca que falhou não conta no limite do dia.
  if not p_ok then delete from achei_buscas where id = p_id and user_id = auth.uid(); end if;
end;
$$;

-- Apaga as buscas com mais de 24 horas.
create or replace function public.achei_limpar()
returns int language sql security definer set search_path = public as $$
  with apagadas as (delete from achei_buscas where criado_em < now() - interval '24 hours' returning 1)
  select count(*)::int from apagadas;
$$;

revoke all on function public.achei_limpar() from public, anon, authenticated;
revoke all on function public.achei_reservar(double precision, double precision), public.achei_concluir(uuid, boolean, jsonb) from public, anon;
revoke all on function public.perdido_alertar(uuid, double precision, double precision, timestamptz, int, text, boolean, boolean) from public, anon;
grant execute on function public.achei_reservar(double precision, double precision), public.achei_concluir(uuid, boolean, jsonb),
  public.perdido_alertar(uuid, double precision, double precision, timestamptz, int, text, boolean, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('achei-limpar') where exists (select 1 from cron.job where jobname = 'achei-limpar');
    perform cron.schedule('achei-limpar', '17 * * * *', 'select public.achei_limpar()');
  end if;
end $$;
