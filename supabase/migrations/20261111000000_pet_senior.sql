-- PetLive: pet sênior e escala de qualidade de vida (BUSINESS.md 5.40, telas
-- PetIdoso, SeniorNotificacao, PetMia e QualidadeVida).
-- A idade sênior vem do conteúdo mestre (por espécie e porte, aqui pelo
-- peso); os valores iniciais seguem o BUSINESS.md e esperam a revisão
-- veterinária. Ao virar sênior, o app avisa e cria a rotina adaptada; o
-- tutor pode desligar cada lembrete, mas não a condição sênior.

create table public.idade_senior (
  id bigint generated always as identity primary key,
  especie text not null check (especie in ('cao', 'gato')),
  peso_min numeric not null default 0,
  peso_max numeric,
  anos int not null check (anos between 3 and 20),
  descricao text not null
);
alter table public.idade_senior enable row level security;
revoke all on public.idade_senior from anon, authenticated;
grant select on public.idade_senior to authenticated;
create policy "idade_senior: leitura" on public.idade_senior for select to authenticated using (true);

insert into public.idade_senior (especie, peso_min, peso_max, anos, descricao) values
  ('cao', 0, 10, 10, 'Cães pequenos (até 10 kg)'),
  ('cao', 10, 25, 8, 'Cães médios (10 a 25 kg)'),
  ('cao', 25, null, 7, 'Cães grandes (acima de 25 kg)'),
  ('gato', 0, null, 10, 'Gatos');

/** Idade (em anos) a partir da qual o pet é sênior. Sem peso, usa a faixa mais leve. */
create or replace function public.anos_senior(p_especie text, p_peso numeric)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select anos from idade_senior
  where especie = p_especie and (p_peso is null or (p_peso >= peso_min and (peso_max is null or p_peso < peso_max)))
  order by peso_min
  limit 1
$$;
grant execute on function public.anos_senior(text, numeric) to authenticated;

-- Quando o pet virou sênior aos olhos do app (aviso e rotina criados).
create table public.senior (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  desde date not null,
  avisado_em timestamptz not null default now()
);
alter table public.senior enable row level security;
revoke all on public.senior from anon, authenticated;
grant select on public.senior to authenticated;
create policy "senior: tutor vê o dos seus pets" on public.senior
  for select to authenticated
  using (exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()));

-- Itens da rotina adaptada (lembretes de origem 'rotina').
alter table public.reminders drop constraint reminders_rotina_item_check;
alter table public.reminders add constraint reminders_rotina_item_check check (
  rotina_item in ('antipulgas', 'vermifugo', 'banho', 'dentes', 'aniversario', 'senior_consulta', 'senior_pesagem', 'senior_exames')
);

/** Data em que o pet fica (ou ficou) sênior; null sem data de nascimento. */
create or replace function public.data_senior(p pets)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select (p.nascimento + make_interval(years => public.anos_senior(p.especie, p.peso_atual)))::date
  where p.nascimento is not null
$$;

/**
 * Marca o pet como sênior: avisa o tutor e cria a rotina adaptada (consulta a
 * cada 6 meses, pesagem todo dia 10, exames de rotina uma vez por ano).
 * Idempotente: roda no job diário e também quando o app abre a tela do pet.
 */
create or replace function public.marcar_senior(p_pet uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  p pets;
  v_desde date;
  v_fuso text;
  v_hoje date;
  v_nove time := '09:00';
  v_dia10 date;
  v_artigo text;
begin
  select * into p from pets where id = p_pet and ativo and not em_memoria;
  if p.id is null then return false; end if;
  v_desde := public.data_senior(p);
  if v_desde is null or v_desde > current_date then return false; end if;
  if exists (select 1 from senior where pet_id = p.id) then return true; end if;

  insert into senior (pet_id, desde) values (p.id, v_desde);
  v_fuso := coalesce((select fuso from notification_settings where tutor_id = p.tutor_id), 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  v_dia10 := (date_trunc('month', v_hoje) + interval '9 days')::date;
  if v_dia10 <= v_hoje then v_dia10 := (v_dia10 + interval '1 month')::date; end if;

  insert into reminders (tutor_id, pet_id, tipo, titulo, proxima_em, repetir, intervalo_dias, ativo, origem, rotina_item)
  values
    (p.tutor_id, p.id, 'consulta', 'Consulta de rotina de ' || p.nome, ((v_hoje + 14) + v_nove) at time zone v_fuso, 'customizado', 182, true, 'rotina', 'senior_consulta'),
    (p.tutor_id, p.id, 'outro', 'Pesar ' || p.nome, (v_dia10 + v_nove) at time zone v_fuso, 'mensal', null, true, 'rotina', 'senior_pesagem'),
    (p.tutor_id, p.id, 'outro', 'Exames de rotina de ' || p.nome || ' (pergunte ao veterinário quais)', ((v_hoje + 30) + v_nove) at time zone v_fuso, 'anual', null, true, 'rotina', 'senior_exames')
  on conflict (pet_id, rotina_item) do nothing;

  v_artigo := case when p.sexo = 'femea' then 'A ' else 'O ' end;
  perform public.avisar_tutor(p.tutor_id, p.id, 'sistema',
    v_artigo || p.nome || ' agora é sênior',
    'Ajustamos a rotina de cuidados para a idade. Toque para ver.',
    '/pet/' || p.id || '/senior');
  return true;
end;
$$;

/** O app pede ao abrir o pet (o tutor só marca os seus). */
create or replace function public.conferir_senior(p_pet uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pets where id = p_pet and tutor_id = auth.uid()) then return false; end if;
  return public.marcar_senior(p_pet);
end;
$$;
revoke all on function public.marcar_senior(uuid) from public, anon, authenticated;
revoke all on function public.conferir_senior(uuid) from public, anon;
grant execute on function public.conferir_senior(uuid) to authenticated;

create or replace function public.marcar_seniores_do_dia()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet uuid;
begin
  for v_pet in
    select p.id from pets p
    where p.ativo and not p.em_memoria and p.nascimento is not null
      and not exists (select 1 from senior s where s.pet_id = p.id)
      and public.data_senior(p) <= current_date
  loop
    perform public.marcar_senior(v_pet);
  end loop;
end;
$$;
revoke all on function public.marcar_seniores_do_dia() from public, anon, authenticated;
select cron.schedule('petlive-pet-senior', '0 12 * * *', $$select public.marcar_seniores_do_dia();$$);

-- ============================================================
-- Escala de qualidade de vida (7 itens de 0 a 10)
-- ============================================================
create table public.qualidade_vida (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  data date not null default current_date,
  notas jsonb not null,
  total int not null check (total between 0 and 70),
  observacao text check (char_length(observacao) <= 300),
  criado_em timestamptz not null default now(),
  constraint qualidade_vida_notas check (
    jsonb_typeof(notas) = 'object'
    and notas ?& array['dor', 'apetite', 'higiene', 'hidratacao', 'mobilidade', 'dias', 'felicidade']
  )
);
create index qualidade_vida_pet on public.qualidade_vida (pet_id, data desc);
alter table public.qualidade_vida enable row level security;
revoke all on public.qualidade_vida from anon;
grant select, insert, delete on public.qualidade_vida to authenticated;
create policy "qualidade_vida: tutor lê" on public.qualidade_vida for select to authenticated using (tutor_id = auth.uid());
create policy "qualidade_vida: tutor registra nos seus pets" on public.qualidade_vida
  for insert to authenticated
  with check (tutor_id = auth.uid() and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()));
create policy "qualidade_vida: tutor apaga" on public.qualidade_vida for delete to authenticated using (tutor_id = auth.uid());

-- Pet em memória sai da condição sênior (a faixa some); se reativar, volta pelo job.
create or replace function public.senior_sai_no_memorial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.em_memoria and not old.em_memoria then
    delete from senior where pet_id = new.id;
  end if;
  return new;
end;
$$;
create trigger pets_senior_memorial after update of em_memoria on public.pets
  for each row execute function public.senior_sai_no_memorial();

-- Exportação LGPD: inclui memorial e escala de qualidade de vida.
create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  return public.exportar_meus_dados_base() || jsonb_build_object(
    'consentimentos', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.registrado_em), '[]'::jsonb)
      from public.consentimentos c where c.tutor_id = v_tutor
    ),
    'pedidos_de_privacidade', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.criado_em), '[]'::jsonb)
      from public.lgpd_requests r where r.user_id = v_tutor
    ),
    'lugares_salvos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', pl.nome, 'endereco', pl.endereco, 'salvo_em', s.saved_at, 'google_place_id', s.google_place_id
      ) order by s.saved_at), '[]'::jsonb)
      from public.saved_places s
      left join public.places pl on pl.id = s.place_id
      where s.user_id = v_tutor
    ),
    'registros_de_uso', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'evento', e.evento, 'detalhes', e.props, 'quando', e.ocorreu_em
      ) order by e.ocorreu_em), '[]'::jsonb)
      from public.eventos_uso e where e.user_id = v_tutor
    ),
    'caixa_de_avisos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', n.type, 'titulo', n.title, 'texto', n.body, 'enviado_em', n.sent_at, 'lido_em', n.read_at
      ) order by n.sent_at), '[]'::jsonb)
      from public.notification_log n where n.user_id = v_tutor
    ),
    'despesas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'data', d.data, 'categoria', d.categoria, 'valor', d.valor_centavos / 100.0, 'pet', p.nome,
        'anotacao', d.anotacao, 'tem_recibo', d.recibo_path is not null
      ) order by d.data), '[]'::jsonb)
      from public.despesas d left join public.pets p on p.id = d.pet_id
      where d.tutor_id = v_tutor
    ),
    'links_compartilhados', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', l.tipo, 'secoes', l.secoes, 'criado_em', l.criado_em, 'expira_em', l.expira_em,
        'cancelado_em', l.cancelado_em, 'aberturas', l.aberturas
      ) order by l.criado_em), '[]'::jsonb)
      from public.carteirinha_links l where l.tutor_id = v_tutor
    ),
    'acessos_de_cuidador', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'cuidador', a.cuidador, 'inicio', a.inicio, 'fim', a.fim, 'revogado_em', a.revogado_em,
        'via_vacinas', a.ver_vacinas, 'via_remedios', a.ver_remedios, 'via_contatos', a.ver_contatos,
        'registros', (select coalesce(jsonb_agg(jsonb_build_object('acao', r.acao, 'detalhe', r.detalhe, 'quando', r.criado_em) order by r.criado_em), '[]'::jsonb)
                      from public.cuidador_registros r where r.acesso_id = a.id)
      ) order by a.criado_em), '[]'::jsonb)
      from public.cuidador_acessos a where a.tutor_id = v_tutor
    ),
    'linha_do_tempo', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pet', p.nome, 'data', m.data, 'titulo', m.titulo, 'descricao', m.descricao, 'tem_foto', m.foto_path is not null
      ) order by m.data), '[]'::jsonb)
      from public.marcos m join public.pets p on p.id = m.pet_id
      where m.tutor_id = v_tutor
    ),
    'memorial', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pet', p.nome, 'data_partida', me.data_partida, 'mensagem', me.mensagem, 'reativado_em', me.reativado_em
      )), '[]'::jsonb)
      from public.memorial me join public.pets p on p.id = me.pet_id
      where p.tutor_id = v_tutor
    ),
    'qualidade_de_vida', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pet', p.nome, 'data', q.data, 'notas', q.notas, 'total', q.total, 'observacao', q.observacao
      ) order by q.data), '[]'::jsonb)
      from public.qualidade_vida q join public.pets p on p.id = q.pet_id
      where q.tutor_id = v_tutor
    )
  );
end;
$$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
