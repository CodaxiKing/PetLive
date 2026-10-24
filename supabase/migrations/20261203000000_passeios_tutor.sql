-- Passeios privados. O app persiste offline antes do envio; a versão evita
-- sobrescrever silenciosamente um passeio alterado por outro aparelho.
begin;
create table if not exists public.passeios_tutor (
  tutor_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  pet_id uuid references public.pets(id) on delete set null,
  dados jsonb not null,
  versao integer not null default 1 check (versao > 0),
  atualizado_em timestamptz not null default now(),
  primary key (tutor_id, id)
);
alter table public.passeios_tutor enable row level security;
drop policy if exists passeios_tutor_ler on public.passeios_tutor;
create policy passeios_tutor_ler on public.passeios_tutor for select to authenticated using(tutor_id = auth.uid());
revoke all on public.passeios_tutor from public, anon, authenticated;
grant select on public.passeios_tutor to authenticated;
grant all on public.passeios_tutor to service_role;

create or replace function public.passeios_encerrar_inativos(p_tutor uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_total integer;
begin
  update public.passeios_tutor set
    dados = dados || jsonb_build_object('status','concluido','fim',dados->'atualizadoEm','ativoDesde',null),
    versao = versao + 1, atualizado_em = now()
  where (p_tutor is null or tutor_id = p_tutor)
    and dados->>'status' = 'pausado'
    and (dados->>'atualizadoEm')::numeric < extract(epoch from now() - interval '8 hours') * 1000;
  get diagnostics v_total = row_count;
  return v_total;
end;
$$;
revoke all on function public.passeios_encerrar_inativos(uuid) from public,anon,authenticated;
grant execute on function public.passeios_encerrar_inativos(uuid) to service_role;

create or replace function public.passeios_preparar_sincronizacao(p_tutor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_tutor is distinct from auth.uid() then raise exception 'Entre nesta conta.'; end if;
  perform public.passeios_encerrar_inativos(auth.uid());
end;
$$;
revoke all on function public.passeios_preparar_sincronizacao(uuid) from public,anon;
grant execute on function public.passeios_preparar_sincronizacao(uuid) to authenticated;

create or replace function public.passeio_sincronizar(p_dados jsonb, p_versao integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tutor uuid := auth.uid(); v_id uuid; v_pet uuid; v_reg public.passeios_tutor;
  v_campo text; v_ponto jsonb; v_anterior numeric := -1; v_trecho numeric := -1;
  v_agora numeric := extract(epoch from now()) * 1000;
begin
  if v_tutor is null then raise exception 'Entre na sua conta.'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' or octet_length(p_dados::text) > 2500000
    or p_versao is null or p_versao < 0 then raise exception 'Dados de passeio inválidos.'; end if;
  if not (p_dados ?& array['id','tutorId','petId','nomePet','status','inicio','atualizadoEm','fim','ativoDesde','duracaoMs','distanciaM','trecho','pontos','anotacao'])
    or exists(select 1 from jsonb_object_keys(p_dados) k where k not in
      ('id','tutorId','petId','nomePet','status','inicio','atualizadoEm','fim','ativoDesde','duracaoMs','distanciaM','trecho','pontos','anotacao'))
    then raise exception 'Campos de passeio inválidos.'; end if;
  v_id := (p_dados->>'id')::uuid; v_pet := (p_dados->>'petId')::uuid;
  if (p_dados->>'tutorId')::uuid is distinct from v_tutor or v_id is null or v_pet is null
    or jsonb_typeof(p_dados->'nomePet') <> 'string' or char_length(p_dados->>'nomePet') not between 1 and 160
    or jsonb_typeof(p_dados->'anotacao') <> 'string' or char_length(p_dados->>'anotacao') > 1000
    or jsonb_typeof(p_dados->'status') <> 'string' or p_dados->>'status' not in ('pausado','concluido')
    or p_dados->'ativoDesde' <> 'null'::jsonb then raise exception 'Revise os dados do passeio.'; end if;
  foreach v_campo in array array['inicio','atualizadoEm','duracaoMs','distanciaM','trecho'] loop
    if jsonb_typeof(p_dados->v_campo) <> 'number' or (p_dados->>v_campo)::numeric not between 0 and 9007199254740991
      then raise exception 'Valor inválido: %',v_campo; end if;
  end loop;
  if (p_dados->>'inicio')::numeric <= 0 or (p_dados->>'atualizadoEm')::numeric < (p_dados->>'inicio')::numeric
    or (p_dados->>'atualizadoEm')::numeric > v_agora + 300000
    or (p_dados->>'duracaoMs')::numeric > (p_dados->>'atualizadoEm')::numeric - (p_dados->>'inicio')::numeric
    or (p_dados->>'trecho')::numeric <> trunc((p_dados->>'trecho')::numeric)
    then raise exception 'Horários de passeio inválidos.'; end if;
  if p_dados->>'status' = 'concluido' then
    if jsonb_typeof(p_dados->'fim') <> 'number' or (p_dados->>'fim')::numeric not between (p_dados->>'inicio')::numeric and (p_dados->>'atualizadoEm')::numeric
      then raise exception 'Finalização inválida.'; end if;
  elsif p_dados->'fim' <> 'null'::jsonb then raise exception 'Pause antes de enviar.'; end if;
  if jsonb_typeof(p_dados->'pontos') <> 'array' or jsonb_array_length(p_dados->'pontos') > 10000 then raise exception 'Trajeto inválido.'; end if;
  for v_ponto in select value from jsonb_array_elements(p_dados->'pontos') loop
    if jsonb_typeof(v_ponto) <> 'object' or not (v_ponto ?& array['lat','lng','instante','precisao','trecho'])
      or exists(select 1 from jsonb_object_keys(v_ponto) k where k not in ('lat','lng','instante','precisao','trecho')) then raise exception 'Ponto inválido.'; end if;
    foreach v_campo in array array['lat','lng','instante','precisao','trecho'] loop
      if jsonb_typeof(v_ponto->v_campo) <> 'number' then raise exception 'Ponto inválido.'; end if;
    end loop;
    if (v_ponto->>'lat')::numeric not between -90 and 90 or (v_ponto->>'lng')::numeric not between -180 and 180
      or (v_ponto->>'precisao')::numeric not between 0 and 35
      or (v_ponto->>'instante')::numeric not between (p_dados->>'inicio')::numeric and (p_dados->>'atualizadoEm')::numeric + 10000
      or (v_ponto->>'instante')::numeric <= v_anterior
      or (v_ponto->>'trecho')::numeric not between 0 and (p_dados->>'trecho')::numeric
      or (v_ponto->>'trecho')::numeric <> trunc((v_ponto->>'trecho')::numeric)
      or (v_ponto->>'trecho')::numeric < v_trecho then raise exception 'Coordenadas ou sequência inválidas.'; end if;
    v_anterior := (v_ponto->>'instante')::numeric; v_trecho := (v_ponto->>'trecho')::numeric;
  end loop;
  -- Serializa também duas primeiras inserções concorrentes do mesmo ID.
  perform pg_advisory_xact_lock(hashtextextended(v_tutor::text || v_id::text,0));
  select * into v_reg from public.passeios_tutor where tutor_id=v_tutor and id=v_id for update;
  if found then
    if v_reg.dados = p_dados then return jsonb_build_object('id',v_id,'versao',v_reg.versao,'dados',v_reg.dados); end if;
    if v_reg.versao <> p_versao then raise exception using errcode='40001',message='O passeio foi alterado em outro aparelho.'; end if;
    if v_reg.dados->>'petId' <> p_dados->>'petId' then raise exception 'Não é permitido trocar o pet do passeio.'; end if;
    if v_reg.dados->>'status' = 'concluido' and p_dados->>'status' <> 'concluido' then raise exception 'Passeio encerrado não pode ser reaberto.'; end if;
    update public.passeios_tutor set dados=p_dados,versao=versao+1,atualizado_em=now() where tutor_id=v_tutor and id=v_id returning * into v_reg;
  else
    if p_versao <> 0 then raise exception using errcode='40001',message='Versão de passeio inválida.'; end if;
    if exists(select 1 from public.pets where id=v_pet and tutor_id<>v_tutor) then raise exception 'Pet não pertence à conta.'; end if;
    -- Um pet removido offline pode não existir mais no cadastro. Mantém seu
    -- identificador/nome históricos no JSON, sem vincular dados de outra conta.
    select id into v_pet from public.pets where id=v_pet and tutor_id=v_tutor;
    insert into public.passeios_tutor(tutor_id,id,pet_id,dados) values(v_tutor,v_id,v_pet,p_dados) returning * into v_reg;
  end if;
  return jsonb_build_object('id',v_id,'versao',v_reg.versao,'dados',v_reg.dados);
end;
$$;
revoke all on function public.passeio_sincronizar(jsonb,integer) from public,anon;
grant execute on function public.passeio_sincronizar(jsonb,integer) to authenticated;

create or replace function public.passeios_apagar_nuvem(p_tutor uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_tutor is distinct from auth.uid() then raise exception 'Entre nesta conta.'; end if;
  delete from public.passeios_tutor where tutor_id = auth.uid();
end;
$$;
revoke all on function public.passeios_apagar_nuvem(uuid) from public,anon;
grant execute on function public.passeios_apagar_nuvem(uuid) to authenticated;

-- Mantém a exportação LGPD existente e acrescenta as cópias privadas dos passeios.
do $$ begin
  if to_regprocedure('public.exportar_meus_dados_sem_passeios()') is null then
    alter function public.exportar_meus_dados() rename to exportar_meus_dados_sem_passeios;
  end if;
end $$;
revoke all on function public.exportar_meus_dados_sem_passeios() from public,anon,authenticated;
create or replace function public.exportar_meus_dados()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  return public.exportar_meus_dados_sem_passeios() || jsonb_build_object('passeios_nuvem',
    (select coalesce(jsonb_agg(dados order by atualizado_em),'[]'::jsonb) from public.passeios_tutor where tutor_id=auth.uid()));
end;
$$;
revoke all on function public.exportar_meus_dados() from public,anon;
grant execute on function public.exportar_meus_dados() to authenticated;

-- Em instalações com pg_cron, encerra inativos a cada hora. A preparação da
-- sincronização também executa a regra para a conta, caso pg_cron esteja ausente.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if exists(select 1 from cron.job where jobname='passeios-encerrar-inativos') then
      perform cron.unschedule('passeios-encerrar-inativos');
    end if;
    perform cron.schedule('passeios-encerrar-inativos','0 * * * *','select public.passeios_encerrar_inativos();');
  end if;
end $$;
commit;
