-- Reconcilia links privados da carteirinha sem depender de migrations antigas.
begin;
create table if not exists public.carteirinha_links (
 id uuid primary key default gen_random_uuid(),codigo text not null unique,
 pet_id uuid not null references public.pets(id) on delete cascade,tutor_id uuid not null references public.profiles(id) on delete cascade,
 secoes text[] not null,conteudo jsonb not null,criado_em timestamptz not null default now(),expira_em timestamptz not null,
 cancelado_em timestamptz,aberturas int not null default 0,ultima_abertura_em timestamptz,
 tipo text not null default 'carteirinha' check(tipo in ('carteirinha','emergencia')),lugar_id text,canal text,
 avisado_em timestamptz
);
create index if not exists carteirinha_links_pet on public.carteirinha_links(pet_id,criado_em desc);
alter table public.carteirinha_links enable row level security;
revoke all on public.carteirinha_links from anon,authenticated;
grant select(id,codigo,pet_id,secoes,tipo,criado_em,expira_em,cancelado_em,aberturas,ultima_abertura_em) on public.carteirinha_links to authenticated;
drop policy if exists carteirinha_conta on public.carteirinha_links;
create policy carteirinha_conta on public.carteirinha_links for select to authenticated using(tutor_id=auth.uid());
drop policy if exists carteirinha_limite_conta on public.carteirinha_links;
create policy carteirinha_limite_conta on public.carteirinha_links as restrictive for select to authenticated using(tutor_id=auth.uid());
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
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select * into v_pet from pets where id = p_pet and tutor_id = auth.uid() and ativo and not coalesce(em_memoria,false) for update;
  if v_pet.id is null then
    raise exception 'Pet não encontrado.' using errcode = '42501';
  end if;
  if p_tipo is null or p_tipo not in ('carteirinha', 'emergencia') then raise exception 'Tipo inválido.'; end if;
  if p_canal is not null and p_canal not in ('whatsapp','compartilhar','qr','copiar') then raise exception 'Canal inválido.'; end if;
  if p_lugar is not null and not exists(select 1 from public.places where id=p_lugar) then raise exception 'Lugar indisponível. Envie a ficha sem vincular uma clínica.'; end if;
  select array_agg(distinct s order by s) into v_secoes from unnest(coalesce(p_secoes, '{}')) s
  where s in ('dados', 'vacinas', 'alergias', 'remedios', 'saude', 'veterinario', 'observacoes', 'telefone');
  v_secoes := coalesce(v_secoes, '{}');

  if p_tipo = 'emergencia' then
    select * into v_ativa from carteirinha_links
    where pet_id = v_pet.id and tipo = 'emergencia' and cancelado_em is null
      and expira_em > now() + interval '2 hours' and secoes = v_secoes
      and expira_em <= now()+make_interval(hours=>least(greatest(coalesce(p_horas,24),1),72))
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
    v_conteudo := v_conteudo || jsonb_build_object('veterinario', (to_jsonb(v_pet)->>'veterinario'));
  end if;
  if 'observacoes' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('observacoes', (to_jsonb(v_pet)->>'observacoes'));
  end if;
  if 'telefone' = any (v_secoes) then
    v_conteudo := v_conteudo || jsonb_build_object('tutor', jsonb_build_object(
      'nome', v_tutor.nome, 'telefone', v_tutor.telefone, 'whatsapp', v_tutor.whatsapp, 'cidade', v_tutor.cidade,
      'emergencia_nome', v_tutor.contato_emergencia_nome, 'emergencia_telefone', v_tutor.contato_emergencia_telefone
    ));
  end if;

  v_codigo := encode(extensions.gen_random_bytes(32), 'hex');
  v_expira := now() + make_interval(hours => least(greatest(coalesce(p_horas, 24), 1), 72));
  insert into carteirinha_links (codigo, pet_id, tutor_id, secoes, conteudo, expira_em, tipo, lugar_id, canal)
  values (v_codigo, v_pet.id, auth.uid(), v_secoes, v_conteudo, v_expira, p_tipo, p_lugar, p_canal);
  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_expira, 'reaproveitada', false);
end;
$$;

create table if not exists public.carteirinha_limites (
 ip_hash text not null,janela timestamptz not null,total int not null,primary key(ip_hash,janela)
);
alter table public.carteirinha_limites enable row level security;
revoke all on public.carteirinha_limites from public,anon,authenticated;
create or replace function public.cancelar_link_carteirinha(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 update public.carteirinha_links set cancelado_em=now(),conteudo='{}'::jsonb where id=p_id and tutor_id=auth.uid() and cancelado_em is null;
end; $$;
create or replace function public.carteirinha_publica(p_codigo text) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_link public.carteirinha_links;v_ip text;v_hash text;v_total int;
begin
 v_ip:=coalesce(split_part(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for',',',1),'sem-ip');
 v_hash:=encode(extensions.digest(v_ip||current_date::text||'petlive-ficha','sha256'),'hex');
 insert into public.carteirinha_limites(ip_hash,janela,total) values(v_hash,date_trunc('hour',now()),1)
 on conflict(ip_hash,janela) do update set total=carteirinha_limites.total+1 where carteirinha_limites.total<60 returning total into v_total;
 if v_total is null then return jsonb_build_object('valido',false); end if;
 update public.carteirinha_links l set aberturas=aberturas+1,ultima_abertura_em=now()
 where l.codigo=p_codigo and l.cancelado_em is null and l.expira_em>now() and l.aberturas<100
 and exists(select 1 from public.pets p where p.id=l.pet_id and p.tutor_id=l.tutor_id and p.ativo and not coalesce(p.em_memoria,false)) returning l.* into v_link;
 if v_link.id is null then return jsonb_build_object('valido',false); end if;
 return jsonb_build_object('valido',true,'tipo',v_link.tipo,'conteudo',v_link.conteudo,'secoes',to_jsonb(v_link.secoes),'criado_em',v_link.criado_em,'expira_em',v_link.expira_em);
exception when invalid_text_representation then return jsonb_build_object('valido',false);
end; $$;
create or replace function public.encerrar_links_vencidos() returns void language sql security definer set search_path=public as $$
 update public.carteirinha_links set conteudo='{}'::jsonb where (expira_em<now()-interval '1 day' or cancelado_em is not null) and conteudo<>'{}'::jsonb;
 delete from public.carteirinha_limites where janela<now()-interval '7 days';
$$;
revoke all on function public.encerrar_links_vencidos() from public,anon,authenticated;
grant execute on function public.encerrar_links_vencidos() to service_role;
do $$ begin
 if to_regnamespace('cron') is not null then perform cron.schedule('petlive-links-vencidos','17 4 * * *','select public.encerrar_links_vencidos();'); end if;
end $$;
revoke all on function public.criar_link_carteirinha(uuid,text[],int,text,text,text),public.cancelar_link_carteirinha(uuid) from public,anon;
grant execute on function public.criar_link_carteirinha(uuid,text[],int,text,text,text),public.cancelar_link_carteirinha(uuid) to authenticated;
revoke all on function public.carteirinha_publica(text) from public;
grant execute on function public.carteirinha_publica(text) to anon,authenticated;

do $$ begin
 if to_regprocedure('public.exportar_meus_dados_sem_carteirinha_reparada()') is null then alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_carteirinha_reparada; end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_carteirinha_reparada() from public,anon,authenticated;
create or replace function public.exportar_meus_dados() returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 return public.exportar_meus_dados_sem_carteirinha_reparada()||jsonb_build_object('carteirinha_links',coalesce((select jsonb_agg(to_jsonb(l)-'codigo' order by l.criado_em,l.id) from public.carteirinha_links l where l.tutor_id=auth.uid()),'[]'::jsonb));
end; $$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;
commit;
