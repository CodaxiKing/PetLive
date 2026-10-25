begin;

-- email_change é a solicitação pendente. Somente email é a identidade efetiva.
create or replace function public.sincronizar_email_confirmado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function public.sincronizar_email_confirmado() from public, anon, authenticated;
drop trigger if exists sincronizar_email_confirmado on auth.users;
create trigger sincronizar_email_confirmado after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.sincronizar_email_confirmado();

commit;
