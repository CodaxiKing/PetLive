begin;
-- Contas anteriores ao trigger podem existir sem profiles. Não altera perfis existentes,
-- não promove plano/papel e não inventa aceite de termos.
insert into public.profiles(id,nome,email,telefone,role,provider)
select u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data->>'nome'),''),
    nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
    nullif(btrim(u.raw_user_meta_data->>'name'),''),
    nullif(split_part(u.email,'@',1),''),'Tutor'),
  u.email,nullif(left(btrim(u.raw_user_meta_data->>'telefone'),20),''),'tutor',
  case when lower(u.raw_app_meta_data->>'provider') in ('email','google','apple')
    then lower(u.raw_app_meta_data->>'provider') else 'email' end
from auth.users u where not exists(select 1 from public.profiles p where p.id=u.id)
on conflict(id) do nothing;

-- Exclusão de conta usa o backend confiável/Auth, preservando a cascata LGPD.
-- Excluir só profiles deixaria uma sessão válida sem tutor e apagaria seus pets.
revoke delete on public.profiles from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
