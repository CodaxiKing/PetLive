-- Somente com a fixture em banco descartável: prova a vulnerabilidade original.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','42000000-0000-4000-8000-000000000001',true);
update public.profiles set plano='premium',role='admin_super'
  where id='42000000-0000-4000-8000-000000000001';
do $$ begin
  if not exists(select 1 from public.profiles where id=auth.uid() and plano='premium' and role='admin_super') then
    raise exception 'Fixture não reproduziu a falha original';
  end if;
end $$;
rollback;
