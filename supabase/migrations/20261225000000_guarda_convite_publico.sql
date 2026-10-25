-- Página do link de convite da guarda compartilhada (BUSINESS.md 5.45), para
-- quem ainda não tem o app: mostra só quem convidou (primeiro nome), os nomes
-- e espécies dos pets e a validade. Nada de saúde, contato ou foto.
create or replace function public.guarda_convite_publico(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  c public.pet_invites;
  v_ip text;
  v_chave text;
  v_total int;
begin
  v_ip := coalesce(split_part(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ',', 1), 'local');
  v_chave := encode(digest(v_ip || 'petlive-convite', 'sha256'), 'hex');
  insert into public.qr_limites (chave, janela, total) values (v_chave, date_trunc('hour', now()), 1)
  on conflict (chave) do update set janela = excluded.janela,
    total = case when qr_limites.janela = excluded.janela then qr_limites.total + 1 else 1 end
  returning total into v_total;
  if v_total > 60 then return jsonb_build_object('limite', true); end if;

  if p_token is null or length(p_token) <> 48 then return jsonb_build_object('valido', false); end if;
  select * into c from public.pet_invites where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if c.id is null then return jsonb_build_object('valido', false); end if;

  return jsonb_build_object(
    'valido', true,
    'situacao', case when c.status = 'enviado' and c.expira_em <= now() then 'expirado' else c.status end,
    'titular', split_part(public.guarda_nome(c.titular_id), ' ', 1),
    'pets', coalesce((select jsonb_agg(jsonb_build_object('nome', p.nome, 'especie', p.especie) order by p.nome)
                      from public.pets p where p.id = any(c.pet_ids)), '[]'::jsonb),
    'expira_em', c.expira_em
  );
end;
$$;

revoke all on function public.guarda_convite_publico(text) from public;
grant execute on function public.guarda_convite_publico(text) to anon, authenticated;

notify pgrst, 'reload schema';
