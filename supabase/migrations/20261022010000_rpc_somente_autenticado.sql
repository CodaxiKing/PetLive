-- PetLive: RPCs de dados só para autenticado.
--
-- Correção descoberta na validação do mapa: as default privileges do
-- Supabase concedem EXECUTE a `anon` automaticamente no create de cada
-- função — os revokes das migrações anteriores tiravam apenas o PUBLIC,
-- então o `anon` continuava podendo executar. A chamada anônima de
-- lugares_por_perto devolveu dados na validação.
--
-- Fica revogado só o anon nas RPCs que mexem em dados do tutor. Os
-- helpers ficam: is_pet_owner é chamado dentro de policies (o papel que
-- consulta precisa de EXECUTE) e corpo_aviso/proximo_disparo/touch_updated_at
-- são cálculos puros sem leitura de dados.
revoke execute on function public.exportar_meus_dados() from anon;
revoke execute on function public.excluir_minha_conta() from anon;
revoke execute on function public.lugares_por_perto(double precision, double precision, text, text, double precision, boolean, integer) from anon;
