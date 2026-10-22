-- Dados de exemplo da Fase 1 (BUSINESS.md 26): 1 tutor com 2 pets (cão e
-- gato), vacinas, peso, consulta, lembretes, rotina e um remédio em curso.
-- Só para desenvolvimento local; nunca aplicar em produção.
--
-- Login no app: demo@petlive.dev / petlive123
-- Aplicar sem resetar o banco:
--   docker exec -i supabase_db_PetLive psql -U postgres < supabase/seeds/tutor-demo.sql
-- Idempotente: apaga o tutor demo (cascata) e cria de novo, com datas
-- relativas a hoje.

delete from auth.users where id = '0d0d0d0d-0000-4000-8000-000000000001';

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '0d0d0d0d-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'demo@petlive.dev',
  extensions.crypt('petlive123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Diego", "nome": "Diego"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  '0d0d0d0d-0000-4000-8000-000000000001',
  '0d0d0d0d-0000-4000-8000-000000000001',
  '{"sub": "0d0d0d0d-0000-4000-8000-000000000001", "email": "demo@petlive.dev", "email_verified": true}',
  'email', now(), now(), now()
);

-- O perfil vem do gatilho handle_new_user; marca o aceite do cadastro.
-- Premium: no grátis o segundo pet ficaria só para consulta (BUSINESS.md 10).
update public.profiles
  set aceite_termos = true, aceite_termos_em = now(), plano = 'premium'
  where id = '0d0d0d0d-0000-4000-8000-000000000001';

insert into public.pets (id, tutor_id, nome, especie, raca, nascimento, sexo, peso_atual, castrado, cor_etiqueta) values
  ('0d0d0d0d-0000-4000-8000-0000000000a1', '0d0d0d0d-0000-4000-8000-000000000001',
   'Rex', 'cao', 'Labrador', (current_date - interval '3 years 2 months')::date, 'macho', 31.5, true, '#EBDDFB'),
  ('0d0d0d0d-0000-4000-8000-0000000000a2', '0d0d0d0d-0000-4000-8000-000000000001',
   'Mia', 'gato', 'SRD', (current_date - interval '1 year 7 months')::date, 'femea', 4.2, true, '#FCE1EF');

insert into public.vaccinations (pet_id, nome, aplicada_em, proxima_dose, local) values
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 'V10', current_date - 360, current_date + 5, 'Clínica Vet Botafogo'),
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 'Antirrábica', current_date - 200, current_date + 165, 'Clínica Vet Botafogo'),
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 'Gripe canina', current_date - 400, current_date - 35, null),
  ('0d0d0d0d-0000-4000-8000-0000000000a2', 'V4 felina', current_date - 300, current_date + 65, 'Gatil Vet');

insert into public.weights (pet_id, peso, medido_em) values
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 29.8, current_date - 150),
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 30.6, current_date - 90),
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 31.1, current_date - 40),
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 31.5, current_date - 5),
  ('0d0d0d0d-0000-4000-8000-0000000000a2', 3.9, current_date - 120),
  ('0d0d0d0d-0000-4000-8000-0000000000a2', 4.2, current_date - 10);

insert into public.visits (pet_id, motivo, realizada_em, local, veterinario, observacao) values
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 'Check-up anual', current_date - 60, 'Clínica Vet Botafogo', 'Dra. Ana', 'Tudo bem. Manter a ração.');

insert into public.reminders (tutor_id, pet_id, tipo, titulo, proxima_em, repetir, origem, rotina_item) values
  ('0d0d0d0d-0000-4000-8000-000000000001', '0d0d0d0d-0000-4000-8000-0000000000a1',
   'vacina', 'Vacina V10', (current_date + 5) + time '09:00', 'nao', 'manual', null),
  ('0d0d0d0d-0000-4000-8000-000000000001', '0d0d0d0d-0000-4000-8000-0000000000a2',
   'vermifugo', 'Vermífugo da Mia', (current_date + 12) + time '09:00', 'customizado', 'rotina', 'vermifugo'),
  ('0d0d0d0d-0000-4000-8000-000000000001', '0d0d0d0d-0000-4000-8000-0000000000a1',
   'banho_tosa', 'Banho do Rex', (current_date + 3) + time '09:00', 'customizado', 'rotina', 'banho');

update public.reminders set intervalo_dias = 90 where rotina_item = 'vermifugo'
  and pet_id = '0d0d0d0d-0000-4000-8000-0000000000a2';
update public.reminders set intervalo_dias = 15 where rotina_item = 'banho'
  and pet_id = '0d0d0d0d-0000-4000-8000-0000000000a1';

insert into public.medications (pet_id, nome, dose, frequencia, horarios, inicio, fim, observacao) values
  ('0d0d0d0d-0000-4000-8000-0000000000a1', 'Antibiótico', '1 comprimido', 'a cada 12 horas',
   array['08:00', '20:00']::time[], current_date - 2, current_date + 4, 'Dar junto com a comida.');

-- Dois lugares salvos (filtro "Salvos" do mapa).
insert into public.saved_places (user_id, place_id)
select '0d0d0d0d-0000-4000-8000-000000000001', p.id
from public.places p
where p.categoria = 'clinica' and p.telefone is not null
order by p.nome
limit 2;
