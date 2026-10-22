-- PetLive: mais dados do tutor. O celular (com WhatsApp) passa a ser pedido no
-- cadastro e fica em Meus dados, junto com a cidade e um contato de
-- emergência. São os contatos que a carteirinha, a ficha de emergência e o
-- acesso de cuidador mostram quando o tutor libera.

alter table public.profiles
  add column cidade text check (char_length(cidade) <= 60),
  add column whatsapp boolean not null default true,
  add column contato_emergencia_nome text check (char_length(contato_emergencia_nome) <= 60),
  add column contato_emergencia_telefone text check (char_length(contato_emergencia_telefone) <= 20);

comment on column public.profiles.whatsapp is 'O celular do tutor recebe mensagens no WhatsApp (botão Chamar no WhatsApp das páginas por link).';

-- Cadastro: grava também o celular informado na tela Criar conta.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aceite_em timestamptz;
begin
  aceite_em := (new.raw_user_meta_data ->> 'aceite_termos_em')::timestamptz;

  insert into public.profiles (id, nome, email, telefone, aceite_termos, aceite_termos_em)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nome',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'telefone', '')), 20), ''),
    aceite_em is not null,
    aceite_em
  )
  on conflict (id) do nothing;

  if aceite_em is not null then
    insert into public.aceites_termos (user_id, termos_vigentes, versao, aceito_em)
    values (new.id, 'termos_de_uso', '1.0', aceite_em)
    on conflict do nothing;
  end if;

  return new;
end;
$$;
