-- PetLive: ficha de emergência (BUSINESS.md 5.37). Usa os mesmos links da
-- carteirinha, com o tipo 'emergencia': página em vermelho, a ficha ativa é
-- reaproveitada, o envio para uma clínica fica registrado (sem guardar o
-- número), o tutor é avisado quando abrem e cada link tem limite de acessos.

alter table public.carteirinha_links
  add column tipo text not null default 'carteirinha' check (tipo in ('carteirinha', 'emergencia')),
  -- Para onde foi: o lugar do mapa (place_id ou id do OSM) e o canal.
  add column lugar_id text,
  add column canal text check (canal in ('whatsapp', 'compartilhar', 'qr', 'copiar')),
  add column avisado_em timestamptz;

grant select (tipo, lugar_id, canal) on public.carteirinha_links to authenticated;

-- Aberturas por IP (com hash, sem guardar o IP): freia quem tenta códigos.
create table public.carteirinha_acessos (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  link_id uuid references public.carteirinha_links (id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index carteirinha_acessos_ip on public.carteirinha_acessos (ip_hash, criado_em desc);
alter table public.carteirinha_acessos enable row level security;
revoke all on public.carteirinha_acessos from anon, authenticated;

drop function public.criar_link_carteirinha(uuid, text[], int);

/**
 * Gera o link. p_tipo 'emergencia' reaproveita a ficha ativa do pet com as
 * mesmas seções (se ainda vale por mais de 2 h) e limita a 10 fichas por dia.
 */
create or replace function public.criar_link_carteirinha(
  p_pet uuid, p_secoes text[], p_horas int default 24,
  p_tipo text default 'carteirinha', p_lugar text default null, p_canal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets;
  v_tutor profiles;
  v_secoes text[];
  v_conteudo jsonb;
  v_codigo text;
  v_expira timestamptz;
  v_ativa carteirinha_links;
begin
  select * into v_pet from pets where id = p_pet and tutor_id = auth.uid() and ativo;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  if p_tipo not in ('carteirinha', 'emergencia') then raise exception 'Tipo inválido.'; end if;
  select array_agg(distinct s order by s) into v_secoes from unnest(coalesce(p_secoes, '{}')) s
  where s in ('dados', 'vacinas', 'alergias', 'remedios', 'saude', 'veterinario', 'observacoes', 'telefone');
  v_secoes := coalesce(v_secoes, '{}');

  if p_tipo = 'emergencia' then
    select * into v_ativa from carteirinha_links
    where pet_id = v_pet.id and tipo = 'emergencia' and cancelado_em is null
      and expira_em > now() + interval '2 hours' and secoes = v_secoes
    order by criado_em desc limit 1;
    if v_ativa.id is not null then
      update carteirinha_links set lugar_id = coalesce(p_lugar, lugar_id), canal = coalesce(p_canal, canal) where id = v_ativa.id;
      return jsonb_build_object('codigo', v_ativa.codigo, 'expira_em', v_ativa.expira_em, 'reaproveitada', true);
    end if;
    if (select count(*) from carteirinha_links where tutor_id = auth.uid() and tipo = 'emergencia' and criado_em > now() - interval '1 day') >= 10 then
      raise exception 'Muitas fichas hoje. Use a que já está ativa ou tente amanhã.';
    end if;
  end if;
  if (select count(*) from carteirinha_links where tutor_id = auth.uid() and criado_em > now() - interval '1 day') >= 30 then
    raise exception 'Muitos links hoje. Tente de novo amanhã.';
  end if;
  select * into v_tutor from profiles where id = auth.uid();

  v_conteudo := jsonb_build_object('nome', v_pet.nome, 'especie', v_pet.especie, 'foto_url', v_pet.foto_url);
  if 'dados' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object(
      'raca', v_pet.raca, 'nascimento', v_pet.nascimento, 'sexo', v_pet.sexo, 'peso', v_pet.peso_atual,
      'peso_em', (select max(medido_em) from weights where pet_id = v_pet.id)
    );
  end if;
  if 'vacinas' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object(
      'vacinas', coalesce((
        select jsonb_agg(jsonb_build_object('nome', nome, 'aplicada_em', aplicada_em, 'proxima_dose', proxima_dose)
          order by aplicada_em desc)
        from vaccinations where pet_id = v_pet.id
      ), '[]'::jsonb),
      'vermifugos', coalesce((
        select jsonb_agg(jsonb_build_object('produto', produto, 'aplicado_em', aplicado_em, 'proxima_dose', proxima_dose)
          order by aplicado_em desc)
        from (select * from dewormings where pet_id = v_pet.id order by aplicado_em desc limit 3) d
      ), '[]'::jsonb)
    );
  end if;
  if 'alergias' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('alergias', v_pet.alergias);
  end if;
  if 'remedios' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('remedios', coalesce((
      select jsonb_agg(jsonb_build_object('nome', nome, 'dose', dose, 'frequencia', frequencia, 'horarios', horarios, 'fim', fim)
        order by inicio desc)
      from medications
      where pet_id = v_pet.id and ativo and inicio <= current_date and (fim is null or fim >= current_date)
    ), '[]'::jsonb));
  end if;
  if 'saude' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('castrado', v_pet.castrado);
  end if;
  if 'veterinario' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('veterinario', v_pet.veterinario);
  end if;
  if 'observacoes' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('observacoes', v_pet.observacoes);
  end if;
  if 'telefone' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('tutor', jsonb_build_object('nome', v_tutor.nome, 'telefone', v_tutor.telefone));
  end if;

  v_codigo := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  v_expira := now() + make_interval(hours => least(greatest(coalesce(p_horas, 24), 1), 72));
  insert into carteirinha_links (codigo, pet_id, tutor_id, secoes, conteudo, expira_em, tipo, lugar_id, canal)
  values (v_codigo, v_pet.id, auth.uid(), v_secoes, v_conteudo, v_expira, p_tipo, p_lugar, p_canal);
  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_expira, 'reaproveitada', false);
end;
$$;

/**
 * Página pública. Vencido, cancelado, inexistente ou acima dos limites:
 * nenhum dado do pet. Limites: 100 aberturas por link e 60 por IP por hora.
 * Na primeira abertura (e no máximo uma vez por hora) o tutor é avisado.
 */
create or replace function public.carteirinha_publica(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link carteirinha_links;
  v_ip text := coalesce(
    split_part(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for', ',', 1),
    'sem-ip'
  );
  v_ip_hash text := encode(extensions.digest(v_ip || 'petlive-ficha', 'sha256'), 'hex');
  v_pet text;
  v_aviso uuid;
  v_token text;
  v_titulo text;
begin
  if (select count(*) from carteirinha_acessos where ip_hash = v_ip_hash and criado_em > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('valido', false);
  end if;

  update carteirinha_links set aberturas = aberturas + 1, ultima_abertura_em = now()
  where codigo = p_codigo and cancelado_em is null and expira_em > now() and aberturas < 100
  returning * into v_link;
  insert into carteirinha_acessos (ip_hash, link_id) values (v_ip_hash, v_link.id);
  if v_link.id is null then
    return jsonb_build_object('valido', false);
  end if;

  if v_link.avisado_em is null or v_link.avisado_em < now() - interval '1 hour' then
    update carteirinha_links set avisado_em = now() where id = v_link.id;
    v_pet := v_link.conteudo ->> 'nome';
    v_titulo := case when v_link.tipo = 'emergencia' then 'A ficha de emergência de ' else 'A carteirinha de ' end || v_pet || ' foi aberta';
    insert into notification_log (user_id, pet_id, type, title, body, deep_link)
    values (v_link.tutor_id, v_link.pet_id, 'sistema', v_titulo,
      'Alguém abriu o link que você enviou. Se não foi você quem mandou, cancele o link no app.',
      '/pet/' || v_link.pet_id || '/compartilhar')
    returning id into v_aviso;
    for v_token in select token from push_tokens where tutor_id = v_link.tutor_id and ativo loop
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object(
          'to', v_token, 'title', v_titulo, 'body', 'Toque para ver ou cancelar o link.', 'sound', 'default',
          'data', jsonb_build_object('tipo', 'ficha_aberta', 'url', '/pet/' || v_link.pet_id || '/compartilhar', 'aviso_id', v_aviso)
        ),
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    end loop;
  end if;

  return jsonb_build_object(
    'valido', true, 'tipo', v_link.tipo, 'conteudo', v_link.conteudo, 'secoes', to_jsonb(v_link.secoes),
    'criado_em', v_link.criado_em, 'expira_em', v_link.expira_em
  );
end;
$$;

/** Links vencidos há mais de 1 dia perdem o conteúdo (fica só o registro). */
create or replace function public.encerrar_links_vencidos()
returns void
language sql
security definer
set search_path = public
as $$
  update carteirinha_links set conteudo = '{}'::jsonb
  where (expira_em < now() - interval '1 day' or cancelado_em < now() - interval '1 day') and conteudo <> '{}'::jsonb;
  delete from carteirinha_acessos where criado_em < now() - interval '7 days';
$$;
revoke all on function public.encerrar_links_vencidos() from public, anon, authenticated;
select cron.schedule('petlive-links-vencidos', '17 4 * * *', $$select public.encerrar_links_vencidos();$$);

revoke all on function public.criar_link_carteirinha(uuid, text[], int, text, text, text) from public, anon;
grant execute on function public.criar_link_carteirinha(uuid, text[], int, text, text, text) to authenticated;
revoke all on function public.carteirinha_publica(text) from public;
grant execute on function public.carteirinha_publica(text) to anon, authenticated;
