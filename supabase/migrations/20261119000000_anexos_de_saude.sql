-- PetLive: anexos de saúde do pet (P-B7CbI): foto do cartão de vacina e de
-- exames. Os arquivos ficam no bucket privado `anexos`, na pasta do tutor
-- (`<uid>/anexos/<pet>/<arquivo>`), e só abrem por URL assinada. Privados do
-- tutor: não entram na carteirinha por link nem no acesso do cuidador.

create table public.anexos (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo text not null check (tipo in ('vacina', 'exame')),
  titulo text check (char_length(titulo) <= 80),
  data date not null default current_date,
  arquivo_path text not null,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/heic')),
  criado_em timestamptz not null default now()
);
create index anexos_pet_data on public.anexos (pet_id, data desc, criado_em desc);

alter table public.anexos enable row level security;
revoke all on public.anexos from anon;
grant select, insert, update, delete on public.anexos to authenticated;

create policy "anexos: tutor lê os seus" on public.anexos
  for select to authenticated using (tutor_id = auth.uid());
create policy "anexos: tutor cria nos seus pets" on public.anexos
  for insert to authenticated
  with check (
    tutor_id = auth.uid()
    and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid())
    and arquivo_path like auth.uid()::text || '/anexos/%'
  );
create policy "anexos: tutor edita os seus" on public.anexos
  for update to authenticated
  using (tutor_id = auth.uid())
  with check (
    tutor_id = auth.uid()
    and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid())
    and arquivo_path like auth.uid()::text || '/anexos/%'
  );
create policy "anexos: tutor apaga os seus" on public.anexos
  for delete to authenticated using (tutor_id = auth.uid());

-- O bucket recusa arquivo acima de 10 MB e o que não for imagem. Fica em
-- `image/*` porque o mesmo bucket guarda recibos e fotos da linha do tempo,
-- que sobem com o mime do seletor (pode vir HEIF ou WebP da galeria). A regra
-- de só JPG, PNG e HEIC dos anexos de saúde fica no check de `anexos.mime`
-- e no app, que normaliza o tipo antes de subir.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/*']
where id = 'anexos';

-- Exportação LGPD: inclui os anexos de saúde (metadados e o caminho do arquivo).
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
    ),
    'anexos_de_saude', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'pet', p.nome, 'tipo', case an.tipo when 'vacina' then 'Cartão de vacina' else 'Exame' end,
        'titulo', an.titulo, 'data', an.data, 'arquivo', an.arquivo_path, 'enviado_em', an.criado_em
      ) order by an.data), '[]'::jsonb)
      from public.anexos an join public.pets p on p.id = an.pet_id
      where an.tutor_id = v_tutor
    )
  );
end;
$$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
