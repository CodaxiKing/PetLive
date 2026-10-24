-- O tutor edita dados pessoais, mas não concede plano/papel pela API.
-- Cadastro e alterações de benefício continuam a cargo do servidor confiável.
begin;

alter table public.profiles enable row level security;

-- Grants de tabela e de coluna são cumulativos; revogar ambos é necessário.
revoke insert, update, truncate, references, trigger on public.profiles from public, anon, authenticated;
do $$
declare
  todas text;
  editaveis text;
begin
  select string_agg(quote_ident(attname), ',' order by attnum) into todas
  from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%s), update (%s), references (%s) on public.profiles from public, anon, authenticated', todas, todas, todas);

  -- Somente colunas presentes: funciona também nos schemas de produção antigos.
  select string_agg(quote_ident(attname), ',' order by attnum) into editaveis
  from pg_attribute where attrelid='public.profiles'::regclass and attnum>0 and not attisdropped
    and attname = any(array['nome','telefone','avatar_url','aceite_termos','aceite_termos_em',
      'notificacoes_ativas','fuso_horario','cidade','whatsapp',
      'contato_emergencia_nome','contato_emergencia_telefone']);
  if editaveis is not null then
    execute format('grant update (%s) on public.profiles to authenticated', editaveis);
  end if;
end $$;

grant select on public.profiles to authenticated;
drop policy if exists "profiles: dados pessoais leitura" on public.profiles;
create policy "profiles: dados pessoais leitura" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles: dados pessoais edicao" on public.profiles;
create policy "profiles: dados pessoais edicao" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Mantém o isolamento mesmo se houver uma policy permissiva antiga.
drop policy if exists "profiles: limite conta autenticada" on public.profiles;
create policy "profiles: limite conta autenticada" on public.profiles as restrictive
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

notify pgrst, 'reload schema';
commit;
