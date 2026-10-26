-- Avaliações dos apps: importar sem perder resposta pendente, responder no painel e resumo.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/avaliacoes-apps.sql
begin;
insert into auth.users(id,email) values ('7f100000-0000-4000-8000-000000000001','aval-suporte@example.invalid');
insert into public.admin_members(user_id,papel) values ('7f100000-0000-4000-8000-000000000001','suporte');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
set local role service_role;
select public.app_reviews_importar('play','[{"external_id":"g1","rating":5,"author":"Camila","text":"Salvou o dia","at":"2026-10-20T10:00:00Z"},{"external_id":"g2","rating":1,"author":"Sônia","text":"Fecha ao anexar","at":"2026-10-21T10:00:00Z"}]',true,'2 avaliações');
reset role;
create temp table ids as select external_id, id from public.app_reviews;
grant select on ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"7f100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select pg_temp.verificar((select (j->>'sem_resposta')::int=2 and (j->>'uma_estrela_sem_resposta')::int=1 and (j->'lojas'->'play'->>'media')::numeric=3 from (select public.admin_avaliacoes() j) x),'Resumo errado');
select pg_temp.verificar((select jsonb_array_length(public.admin_avaliacoes('baixas')->'itens')=1),'Filtro de notas baixas');
select public.admin_avaliacao_responder((select id from ids where external_id='g2'),'Oi, Sônia! Já corrigimos, atualize o app.');
do $$ begin
  begin perform public.admin_avaliacao_responder((select id from ids where external_id='g1'), repeat('x',351)); raise exception 'Aceitou resposta longa';
  exception when raise_exception then if sqlerrm not like '%350%' then raise; end if; end;
end $$;
reset role;
set local role service_role;
-- Nova importação sem resposta da loja não apaga a resposta pendente.
select public.app_reviews_importar('play','[{"external_id":"g2","rating":2,"author":"Sônia","text":"Fecha ao anexar","at":"2026-10-21T10:00:00Z"}]',true,null);
select pg_temp.verificar((select reply_status='pendente' and rating=2 and reply_text like 'Oi, Sônia%' from public.app_reviews where external_id='g2'),'Resposta pendente perdida');
select pg_temp.verificar((select jsonb_array_length(public.app_reviews_respostas_pendentes())=1),'Pendente não listada');
select public.app_reviews_resposta_resultado((select id from public.app_reviews where external_id='g2'),true);
select pg_temp.verificar((select reply_status='enviada' from public.app_reviews where external_id='g2'),'Resultado não gravado');
reset role;
rollback;
