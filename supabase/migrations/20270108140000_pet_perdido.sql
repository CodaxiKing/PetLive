-- Pet perdido (BUSINESS.md 5.29 e fluxo 19.22): o tutor dispara um alerta com o
-- último lugar visto e um raio; quem permitiu avisos e está na região recebe o
-- alerta uma vez; quem viu avisa sem expor o telefone; o QR mostra "procurado".

alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check
  check (type in ('lembrete', 'vacina', 'dose', 'peso', 'sistema', 'campanha', 'guarda', 'perdido'));

-- Região aproximada (2 casas, ~1 km) de quem quer receber alertas por perto. Vale 7 dias.
create table if not exists public.perdidos_regioes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  lat numeric(5, 2) not null check (lat between -90 and 90),
  lng numeric(5, 2) not null check (lng between -180 and 180),
  atualizado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days'
);
alter table public.perdidos_regioes enable row level security;
revoke all on public.perdidos_regioes from public, anon, authenticated;

create table if not exists public.lost_alerts (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null references public.profiles (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  raio_km int not null default 2 check (raio_km in (1, 2, 5, 10)),
  visto_em timestamptz not null,
  mensagem text check (char_length(mensagem) <= 300),
  mostrar_telefone boolean not null default false,
  status text not null default 'ativo' check (status in ('ativo', 'encontrado', 'encerrado', 'expirado')),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '7 days',
  encerrado_em timestamptz
);
create unique index if not exists lost_alerts_um_ativo_por_pet on public.lost_alerts (pet_id) where status = 'ativo';
create index if not exists lost_alerts_ativos on public.lost_alerts (status, expira_em);
alter table public.lost_alerts enable row level security;
revoke all on public.lost_alerts from public, anon, authenticated;
grant select on public.lost_alerts to authenticated;
drop policy if exists "lost_alerts: quem cuida do pet lê" on public.lost_alerts;
create policy "lost_alerts: quem cuida do pet lê" on public.lost_alerts
  for select to authenticated using (public.is_pet_owner(pet_id));

create table if not exists public.lost_alert_sightings (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.lost_alerts (id) on delete cascade,
  autor_id uuid references public.profiles (id) on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  visto_em timestamptz not null default now(),
  mensagem text check (char_length(mensagem) <= 300),
  foto_path text,
  com_a_pessoa boolean not null default false,
  origem text not null default 'app' check (origem in ('app', 'qr')),
  criado_em timestamptz not null default now()
);
create index if not exists lost_alert_sightings_alerta on public.lost_alert_sightings (alert_id, criado_em desc);
alter table public.lost_alert_sightings enable row level security;
revoke all on public.lost_alert_sightings from public, anon, authenticated;
-- Sem autor_id: o tutor nunca sabe quem avisou.
grant select (id, alert_id, lat, lng, visto_em, mensagem, foto_path, com_a_pessoa, origem, criado_em) on public.lost_alert_sightings to authenticated;
-- O tutor vê os avistamentos do alerta.
drop policy if exists "lost_alert_sightings: quem cuida do pet lê" on public.lost_alert_sightings;
create policy "lost_alert_sightings: quem cuida do pet lê" on public.lost_alert_sightings
  for select to authenticated using (exists (select 1 from public.lost_alerts a where a.id = alert_id and public.is_pet_owner(a.pet_id)));

-- Quem já recebeu cada alerta (para não repetir).
create table if not exists public.lost_alert_receipts (
  alert_id uuid not null references public.lost_alerts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (alert_id, user_id)
);
alter table public.lost_alert_receipts enable row level security;
revoke all on public.lost_alert_receipts from public, anon, authenticated;

-- Fotos de quem viu: privadas, lidas pelo tutor por link temporário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avistamentos', 'avistamentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;
drop policy if exists "avistamentos: enviar própria foto" on storage.objects;
create policy "avistamentos: enviar própria foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'avistamentos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avistamentos: tutor do alerta lê" on storage.objects;
create policy "avistamentos: tutor do alerta lê" on storage.objects for select to authenticated
  using (bucket_id = 'avistamentos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.lost_alert_sightings s join public.lost_alerts a on a.id = s.alert_id
               where s.foto_path = name and public.is_pet_owner(a.pet_id))));

-- Distância em km entre dois pontos (haversine).
create or replace function public.perdido_distancia_km(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
       + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)))
$$;

create or replace function public.perdido_regiao_configurar(p_ativo boolean, p_lat numeric default null, p_lng numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  if not coalesce(p_ativo, false) then
    delete from public.perdidos_regioes where user_id = auth.uid();
    return jsonb_build_object('ativo', false);
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Região inválida.' using errcode = '22023';
  end if;
  insert into public.perdidos_regioes (user_id, lat, lng) values (auth.uid(), round(p_lat, 2), round(p_lng, 2))
  on conflict (user_id) do update set lat = excluded.lat, lng = excluded.lng, atualizado_em = now(), expira_em = now() + interval '7 days';
  return jsonb_build_object('ativo', true, 'expira_em', now() + interval '7 days');
end;
$$;

create or replace function public.perdido_regiao_consultar()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('ativo', expira_em > now(), 'expira_em', expira_em, 'atualizado_em', atualizado_em)
                   from public.perdidos_regioes where user_id = auth.uid()), jsonb_build_object('ativo', false))
$$;

-- Avisa quem está no raio, uma vez por pessoa. Devolve quantas pessoas recebeu.
create or replace function public.perdido_enviar(p_alert uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  a public.lost_alerts;
  p public.pets;
  v_total int := 0;
  v_dest uuid;
begin
  select * into a from public.lost_alerts where id = p_alert and status = 'ativo';
  if a.id is null then return 0; end if;
  select * into p from public.pets where id = a.pet_id;
  for v_dest in
    select r.user_id from public.perdidos_regioes r
    where r.expira_em > now()
      and r.user_id <> a.tutor_id
      and not exists (select 1 from public.pet_members m where m.pet_id = a.pet_id and m.user_id = r.user_id)
      -- Silenciar = desligar a região em Avisos (a linha some).
      and public.perdido_distancia_km(r.lat::float8, r.lng::float8, a.lat, a.lng) <= a.raio_km + 0.8
  loop
    insert into public.lost_alert_receipts (alert_id, user_id) values (a.id, v_dest) on conflict do nothing;
    if found then
      insert into public.notification_log (user_id, pet_id, type, title, body, deep_link)
      values (v_dest, a.pet_id, 'perdido', 'Pet perdido perto de você',
              p.nome || coalesce(', ' || nullif(btrim(p.raca), ''), '') || ' sumiu perto da sua região. Se vir, toque para avisar o tutor.',
              '/alerta/' || a.id);
      v_total := v_total + 1;
    end if;
  end loop;
  return v_total;
end;
$$;

create or replace function public.perdido_alertar(p_pet_id uuid, p_lat double precision, p_lng double precision,
  p_visto_em timestamptz default now(), p_raio int default 2, p_mensagem text default null, p_mostrar_telefone boolean default false)
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
  insert into public.lost_alerts (pet_id, tutor_id, lat, lng, raio_km, visto_em, mensagem, mostrar_telefone)
  values (p_pet_id, v_tutor, p_lat, p_lng, p_raio, p_visto_em, nullif(left(btrim(coalesce(p_mensagem, '')), 300), ''), coalesce(p_mostrar_telefone, false))
  returning id into v_id;
  v_avisados := public.perdido_enviar(v_id);
  return jsonb_build_object('id', v_id, 'avisados', v_avisados);
end;
$$;

-- O alerta para quem recebeu ou abriu o link: só o que ajuda a reconhecer o pet.
create or replace function public.perdido_alerta(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a public.lost_alerts;
  p public.pets;
  v_dono boolean;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.' using errcode = '42501'; end if;
  select * into a from public.lost_alerts where id = p_id;
  if a.id is null then return jsonb_build_object('encontrado', false); end if;
  v_dono := public.is_pet_owner(a.pet_id);
  if a.status <> 'ativo' and not v_dono then
    return jsonb_build_object('encontrado', true, 'status', a.status);
  end if;
  select * into p from public.pets where id = a.pet_id;
  return jsonb_build_object(
    'encontrado', true, 'id', a.id, 'status', a.status, 'dono', v_dono,
    'pet', jsonb_build_object('id', p.id, 'nome', p.nome, 'especie', p.especie, 'raca', p.raca, 'foto_url', p.foto_url, 'cor', p.cor_etiqueta),
    'lat', a.lat, 'lng', a.lng, 'raio_km', a.raio_km, 'visto_em', a.visto_em, 'mensagem', a.mensagem,
    'telefone', case when a.mostrar_telefone then (select telefone from public.profiles where id = a.tutor_id) end,
    'criado_em', a.criado_em, 'expira_em', a.expira_em,
    'avistamentos', case when v_dono then (select count(*) from public.lost_alert_sightings where alert_id = a.id) end
  );
end;
$$;

-- Avisa os responsáveis do pet sobre um avistamento (titular e quem divide a guarda).
create or replace function public.perdido_avisar_tutor(p_alert uuid, p_titulo text, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.lost_alerts;
  v_dest uuid;
begin
  select * into a from public.lost_alerts where id = p_alert;
  for v_dest in
    select a.tutor_id
    union
    select m.user_id from public.pet_members m join public.profiles pr on pr.id = a.tutor_id where m.pet_id = a.pet_id and pr.plano = 'premium'
  loop
    insert into public.notification_log (user_id, pet_id, type, title, body, deep_link)
    values (v_dest, a.pet_id, 'perdido', p_titulo, p_texto, '/pet-perdido/' || a.id);
  end loop;
end;
$$;

create or replace function public.perdido_avistar(p_alert uuid, p_lat double precision, p_lng double precision,
  p_visto_em timestamptz default now(), p_mensagem text default null, p_com_a_pessoa boolean default false, p_foto_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.lost_alerts;
  v_nome text;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta para avisar.' using errcode = '42501'; end if;
  select * into a from public.lost_alerts where id = p_alert and status = 'ativo';
  if a.id is null then raise exception 'Este alerta já foi encerrado.' using errcode = '22023'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Envie onde você viu o pet.' using errcode = '22023';
  end if;
  if p_foto_path is not null and split_part(p_foto_path, '/', 1) <> auth.uid()::text then
    raise exception 'Foto inválida.' using errcode = '22023';
  end if;
  if (select count(*) from public.lost_alert_sightings where autor_id = auth.uid() and criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos avisos seguidos. Aguarde um pouco.' using errcode = '23514';
  end if;
  insert into public.lost_alert_sightings (alert_id, autor_id, lat, lng, visto_em, mensagem, foto_path, com_a_pessoa, origem)
  values (a.id, auth.uid(), p_lat, p_lng, least(coalesce(p_visto_em, now()), now()),
          nullif(left(btrim(coalesce(p_mensagem, '')), 300), ''), p_foto_path, coalesce(p_com_a_pessoa, false), 'app');
  select nome into v_nome from public.pets where id = a.pet_id;
  perform public.perdido_avisar_tutor(a.id,
    case when p_com_a_pessoa then 'Acharam o ' || v_nome else 'Alguém viu o ' || v_nome end,
    case when p_com_a_pessoa then 'Uma pessoa está com o ' || v_nome || '. Toque para ver onde.' else 'Toque para ver no mapa onde ele foi visto.' end);
  return jsonb_build_object('enviado', true);
end;
$$;

create or replace function public.perdido_renovar(p_alert uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lost_alerts set expira_em = now() + interval '7 days'
  where id = p_alert and status = 'ativo' and tutor_id = auth.uid();
  if not found then raise exception 'Só o tutor renova um alerta ativo.' using errcode = '42501'; end if;
end;
$$;

-- Só o titular encerra (BUSINESS.md 5.29).
create or replace function public.perdido_encerrar(p_alert uuid, p_encontrado boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.lost_alerts set status = case when p_encontrado then 'encontrado' else 'encerrado' end, encerrado_em = now()
  where id = p_alert and status = 'ativo' and tutor_id = auth.uid();
  if not found then raise exception 'Só o tutor encerra um alerta ativo.' using errcode = '42501'; end if;
end;
$$;

create or replace function public.perdido_expirar() returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.lost_alerts set status = 'expirado', encerrado_em = now() where status = 'ativo' and expira_em <= now();
  get diagnostics v = row_count;
  delete from public.perdidos_regioes where expira_em <= now();
  return v;
end;
$$;

-- QR da coleira: pet com alerta ativo aparece como procurado; a localização enviada vira avistamento.
create or replace function public.qr_pet_publico(p_codigo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q pet_qr_settings; p pets; a lost_alerts; v_total int; v_ip text; v_chave text; v_dados jsonb; v_resposta jsonb;
begin
  v_ip := coalesce(split_part(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for', ',', 1), 'local');
  v_chave := encode(extensions.digest(v_ip || 'petlive-qr', 'sha256'), 'hex');
  insert into qr_limites(chave,janela,total) values(v_chave,date_trunc('hour',now()),1)
  on conflict(chave) do update set janela = excluded.janela,
    total = case when qr_limites.janela = excluded.janela then qr_limites.total + 1 else 1 end
  returning total into v_total;
  if v_total > 60 then return jsonb_build_object('limite',true); end if;
  select * into q from pet_qr_settings where code = p_codigo and active;
  select * into p from pets where id = q.pet_id and ativo and not em_memoria;
  if p.id is null then return jsonb_build_object('valido',false); end if;
  select * into a from lost_alerts where pet_id = p.id and status = 'ativo' and expira_em > now();
  v_dados := jsonb_build_object('nome',p.nome,'especie',p.especie);
  -- Pet procurado mostra a foto mesmo sem estar liberada no QR: ajuda a reconhecer.
  if q.show_photo or a.id is not null then v_dados := v_dados || jsonb_build_object('foto',p.foto_url); end if;
  if q.show_allergies then v_dados := v_dados || jsonb_build_object('alergias',p.alergias); end if;
  if q.show_phone or coalesce(a.mostrar_telefone, false) then
    v_dados := v_dados || jsonb_build_object('telefone',(select telefone from profiles where id = p.tutor_id));
  end if;
  v_resposta := jsonb_build_object('valido',true,'pet',v_dados);
  if a.id is not null then
    v_resposta := v_resposta || jsonb_build_object('procurado', jsonb_build_object('desde', a.visto_em, 'mensagem', a.mensagem));
  end if;
  return v_resposta;
end;
$$;

create or replace function public.perdido_qr_avistamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a public.lost_alerts;
  v_nome text;
begin
  select * into a from public.lost_alerts where pet_id = new.pet_id and status = 'ativo';
  if a.id is null then return new; end if;
  insert into public.lost_alert_sightings (alert_id, lat, lng, mensagem, origem) values (a.id, new.lat, new.lng, new.mensagem, 'qr');
  return new;
end;
$$;
drop trigger if exists perdido_qr_avistamento on public.qr_localizacoes;
create trigger perdido_qr_avistamento after insert on public.qr_localizacoes
  for each row execute function public.perdido_qr_avistamento();

revoke all on function public.perdido_regiao_configurar(boolean, numeric, numeric), public.perdido_regiao_consultar(),
  public.perdido_alertar(uuid, double precision, double precision, timestamptz, int, text, boolean), public.perdido_alerta(uuid),
  public.perdido_avistar(uuid, double precision, double precision, timestamptz, text, boolean, text),
  public.perdido_renovar(uuid), public.perdido_encerrar(uuid, boolean) from public, anon;
revoke all on function public.perdido_enviar(uuid), public.perdido_expirar(), public.perdido_avisar_tutor(uuid, text, text) from public, anon, authenticated;
grant execute on function public.perdido_regiao_configurar(boolean, numeric, numeric), public.perdido_regiao_consultar(),
  public.perdido_alertar(uuid, double precision, double precision, timestamptz, int, text, boolean), public.perdido_alerta(uuid),
  public.perdido_avistar(uuid, double precision, double precision, timestamptz, text, boolean, text),
  public.perdido_renovar(uuid), public.perdido_encerrar(uuid, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-perdidos-expirar') where exists (select 1 from cron.job where jobname = 'petlive-perdidos-expirar');
    perform cron.schedule('petlive-perdidos-expirar', '15 * * * *', $job$ select public.perdido_expirar() $job$);
  end if;
end $$;

notify pgrst, 'reload schema';
