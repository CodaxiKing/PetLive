begin;
-- Contatos antigos continuam válidos; novos envios exigem e-mail confirmado no formulário.
alter table public.adocao_contatos add column if not exists email_resposta text
  check(email_resposta is null or (char_length(email_resposta)<=254 and email_resposta ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
create index if not exists adocao_contatos_tutor_pet on public.adocao_contatos(tutor_id,pet_id);
create index if not exists adocao_contatos_tutor_data on public.adocao_contatos(tutor_id,criado_em);

create or replace function public.adocao_detalhe(p_tutor uuid,p_pet uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_pet jsonb; v_contato jsonb;
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if not public.adocao_pet_visivel(p_pet) then return null; end if;
  select jsonb_build_object('id',p.id,'nome',p.nome,'especie',p.especie,'nascimento',p.nascimento,
    'porte',p.porte,'sexo',p.sexo,'castrado',p.castrado,'vacinado',p.vacinado,'vermifugado',p.vermifugado,
    'descricao',p.descricao,'fotos',p.fotos,'criado_em',p.criado_em,'ong_nome',g.nome,'cidade',g.cidade,'bairro',g.bairro,
    'favorito',exists(select 1 from public.adocao_favoritos f where f.pet_id=p.id and f.tutor_id=p_tutor)) into v_pet
  from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where p.id=p_pet;
  select jsonb_build_object('id',c.id,'criado_em',c.criado_em) into v_contato
  from public.adocao_contatos c where c.tutor_id=p_tutor and c.pet_id=p_pet order by c.criado_em,c.id limit 1;
  return jsonb_build_object('pet',v_pet,'contato',v_contato);
end;
$$;

create or replace function public.adocao_enviar_interesse(p_tutor uuid,p_pet uuid,p_mensagem text,p_email text,p_concordo boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_contato public.adocao_contatos; v_email text:=lower(btrim(p_email)); v_mensagem text:=btrim(p_mensagem);
begin
  if auth.uid() is null or auth.uid() is distinct from p_tutor then raise exception 'Entre nesta conta.'; end if;
  if p_concordo is distinct from true then raise exception 'Confirme o compartilhamento com a ONG.'; end if;
  if v_mensagem is null or char_length(v_mensagem) not between 10 and 1000 then raise exception 'Escreva uma mensagem de 10 a 1000 caracteres.'; end if;
  if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Informe um e-mail válido para resposta.'; end if;
  -- Serializa envios da conta, inclusive para pets diferentes, e protege o limite diário.
  perform pg_advisory_xact_lock(hashtextextended(p_tutor::text,91209));
  perform 1 from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id
    where p.id=p_pet for share of p,g;
  if not public.adocao_pet_visivel(p_pet) then raise exception 'Este pet não está disponível para adoção. Atualize a lista.'; end if;
  if exists(select 1 from public.adocao_pets p join public.adocao_ongs g on g.id=p.ong_id where p.id=p_pet and g.responsavel_id=p_tutor) then
    raise exception 'Você já é responsável por este pet.';
  end if;
  select * into v_contato from public.adocao_contatos where tutor_id=p_tutor and pet_id=p_pet order by criado_em,id limit 1;
  if found then return jsonb_build_object('id',v_contato.id,'criado_em',v_contato.criado_em); end if;
  if (select count(*) from public.adocao_contatos where tutor_id=p_tutor and criado_em>now()-interval '24 hours')>=5 then
    raise exception 'Você já enviou cinco interesses nas últimas 24 horas. Tente mais tarde.';
  end if;
  insert into public.adocao_contatos(tutor_id,pet_id,mensagem,email_resposta)
    values(p_tutor,p_pet,v_mensagem,v_email) returning * into v_contato;
  return jsonb_build_object('id',v_contato.id,'criado_em',v_contato.criado_em);
end;
$$;
revoke all on function public.adocao_detalhe(uuid,uuid) from public,anon;
revoke all on function public.adocao_enviar_interesse(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.adocao_detalhe(uuid,uuid) to authenticated;
grant execute on function public.adocao_enviar_interesse(uuid,uuid,text,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
