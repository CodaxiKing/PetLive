-- PetLive: linha do tempo do pet (BUSINESS.md 5.25, tela LinhaDoTempo).
-- Marcos manuais (texto e foto opcional) mais os automáticos: chegada,
-- aniversários, vacinas, consultas e pesagens. Privada do tutor. Fotos no
-- bucket privado `anexos`. Plano grátis: até 10 fotos (`[x]` do BUSINESS.md 10,
-- decidido aqui e fácil de mudar na função abaixo).

create table public.marcos (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  data date not null,
  titulo text not null check (char_length(titulo) between 2 and 80),
  descricao text check (char_length(descricao) <= 200),
  foto_path text,
  criado_em timestamptz not null default now()
);
create index marcos_pet_data on public.marcos (pet_id, data desc);

alter table public.marcos enable row level security;
revoke all on public.marcos from anon;
grant select, insert, update, delete on public.marcos to authenticated;

create policy "marcos: tutor lê os seus" on public.marcos
  for select to authenticated using (tutor_id = auth.uid());
create policy "marcos: tutor cria nos seus pets" on public.marcos
  for insert to authenticated
  with check (
    tutor_id = auth.uid()
    and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid())
    and (foto_path is null or foto_path like auth.uid()::text || '/%')
  );
create policy "marcos: tutor edita os seus" on public.marcos
  for update to authenticated
  using (tutor_id = auth.uid())
  with check (
    tutor_id = auth.uid()
    and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid())
    and (foto_path is null or foto_path like auth.uid()::text || '/%')
  );
create policy "marcos: tutor apaga os seus" on public.marcos
  for delete to authenticated using (tutor_id = auth.uid());

/** Limite de fotos do plano grátis (conta todos os pets do tutor). */
create or replace function public.marcos_limite_fotos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.foto_path is not null
    and (tg_op = 'INSERT' or old.foto_path is null)
    and coalesce((select plano from profiles where id = new.tutor_id), 'gratis') <> 'premium'
    and (select count(*) from marcos where tutor_id = new.tutor_id and foto_path is not null and id <> new.id) >= 10
  then
    raise exception 'No plano grátis a linha do tempo guarda até 10 fotos. Salve o marco sem foto ou assine o Premium.';
  end if;
  return new;
end;
$$;
create trigger marcos_limite_fotos before insert or update of foto_path on public.marcos
  for each row execute function public.marcos_limite_fotos();

/**
 * A linha do tempo do pet: marcos manuais e automáticos, do mais novo ao
 * mais antigo. RLS das tabelas de saúde já restringe ao dono (invoker).
 */
create or replace function public.linha_do_tempo(p_pet uuid)
returns table (
  id text, tipo text, data date, titulo text, descricao text, foto_path text, manual boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with pet as (select * from pets where pets.id = p_pet)
  select m.id::text, 'marco', m.data, m.titulo, m.descricao, m.foto_path, true
  from marcos m where m.pet_id = p_pet
  union all
  select 'chegada', 'chegada', pet.criado_em::date, 'Entrou no PetLive', 'O começo do registro de ' || pet.nome, null, false
  from pet
  union all
  select 'aniversario-' || n, 'aniversario', (pet.nascimento + make_interval(years => n))::date,
    case when n = 1 then '1 ano de vida' else n || ' anos de vida' end, null, null, false
  from pet, generate_series(1, 30) n
  where pet.nascimento is not null and pet.nascimento + make_interval(years => n) <= current_date
  union all
  select 'nascimento', 'nascimento', pet.nascimento, 'Nasceu', null, null, false
  from pet where pet.nascimento is not null
  union all
  select 'vacina-' || v.id, 'vacina', v.aplicada_em, 'Vacina ' || v.nome, nullif(v.local, ''), null, false
  from vaccinations v where v.pet_id = p_pet
  union all
  select 'consulta-' || c.id, 'consulta', c.realizada_em, coalesce(nullif(c.motivo, ''), 'Consulta'),
    nullif(concat_ws(' · ', nullif(c.local, ''), nullif(c.veterinario, '')), ''), null, false
  from visits c where c.pet_id = p_pet
  union all
  select 'peso-' || w.id, 'peso', w.medido_em, 'Pesou ' || replace(trim(to_char(w.peso, 'FM990D0')), '.', ',') || ' kg', null, null, false
  from weights w where w.pet_id = p_pet
  order by 3 desc, 7 desc
$$;
grant execute on function public.linha_do_tempo(uuid) to authenticated;

-- Exportação LGPD: inclui os marcos da linha do tempo.
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
    )
  );
end;
$$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
