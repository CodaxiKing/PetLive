-- QR da coleira: quem achou o pet envia a localização ao tutor (BUSINESS.md 5.6
-- e fluxo 19.12). Só quando a pessoa toca no botão e o navegador libera a
-- posição. O tutor vê o local no app; os locais somem em 30 dias.
create table if not exists public.qr_localizacoes (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  precisao_m int check (precisao_m between 0 and 100000),
  mensagem text check (char_length(mensagem) <= 200),
  criado_em timestamptz not null default now()
);
create index if not exists qr_localizacoes_pet on public.qr_localizacoes (pet_id, criado_em desc);
alter table public.qr_localizacoes enable row level security;
revoke all on public.qr_localizacoes from public, anon, authenticated;
grant select on public.qr_localizacoes to authenticated;
drop policy if exists "qr_localizacoes: quem cuida do pet lê" on public.qr_localizacoes;
create policy "qr_localizacoes: quem cuida do pet lê" on public.qr_localizacoes
  for select to authenticated using (public.is_pet_owner(pet_id));

create or replace function public.qr_enviar_localizacao(p_codigo text, p_lat double precision, p_lng double precision,
  p_precisao int default null, p_mensagem text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  q public.pet_qr_settings;
  p public.pets;
  v_ip text;
  v_chave text;
  v_total int;
  v_id uuid;
  v_dest uuid;
begin
  -- Até 5 envios por hora por origem, sem guardar o IP em claro.
  v_ip := coalesce(split_part(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ',', 1), 'local');
  v_chave := encode(digest(v_ip || 'petlive-qr-local', 'sha256'), 'hex');
  insert into public.qr_limites (chave, janela, total) values (v_chave, date_trunc('hour', now()), 1)
  on conflict (chave) do update set janela = excluded.janela,
    total = case when qr_limites.janela = excluded.janela then qr_limites.total + 1 else 1 end
  returning total into v_total;
  if v_total > 5 then return jsonb_build_object('limite', true); end if;

  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('enviado', false, 'motivo', 'posicao');
  end if;
  select * into q from public.pet_qr_settings where code = p_codigo and active;
  select * into p from public.pets where id = q.pet_id and ativo and not em_memoria;
  if p.id is null then return jsonb_build_object('enviado', false, 'motivo', 'qr'); end if;

  insert into public.qr_localizacoes (pet_id, lat, lng, precisao_m, mensagem)
  values (p.id, p_lat, p_lng, least(greatest(coalesce(p_precisao, 0), 0), 100000),
          nullif(left(btrim(coalesce(p_mensagem, '')), 200), ''))
  returning id into v_id;

  -- O titular e quem divide a guarda (com o Premium do titular) recebem o aviso.
  for v_dest in
    select p.tutor_id
    union
    select m.user_id from public.pet_members m join public.profiles pr on pr.id = p.tutor_id
    where m.pet_id = p.id and pr.plano = 'premium'
  loop
    insert into public.notification_log (user_id, pet_id, type, title, body, deep_link)
    values (v_dest, p.id, 'sistema', 'Acharam o ' || p.nome,
            'Alguém escaneou o QR da coleira e enviou a localização. Toque para ver no mapa.',
            '/pet/' || p.id || '/achado');
  end loop;
  return jsonb_build_object('enviado', true);
end;
$$;

revoke all on function public.qr_enviar_localizacao(text, double precision, double precision, int, text) from public;
grant execute on function public.qr_enviar_localizacao(text, double precision, double precision, int, text) to anon, authenticated;

-- Localização é dado sensível: fica só 30 dias.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('petlive-qr-localizacoes-retencao') where exists (select 1 from cron.job where jobname = 'petlive-qr-localizacoes-retencao');
    perform cron.schedule('petlive-qr-localizacoes-retencao', '50 6 * * *',
      $job$ delete from public.qr_localizacoes where criado_em < now() - interval '30 days' $job$);
  end if;
end $$;

notify pgrst, 'reload schema';
