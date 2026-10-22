-- PetLive: os links (carteirinha, ficha de emergência e cuidador) levam
-- também os novos contatos do tutor: se o celular tem WhatsApp, a cidade e o
-- contato de emergência. Só aparecem quando o tutor libera o telefone ou os
-- contatos, como antes.

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
    v_conteudo := v_conteudo || jsonb_build_object('tutor', jsonb_build_object(
      'nome', v_tutor.nome, 'telefone', v_tutor.telefone, 'whatsapp', v_tutor.whatsapp, 'cidade', v_tutor.cidade,
      'emergencia_nome', v_tutor.contato_emergencia_nome, 'emergencia_telefone', v_tutor.contato_emergencia_telefone
    ));
  end if;

  v_codigo := translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_');
  v_expira := now() + make_interval(hours => least(greatest(coalesce(p_horas, 24), 1), 72));
  insert into carteirinha_links (codigo, pet_id, tutor_id, secoes, conteudo, expira_em, tipo, lugar_id, canal)
  values (v_codigo, v_pet.id, auth.uid(), v_secoes, v_conteudo, v_expira, p_tipo, p_lugar, p_canal);
  return jsonb_build_object('codigo', v_codigo, 'expira_em', v_expira, 'reaproveitada', false);
end;
$$;

create or replace function public.cuidador_visao(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a cuidador_acessos := public.cuidador_acesso_valido(p_codigo);
  v_fuso text;
  v_hoje date;
  v_tutor profiles;
begin
  if a.id is null then return jsonb_build_object('valido', false); end if;
  update cuidador_acessos set aberturas = aberturas + 1, ultima_abertura_em = now() where id = a.id;
  -- Uma linha de registro por hora basta (a página recarrega sozinha).
  if not exists (select 1 from cuidador_registros where acesso_id = a.id and acao = 'abriu' and criado_em > now() - interval '1 hour') then
    insert into cuidador_registros (acesso_id, acao) values (a.id, 'abriu');
  end if;

  v_fuso := coalesce((select fuso from notification_settings where tutor_id = a.tutor_id), 'America/Sao_Paulo');
  v_hoje := (now() at time zone v_fuso)::date;
  select * into v_tutor from profiles where id = a.tutor_id;

  return jsonb_build_object(
    'valido', true,
    'cuidador', a.cuidador,
    'tutor', jsonb_build_object(
      'nome', v_tutor.nome,
      'telefone', case when a.ver_contatos then v_tutor.telefone end,
      'whatsapp', case when a.ver_contatos then v_tutor.whatsapp end,
      'emergencia_nome', case when a.ver_contatos then v_tutor.contato_emergencia_nome end,
      'emergencia_telefone', case when a.ver_contatos then v_tutor.contato_emergencia_telefone end
    ),
    'fim', a.fim,
    'ver', jsonb_build_object('vacinas', a.ver_vacinas, 'remedios', a.ver_remedios, 'contatos', a.ver_contatos),
    'pets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'especie', p.especie, 'sexo', p.sexo, 'foto_url', p.foto_url,
        'alergias', case when a.ver_contatos then p.alergias end,
        'veterinario', case when a.ver_contatos then p.veterinario end,
        'vacinas', case when a.ver_vacinas then coalesce((
          select jsonb_agg(jsonb_build_object('nome', v.nome, 'proxima_dose', v.proxima_dose) order by v.aplicada_em desc)
          from (select distinct on (nome) * from vaccinations where pet_id = p.id order by nome, aplicada_em desc) v
        ), '[]'::jsonb) end,
        'vermifugo', case when a.ver_vacinas then (select max(aplicado_em) from dewormings where pet_id = p.id) end,
        'doses', case when a.ver_remedios then coalesce((
          select jsonb_agg(jsonb_build_object(
            'medication_id', m.id, 'nome', m.nome, 'dose', m.dose, 'prevista_para', prev.instante,
            'confirmada_em', d.confirmada_em, 'confirmada_por', case when d.origem = 'cuidador' then d.confirmada_por else 'o tutor' end
          ) order by prev.instante)
          from medications m
          cross join lateral unnest(m.horarios) as h(hora)
          cross join lateral (select ((v_hoje + h.hora) at time zone v_fuso) as instante) prev
          left join medication_doses d on d.medication_id = m.id and d.prevista_para = prev.instante
          where m.pet_id = p.id and m.ativo and m.inicio <= v_hoje and (m.fim is null or m.fim >= v_hoje)
        ), '[]'::jsonb) end
      ) order by p.nome)
      from pets p where p.id = any (a.pet_ids) and p.ativo
    ), '[]'::jsonb)
  );
end;
$$;
