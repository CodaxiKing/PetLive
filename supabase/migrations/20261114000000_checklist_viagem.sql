-- PetLive: checklist de viagem (BUSINESS.md 5.26, tela Viagem). A lista vem
-- do conteúdo mestre (carro, avião ou os dois); itens ligados a dados do app
-- (antirrábica) se marcam sozinhos. Regras das companhias aéreas são só
-- referência, com data de revisão e link oficial: o app sempre manda
-- confirmar com a companhia e o destino. Lista e PDF (PDF no Premium).

create table public.viagem_itens (
  id uuid primary key default gen_random_uuid(),
  modo text not null check (modo in ('carro', 'aviao', 'ambos')),
  titulo text not null check (char_length(titulo) between 3 and 80),
  detalhe text check (char_length(detalhe) <= 120),
  -- Item que o app marca sozinho a partir dos dados do pet.
  automatico text check (automatico in ('antirrabica')),
  ordem int not null default 0,
  ativo boolean not null default true,
  revisado_em date
);
alter table public.viagem_itens enable row level security;
revoke all on public.viagem_itens from anon, authenticated;
grant select on public.viagem_itens to authenticated;
create policy "viagem_itens: leitura" on public.viagem_itens for select to authenticated using (ativo);

insert into public.viagem_itens (modo, titulo, detalhe, automatico, ordem) values
  ('ambos', 'Carteira de vacinação em dia', 'Antirrábica válida', 'antirrabica', 10),
  ('aviao', 'Atestado de saúde do veterinário', 'Confira o prazo exigido pela companhia', null, 20),
  ('aviao', 'Caixa de transporte aprovada', 'Medidas da companhia', null, 30),
  ('aviao', 'Regras da companhia aérea', 'Peso, raça e tipo de cabine', null, 40),
  ('carro', 'Caixa de transporte ou cinto para pet', 'Pet preso e seguro no banco de trás', null, 30),
  ('carro', 'Paradas no caminho', 'Para água, xixi e esticar as patas', null, 40),
  ('ambos', 'Comida, água e remédios', null, null, 50),
  ('ambos', 'Coleira com plaquinha e contato', 'Telefone atualizado', null, 60),
  ('ambos', 'Endereço de uma clínica no destino', 'Para alguma emergência', null, 70);

create table public.companhias_aereas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  regras text check (char_length(regras) <= 600),
  link text not null,
  revisado_em date
);
alter table public.companhias_aereas enable row level security;
revoke all on public.companhias_aereas from anon, authenticated;
grant select on public.companhias_aereas to authenticated;
create policy "companhias_aereas: leitura" on public.companhias_aereas for select to authenticated using (true);

-- Só o link oficial: o resumo das regras entra pelo painel, com a data da revisão.
insert into public.companhias_aereas (nome, link) values
  ('Azul', 'https://www.voeazul.com.br'),
  ('GOL', 'https://www.voegol.com.br'),
  ('LATAM', 'https://www.latamairlines.com/br/pt');

-- Listas salvas do tutor.
create table public.viagens (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  pet_id uuid not null references public.pets (id) on delete cascade,
  modo text not null check (modo in ('carro', 'aviao')),
  destino text check (char_length(destino) <= 80),
  data date,
  companhia_id uuid references public.companhias_aereas (id) on delete set null,
  marcados uuid[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index viagens_pet on public.viagens (pet_id, criado_em desc);
alter table public.viagens enable row level security;
revoke all on public.viagens from anon;
grant select, insert, update, delete on public.viagens to authenticated;
create policy "viagens: tutor lê" on public.viagens for select to authenticated using (tutor_id = auth.uid());
create policy "viagens: tutor cria" on public.viagens for insert to authenticated
  with check (tutor_id = auth.uid() and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()));
create policy "viagens: tutor muda" on public.viagens for update to authenticated
  using (tutor_id = auth.uid())
  with check (tutor_id = auth.uid() and exists (select 1 from public.pets p where p.id = pet_id and p.tutor_id = auth.uid()));
create policy "viagens: tutor apaga" on public.viagens for delete to authenticated using (tutor_id = auth.uid());

-- ============================================================
-- Conteúdo mestre (painel): itens e companhias. Super e marketing editam.
-- ============================================================
create or replace function public.admin_viagem()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['financeiro', 'suporte', 'moderacao', 'marketing', 'leitura']);
  return jsonb_build_object(
    'itens', coalesce((select jsonb_agg(to_jsonb(i) order by i.ordem) from viagem_itens i), '[]'::jsonb),
    'companhias', coalesce((select jsonb_agg(to_jsonb(c) order by c.nome) from companhias_aereas c), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_viagem_item_salvar(p_id uuid, p_modo text, p_titulo text, p_detalhe text, p_ordem int, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing']);
  if p_id is null then
    insert into viagem_itens (modo, titulo, detalhe, ordem, ativo, revisado_em)
    values (p_modo, trim(p_titulo), nullif(trim(coalesce(p_detalhe, '')), ''), coalesce(p_ordem, 100), coalesce(p_ativo, true), current_date);
  else
    update viagem_itens set modo = p_modo, titulo = trim(p_titulo), detalhe = nullif(trim(coalesce(p_detalhe, '')), ''),
      ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo), revisado_em = current_date
    where id = p_id;
  end if;
  perform public.admin_registrar('editou o checklist de viagem', 'conteudo', trim(p_titulo), '{}'::jsonb);
end;
$$;

create or replace function public.admin_companhia_salvar(p_id uuid, p_nome text, p_regras text, p_link text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['marketing']);
  if coalesce(p_link, '') !~ '^https://' then raise exception 'Use o link oficial (https://).'; end if;
  if p_id is null then
    insert into companhias_aereas (nome, regras, link, revisado_em)
    values (trim(p_nome), nullif(trim(coalesce(p_regras, '')), ''), trim(p_link), current_date);
  else
    update companhias_aereas set nome = trim(p_nome), regras = nullif(trim(coalesce(p_regras, '')), ''), link = trim(p_link), revisado_em = current_date
    where id = p_id;
  end if;
  perform public.admin_registrar('revisou as regras da companhia', 'conteudo', trim(p_nome), '{}'::jsonb);
end;
$$;

revoke all on function public.admin_viagem() from public, anon;
revoke all on function public.admin_viagem_item_salvar(uuid, text, text, text, int, boolean) from public, anon;
revoke all on function public.admin_companhia_salvar(uuid, text, text, text) from public, anon;
grant execute on function public.admin_viagem() to authenticated;
grant execute on function public.admin_viagem_item_salvar(uuid, text, text, text, int, boolean) to authenticated;
grant execute on function public.admin_companhia_salvar(uuid, text, text, text) to authenticated;
