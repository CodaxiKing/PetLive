-- Conteúdo mestre de cuidado (BUSINESS.md 5.39 e 5.40): textos e contatos do
-- apoio ao luto, tabela de idade sênior e textos da escala de qualidade de
-- vida, editados pelo admin com o nome de quem revisou. O app lê daqui e usa
-- o texto embutido se não conseguir carregar. As 7 chaves da escala são fixas
-- (as notas já salvas dependem delas); só o rótulo e a pergunta mudam.

create table if not exists public.luto_recursos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('texto', 'contato')),
  titulo text not null check (char_length(titulo) between 2 and 80),
  texto text not null check (char_length(texto) between 2 and 500),
  link text check (link is null or link ~ '^(https://|tel:[0-9]+$)'),
  ordem int not null default 100,
  ativo boolean not null default true,
  revisado_por text check (char_length(revisado_por) <= 120),
  revisado_em date,
  atualizado_em timestamptz not null default now()
);
alter table public.luto_recursos enable row level security;
revoke all on public.luto_recursos from public, anon, authenticated;
grant select on public.luto_recursos to authenticated;
drop policy if exists luto_recursos_leitura on public.luto_recursos;
create policy luto_recursos_leitura on public.luto_recursos for select to authenticated using (ativo);

insert into public.luto_recursos (tipo, titulo, texto, link, ordem)
select * from (values
  ('texto', 'O que você sente é real', 'Perder um pet é perder um companheiro de todos os dias. Tristeza, saudade e até culpa são reações comuns. Não existe jeito certo nem prazo para passar por isso.', null::text, 10),
  ('texto', 'Um passo de cada vez', 'Guardar a coleira, olhar fotos ou mudar a rotina pode levar tempo. Faça no seu ritmo. Conversar com quem conheceu seu pet costuma ajudar.', null, 20),
  ('texto', 'Crianças e outros pets', 'Crianças entendem melhor com palavras simples e verdadeiras. Outros pets da casa também podem estranhar a ausência; manter a rotina deles traz segurança.', null, 30),
  ('contato', 'Se a tristeza estiver pesada demais', 'CVV, ligação gratuita, 24 horas: 188. Também atende por chat em cvv.org.br.', 'tel:188', 90)
) v(tipo, titulo, texto, link, ordem)
where not exists (select 1 from public.luto_recursos);

create table if not exists public.escala_itens (
  chave text primary key check (chave in ('dor', 'apetite', 'higiene', 'hidratacao', 'mobilidade', 'dias', 'felicidade')),
  rotulo text not null check (char_length(rotulo) between 2 and 40),
  pergunta text not null check (char_length(pergunta) between 2 and 160),
  ordem int not null,
  revisado_por text check (char_length(revisado_por) <= 120),
  revisado_em date
);
alter table public.escala_itens enable row level security;
revoke all on public.escala_itens from public, anon, authenticated;
grant select on public.escala_itens to authenticated;
drop policy if exists escala_itens_leitura on public.escala_itens;
create policy escala_itens_leitura on public.escala_itens for select to authenticated using (true);

insert into public.escala_itens (chave, rotulo, pergunta, ordem) values
  ('dor', 'Dor', '10 = sem sinais de dor; 0 = dor constante', 1),
  ('apetite', 'Apetite', '10 = come bem sozinho; 0 = não come', 2),
  ('higiene', 'Higiene', '10 = se mantém limpo; 0 = precisa de ajuda o tempo todo', 3),
  ('hidratacao', 'Hidratação', '10 = bebe água normalmente; 0 = não bebe', 4),
  ('mobilidade', 'Mobilidade', '10 = anda e levanta sem esforço; 0 = não se levanta', 5),
  ('dias', 'Dias bons e ruins', '10 = quase todos os dias são bons; 0 = quase todos ruins', 6),
  ('felicidade', 'Felicidade', '10 = interessado e brincalhão; 0 = apático', 7)
on conflict (chave) do nothing;

alter table public.idade_senior add column if not exists revisado_por text check (char_length(revisado_por) <= 120);
alter table public.idade_senior add column if not exists revisado_em date;

create or replace function public.admin_conteudo_cuidado()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_exigir(array['marketing', 'suporte', 'moderacao', 'financeiro', 'leitura']);
  return jsonb_build_object(
    'luto', coalesce((select jsonb_agg(to_jsonb(l) order by l.ordem, l.titulo) from luto_recursos l), '[]'::jsonb),
    'idade_senior', coalesce((select jsonb_agg(to_jsonb(i) order by i.especie, i.peso_min) from idade_senior i), '[]'::jsonb),
    'escala', coalesce((select jsonb_agg(to_jsonb(e) order by e.ordem) from escala_itens e), '[]'::jsonb)
  );
end;
$$;

-- Apoio ao luto: super e marketing editam, sempre com o nome de quem revisou.
create or replace function public.admin_luto_salvar(p_id uuid, p_tipo text, p_titulo text, p_texto text, p_link text, p_ordem int, p_ativo boolean, p_revisado_por text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.admin_exigir(array['marketing']);
  if char_length(btrim(coalesce(p_revisado_por, ''))) < 3 then raise exception 'Informe quem revisou o texto (nome e registro do profissional).'; end if;
  if p_tipo = 'contato' and coalesce(p_link, '') !~ '^(https://|tel:[0-9]+$)' then raise exception 'Contato precisa de telefone (tel:188) ou link https://.'; end if;
  if p_id is null then
    insert into luto_recursos (tipo, titulo, texto, link, ordem, ativo, revisado_por, revisado_em)
    values (p_tipo, btrim(p_titulo), btrim(p_texto), nullif(btrim(coalesce(p_link, '')), ''), coalesce(p_ordem, 100), coalesce(p_ativo, true), btrim(p_revisado_por), current_date)
    returning id into v_id;
  else
    update luto_recursos set tipo = p_tipo, titulo = btrim(p_titulo), texto = btrim(p_texto), link = nullif(btrim(coalesce(p_link, '')), ''),
      ordem = coalesce(p_ordem, ordem), ativo = coalesce(p_ativo, ativo), revisado_por = btrim(p_revisado_por), revisado_em = current_date, atualizado_em = now()
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Texto não encontrado.'; end if;
  end if;
  perform public.admin_registrar('editou o apoio ao luto', 'conteudo', btrim(p_titulo), jsonb_build_object('revisado_por', btrim(p_revisado_por)));
  return v_id;
end;
$$;

-- Idade sênior e escala são conteúdo de saúde: só o super edita, com revisão veterinária.
create or replace function public.admin_idade_senior_salvar(p_id bigint, p_anos int, p_descricao text, p_revisado_por text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_exigir(array[]::text[]);
  if char_length(btrim(coalesce(p_revisado_por, ''))) < 3 then raise exception 'Informe o veterinário que revisou (nome e CRMV).'; end if;
  if p_anos is null or p_anos not between 3 and 20 then raise exception 'A idade sênior deve ficar entre 3 e 20 anos.'; end if;
  update idade_senior set anos = p_anos, descricao = btrim(p_descricao), revisado_por = btrim(p_revisado_por), revisado_em = current_date where id = p_id;
  if not found then raise exception 'Faixa não encontrada.'; end if;
  perform public.admin_registrar('editou a idade sênior', 'conteudo', p_id::text, jsonb_build_object('anos', p_anos, 'revisado_por', btrim(p_revisado_por)));
end;
$$;

create or replace function public.admin_escala_item_salvar(p_chave text, p_rotulo text, p_pergunta text, p_revisado_por text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_exigir(array[]::text[]);
  if char_length(btrim(coalesce(p_revisado_por, ''))) < 3 then raise exception 'Informe o veterinário que revisou (nome e CRMV).'; end if;
  update escala_itens set rotulo = btrim(p_rotulo), pergunta = btrim(p_pergunta), revisado_por = btrim(p_revisado_por), revisado_em = current_date where chave = p_chave;
  if not found then raise exception 'Item da escala não encontrado.'; end if;
  perform public.admin_registrar('editou a escala de qualidade de vida', 'conteudo', p_chave, jsonb_build_object('revisado_por', btrim(p_revisado_por)));
end;
$$;

revoke all on function public.admin_conteudo_cuidado(), public.admin_luto_salvar(uuid, text, text, text, text, int, boolean, text),
  public.admin_idade_senior_salvar(bigint, int, text, text), public.admin_escala_item_salvar(text, text, text, text) from public, anon;
grant execute on function public.admin_conteudo_cuidado(), public.admin_luto_salvar(uuid, text, text, text, text, int, boolean, text),
  public.admin_idade_senior_salvar(bigint, int, text, text), public.admin_escala_item_salvar(text, text, text, text) to authenticated;
