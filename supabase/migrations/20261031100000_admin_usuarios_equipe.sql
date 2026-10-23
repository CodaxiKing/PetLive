create or replace function public.admin_usuario(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array['suporte', 'moderacao', 'leitura']);
  return (
    select jsonb_build_object(
      'id', u.id,
      'nome', coalesce(p.nome, split_part(u.email, '@', 1)),
      'email', u.email,
      'plano', coalesce(p.plano, 'free'),
      'criado_em', u.created_at,
      'ultimo_acesso', u.last_sign_in_at,
      'suspenso', coalesce(u.banned_until > now(), false),
      'pets', coalesce((
        select jsonb_agg(jsonb_build_object('nome', pt.nome, 'especie', pt.especie, 'raca', pt.raca) order by pt.criado_em)
        from pets pt where pt.tutor_id = u.id and pt.ativo
      ), '[]'::jsonb),
      'vacinas', (select count(*) from vaccinations v join pets pt on pt.id = v.pet_id where pt.tutor_id = u.id),
      'lembretes_ativos', (select count(*) from reminders r where r.tutor_id = u.id and r.ativo),
      'remedios', (select count(*) from medications m join pets pt on pt.id = m.pet_id where pt.tutor_id = u.id),
      'lugares_salvos', (select count(*) from saved_places s where s.user_id = u.id),
      'indicacoes', (select count(*) from sugestoes_lugar s where s.user_id = u.id),
      'pedidos_lgpd', coalesce((
        select jsonb_agg(jsonb_build_object('tipo', l.tipo, 'status', l.status, 'criado_em', l.criado_em) order by l.criado_em desc)
        from lgpd_requests l where l.user_id = u.id
      ), '[]'::jsonb)
    )
    from auth.users u
    left join profiles p on p.id = u.id
    where u.id = p_id
  );
end;
$$;

/** Suspender ou reativar a conta (super e moderação). Bloqueia o login. */
create or replace function public.admin_suspender(p_id uuid, p_suspender boolean, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.admin_exigir(array['moderacao']);
  if p_id = auth.uid() then
    raise exception 'Você não pode suspender a própria conta.';
  end if;
  if exists (select 1 from admin_members where user_id = p_id and ativo and papel = 'super')
     and public.admin_papel() <> 'super' then
    raise exception 'Só um super admin suspende outro super admin.';
  end if;
  update auth.users
     -- Data longe no futuro: o Auth (GoTrue) não entende 'infinity' e quebra o login.
     set banned_until = case when p_suspender then now() + interval '100 years' else null end
   where id = p_id;
  if not found then raise exception 'Conta não encontrada.'; end if;
  perform public.admin_registrar(
    case when p_suspender then 'suspendeu a conta' else 'reativou a conta' end,
    'usuario', p_id::text, jsonb_build_object('motivo', left(coalesce(p_motivo, ''), 300))
  );
end;
$$;

-- ============================================================
-- Equipe e auditoria (só super)
-- ============================================================

create or replace function public.admin_definir_membro(p_email text, p_papel text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  perform public.admin_exigir(array[]::text[]);
  if p_papel not in ('super', 'financeiro', 'suporte', 'moderacao', 'marketing', 'leitura') then
    raise exception 'Função inválida.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'Não há conta com esse e-mail. A pessoa precisa criar a conta no app ou no painel antes.';
  end if;
  insert into admin_members (user_id, papel, ativo, convidado_por)
  values (v_user, p_papel, true, auth.uid())
  on conflict (user_id) do update set papel = excluded.papel, ativo = true;
  perform public.admin_registrar('definiu a função ' || p_papel, 'admin', v_user::text, jsonb_build_object('email', p_email));
end;
$$;

create or replace function public.admin_remover_membro(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_exigir(array[]::text[]);
  if p_user = auth.uid() then
    raise exception 'Você não pode tirar a si mesmo da equipe.';
  end if;
  update admin_members set ativo = false where user_id = p_user;
  perform public.admin_registrar('tirou da equipe', 'admin', p_user::text);
end;
$$;

revoke all on function public.admin_usuario(uuid) from public, anon;
revoke all on function public.admin_suspender(uuid, boolean, text) from public, anon;
revoke all on function public.admin_definir_membro(text, text) from public, anon;
revoke all on function public.admin_remover_membro(uuid) from public, anon;
grant execute on function public.admin_usuario(uuid) to authenticated;
grant execute on function public.admin_suspender(uuid, boolean, text) to authenticated;
grant execute on function public.admin_definir_membro(text, text) to authenticated;
grant execute on function public.admin_remover_membro(uuid) to authenticated;