-- Comunidade: privado por padrão, publicar, curtir, comentar, seguir, feed e denúncia.
-- docker exec -i supabase_db_PetLive psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/comunidade.sql
begin;
insert into auth.users(id,email) values
 ('7e000000-0000-4000-8000-000000000001','com-ana@example.invalid'),
 ('7e000000-0000-4000-8000-000000000002','com-bia@example.invalid'),
 ('7e000000-0000-4000-8000-000000000003','com-caio@example.invalid'),
 ('7e000000-0000-4000-8000-000000000004','com-duda@example.invalid');
update public.profiles set nome='Ana Souza', cidade='Niterói' where id='7e000000-0000-4000-8000-000000000001';
insert into public.pets(id,tutor_id,nome,especie) values ('7f000000-0000-4000-8000-000000000001','7e000000-0000-4000-8000-000000000001','Rex','cao');
create function pg_temp.verificar(ok boolean, mensagem text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception '%',mensagem; end if; end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true) $$;
set local role authenticated;
-- Privado por padrão: outra conta não vê o perfil e o dono não publica.
select pg_temp.como('7e000000-0000-4000-8000-000000000002');
select pg_temp.verificar((public.comunidade_perfil('7f000000-0000-4000-8000-000000000001')->>'disponivel')::boolean=false,'Perfil privado apareceu');
do $$ begin
  begin perform public.comunidade_perfil_configurar('7f000000-0000-4000-8000-000000000001',true); raise exception 'Outra conta ligou o perfil';
  exception when insufficient_privilege then null; end;
end $$;
select pg_temp.como('7e000000-0000-4000-8000-000000000001');
do $$ begin
  begin perform public.comunidade_publicar('7f000000-0000-4000-8000-000000000001','7e000000-0000-4000-8000-000000000001/a.jpg','oi'); raise exception 'Publicou com perfil desligado';
  exception when invalid_parameter_value then null; end;
end $$;
select public.comunidade_perfil_configurar('7f000000-0000-4000-8000-000000000001',true,'Labrador feliz',true);
do $$ begin
  begin perform public.comunidade_publicar('7f000000-0000-4000-8000-000000000001','outra-conta/a.jpg','oi'); raise exception 'Aceitou foto de outra pasta';
  exception when invalid_parameter_value then null; end;
end $$;
create temp table post as select public.comunidade_publicar('7f000000-0000-4000-8000-000000000001','7e000000-0000-4000-8000-000000000001/a.jpg','Rex no parque hoje') id;
grant select on post to authenticated;
-- Bia segue, curte e comenta.
select pg_temp.como('7e000000-0000-4000-8000-000000000002');
select pg_temp.verificar(public.comunidade_seguir('7f000000-0000-4000-8000-000000000001'),'Não seguiu');
select pg_temp.verificar(public.comunidade_curtir((select id from post)),'Não curtiu');
select public.comunidade_comentar((select id from post),'Que lindo!');
select pg_temp.verificar((select (j->'posts'->0->>'curtidas')::int=1 and (j->'posts'->0->>'curti')::boolean and (j->'posts'->0->>'comentarios')::int=1 and j->'posts'->0->>'autor'='Ana'
  from (select public.comunidade_feed() j) f),'Feed errado');
select pg_temp.verificar((select (j->>'seguidores')::int=1 and (j->>'seguindo')::boolean and j->>'cidade'='Niterói' from (select public.comunidade_perfil('7f000000-0000-4000-8000-000000000001') j) f),'Perfil errado');
do $$ begin
  begin perform 1 from public.posts; raise exception 'Leu posts direto';
  exception when insufficient_privilege then null; end;
end $$;
-- Três denúncias escondem o post.
select public.comunidade_denunciar('post',(select id from post),'spam');
select pg_temp.como('7e000000-0000-4000-8000-000000000003');
select public.comunidade_denunciar('post',(select id from post),'spam');
select public.comunidade_denunciar('post',(select id from post),'spam de novo');
select pg_temp.como('7e000000-0000-4000-8000-000000000004');
select public.comunidade_denunciar('post',(select id from post),'ofensivo');
select pg_temp.verificar((select jsonb_array_length(public.comunidade_feed()->'posts')=0),'Post escondido apareceu no feed');
reset role;
select pg_temp.verificar((select status='oculto' from public.posts where id=(select id from post)),'Post não foi escondido');
select pg_temp.verificar((select count(*)=2 from public.notification_log where user_id='7e000000-0000-4000-8000-000000000001' and type='comunidade'),'Avisos de seguidor e comentário');
rollback;
