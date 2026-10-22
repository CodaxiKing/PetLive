-- PetLive: despesas do pet (BUSINESS.md 5.32, telas Despesas e NovaDespesa).
-- Só registro: o PetLive não paga nem cobra nada aqui. Dados privados do
-- tutor. O recibo (opcional) vai para o bucket privado `anexos`, na pasta do
-- tutor, e é apagado com a conta (lgpd-delete).

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Null = despesa de todos os pets.
  pet_id uuid references public.pets (id) on delete set null,
  categoria text not null check (categoria in ('racao', 'veterinario', 'banho_tosa', 'remedios', 'acessorios', 'hotel_creche', 'outros')),
  valor_centavos int not null check (valor_centavos between 1 and 100000000),
  data date not null default current_date,
  anotacao text check (char_length(anotacao) <= 200),
  recibo_path text,
  criado_em timestamptz not null default now()
);
create index despesas_tutor_data on public.despesas (tutor_id, data desc);

alter table public.despesas enable row level security;
revoke all on public.despesas from anon;
grant select, insert, update, delete on public.despesas to authenticated;

create policy "despesas: tutor lê as suas" on public.despesas
  for select to authenticated using (tutor_id = auth.uid());
create policy "despesas: tutor cria as suas" on public.despesas
  for insert to authenticated
  with check (
    tutor_id = auth.uid()
    and (pet_id is null or exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()))
    and (recibo_path is null or recibo_path like auth.uid()::text || '/%')
  );
create policy "despesas: tutor edita as suas" on public.despesas
  for update to authenticated
  using (tutor_id = auth.uid())
  with check (
    tutor_id = auth.uid()
    and (pet_id is null or exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()))
    and (recibo_path is null or recibo_path like auth.uid()::text || '/%')
  );
create policy "despesas: tutor apaga as suas" on public.despesas
  for delete to authenticated using (tutor_id = auth.uid());

comment on table public.despesas is 'Gastos do tutor com os pets (só registro).';

-- ============================================================
-- Exportação LGPD: despesas, links da carteirinha e acessos de cuidador
-- ============================================================
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
    )
  );
end;
$$;

revoke all on function public.exportar_meus_dados() from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
