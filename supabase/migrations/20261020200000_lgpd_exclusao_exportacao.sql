-- PetLive: LGPD — exportação e exclusão de dados do tutor.
-- Tarefas: [BACKEND] "Exclusão e exportação de dados (LGPD)".
--
-- Exportação (art. 18, V da LGPD): um único JSON com tudo que pertence ao
-- tutor — perfil, pets, saúde, remédios, doses, lembretes, tokens, avisos
-- e aceites. O app compartilha o arquivo pela folha de compartilhamento.
--
-- Exclusão: apaga os arquivos no Storage (buckets pets/anexos) e o usuário
-- no Auth; profiles e todo o resto caem em cascata, porque todas as
-- tabelas referenciam profiles (ou pets) com on delete cascade.

-- ============================================================
-- Exportar meus dados
-- ============================================================
create or replace function public.exportar_meus_dados()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  return jsonb_build_object(
    'exportado_em', now(),
    'perfil', (
      select to_jsonb(p) from public.profiles p where p.id = v_tutor
    ),
    'pets', (
      select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
      from public.pets p where p.tutor_id = v_tutor
    ),
    'vacinas', (
      select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb)
      from public.vaccinations v
      where exists (
        select 1 from public.pets pp where pp.id = v.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'vermifugos', (
      select coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
      from public.dewormings d
      where exists (
        select 1 from public.pets pp where pp.id = d.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'pesos', (
      select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
      from public.weights w
      where exists (
        select 1 from public.pets pp where pp.id = w.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'consultas', (
      select coalesce(jsonb_agg(to_jsonb(vis)), '[]'::jsonb)
      from public.visits vis
      where exists (
        select 1 from public.pets pp where pp.id = vis.pet_id and pp.tutor_id = v_tutor
      )
    ),
    'remedios', (
      select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb)
      from public.medications m where m.pet_id in (
        select pp.id from public.pets pp where pp.tutor_id = v_tutor
      )
    ),
    'doses_de_remedio', (
      select coalesce(jsonb_agg(to_jsonb(dose)), '[]'::jsonb)
      from public.medication_doses dose
      where dose.medication_id in (
        select m.id from public.medications m
        where m.pet_id in (select pp.id from public.pets pp where pp.tutor_id = v_tutor)
      )
    ),
    'lembretes', (
      select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
      from public.reminders r where r.tutor_id = v_tutor
    ),
    'tokens_de_push', (
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
      from public.push_tokens t where t.tutor_id = v_tutor
    ),
    'avisos_por_tipo', (
      select coalesce(jsonb_agg(to_jsonb(np)), '[]'::jsonb)
      from public.notification_prefs np where np.tutor_id = v_tutor
    ),
    'ajustes_de_aviso', (
      select to_jsonb(ns) from public.notification_settings ns where ns.tutor_id = v_tutor
    ),
    'aceites', (
      select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      from public.aceites_termos a where a.user_id = v_tutor
    )
  );
end;
$$;

comment on function public.exportar_meus_dados() is
  'LGPD: devolve todos os dados do tutor autenticado em um único JSON.';

-- ============================================================
-- Excluir minha conta
-- ============================================================
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_tutor uuid := auth.uid();
begin
  if v_tutor is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  -- Arquivos da conta (fotos de pet, anexos). Melhor esforço: se o papel
  -- do banco não tiver permissão no Storage, a exclusão da conta segue
  -- (o arquivo fica órfão e sai na rotina de limpeza), porque o direito
  -- de excluir a conta não pode ficar refém do Storage.
  begin
    delete from storage.objects
    where owner = v_tutor
      and bucket_id in ('pets', 'anexos');
  exception when others then
    null;
  end;

  -- Remove o usuário do Auth; profiles e todo o resto caem em cascata.
  delete from auth.users where id = v_tutor;
end;
$$;

comment on function public.excluir_minha_conta() is
  'LGPD: apaga os arquivos no Storage e a conta inteira (cascata em profiles).';

-- ============================================================
-- Permissões: só o tutor autenticado, via RPC; nada para o anon.
-- ============================================================
revoke all on function public.exportar_meus_dados() from public;
revoke all on function public.excluir_minha_conta() from public;
grant execute on function public.exportar_meus_dados() to authenticated;
grant execute on function public.excluir_minha_conta() to authenticated;
