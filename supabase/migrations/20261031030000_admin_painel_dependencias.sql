-- Missing production prerequisites for admin pages. Additive and safe to rerun.
alter table public.site_contacts add column if not exists loja_nome text;
alter table public.site_contacts add column if not exists loja_tipo text;
alter table public.site_contacts add column if not exists cidade text;
alter table public.lgpd_requests add column if not exists due_at timestamptz not null default now() + interval '15 days';
alter table public.lgpd_requests add column if not exists executar_em timestamptz;
alter table public.lgpd_requests add column if not exists done_at timestamptz;
alter table public.sugestoes_lugar add column if not exists lat double precision;
alter table public.sugestoes_lugar add column if not exists lng double precision;
alter table public.sugestoes_lugar add column if not exists motivo_recusa text;
alter table public.sugestoes_lugar add column if not exists place_id uuid;
alter table public.sugestoes_lugar add column if not exists revisado_em timestamptz;

create table if not exists public.places (
 id uuid primary key default gen_random_uuid(),
 osm_type text check (osm_type in ('node','way','relation')),
 osm_id bigint,
 fonte text not null default 'tutor' check (fonte in ('osm','overture','tutor')),
 fonte_id text,
 nome text not null,
 categoria text not null check (categoria in ('clinica','banho_tosa','petshop','creche','hotelzinho','restaurante','hotel','praia','parque')),
 endereco text, telefone text, horario text, website text,
 lat double precision not null check (lat between -90 and 90),
 lng double precision not null check (lng between -180 and 180),
 aberto_24h boolean not null default false,
 aceita_caes boolean, aceita_gatos boolean, area_caes boolean,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 unique(osm_type,osm_id)
);
alter table public.places enable row level security;
drop policy if exists "places: leitura publica" on public.places;
create policy "places: leitura publica" on public.places for select using (true);
revoke insert, update, delete on public.places from anon, authenticated;
alter table public.sugestoes_lugar drop constraint if exists sugestoes_lugar_place_id_fkey;
alter table public.sugestoes_lugar add constraint sugestoes_lugar_place_id_fkey foreign key(place_id) references public.places(id) on delete set null;

create table if not exists public.site_contact_notas (
  id bigint generated always as identity primary key,
  contato_id uuid not null references public.site_contacts(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('nota','resposta')),
  texto text not null check (char_length(texto) between 1 and 4000),
  criado_em timestamptz not null default now()
);
create index if not exists site_contact_notas_contato on public.site_contact_notas(contato_id, criado_em);
alter table public.site_contact_notas enable row level security;
revoke all on public.site_contact_notas from anon, authenticated;

create table if not exists public.vaccine_schedule (
  id uuid primary key default gen_random_uuid(),
  especie text not null check (especie in ('cao','gato')),
  nome text not null,
  primeira_dose_meses int not null check (primeira_dose_meses >= 0),
  reforco_meses int check (reforco_meses > 0),
  descricao text,
  ordem int not null default 0,
  obrigatoria boolean not null default false
);
create index if not exists vaccine_schedule_especie_idx on public.vaccine_schedule(especie, ordem);
alter table public.vaccine_schedule enable row level security;
drop policy if exists "vaccine_schedule: leitura publica" on public.vaccine_schedule;
create policy "vaccine_schedule: leitura publica" on public.vaccine_schedule for select using (true);
revoke insert, update, delete on public.vaccine_schedule from anon, authenticated;

insert into public.vaccine_schedule (especie,nome,primeira_dose_meses,reforco_meses,descricao,ordem,obrigatoria)
values
 ('cao','V10',45,30,'Quíntupla: cinomose, hepatite, parainfluenza, parvovírose e leptospirose.',10,true),
 ('cao','Antirrábica',120,365,'Obrigatória por lei; dose anual a partir de 3 meses.',20,true),
 ('cao','V4 (Gêmea)',45,30,'Tosse dos canis (parainfluenza e bordetella).',30,false),
 ('cao','Giárdia',90,365,'Prevenção de giardíase, dose anual.',40,false),
 ('cao','Gripe canina',60,365,'Coxiella e demais agentes respiratórios.',50,false),
 ('cao','Vermífugo (rotina)',30,90,'Prevenção de verminoses, a cada 3 meses até 6 meses de idade.',60,true),
 ('gato','V4 Felina',45,30,'Panleucopenia, rinotraqueíte, calicivírose e clamydia.',10,true),
 ('gato','V5 Felina',45,30,'Inclui a pifteria (febre felina).',20,true),
 ('gato','Antirrábica',120,365,'Obrigatória por lei; dose anual a partir de 3 meses.',30,true),
 ('gato','Leucemia felina (FeLV)',60,365,'Recomendada para gatos que saem de casa.',40,false),
 ('gato','Vermífugo (rotina)',30,90,'Prevenção de verminoses, a cada 3 meses até 6 meses de idade.',50,true)
on conflict do nothing;

create table if not exists public.conteudo_versoes (
 id bigint generated always as identity primary key,
 tipo text not null check (tipo in ('calendario_vacinas')),
 versao int not null,
 resumo text not null,
 conteudo jsonb not null,
 publicado_por uuid references auth.users(id) on delete set null,
 publicado_em timestamptz not null default now(),
 unique(tipo,versao)
);
alter table public.conteudo_versoes enable row level security;
revoke all on public.conteudo_versoes from anon, authenticated;

create table if not exists public.content_packs (
 id uuid primary key default gen_random_uuid(),
 tipo text not null check (tipo in ('emergencia','calculadoras')),
 versao int not null check (versao > 0),
 conteudo jsonb not null,
 revisado_por text,
 crmv text,
 revisado_em timestamptz,
 publicado boolean not null default false,
 criado_em timestamptz not null default now(),
 unique(tipo,versao),
 constraint content_packs_emergencia_revisada check (tipo <> 'emergencia' or not publicado or (revisado_por is not null and crmv is not null and revisado_em is not null))
);
alter table public.content_packs enable row level security;
revoke all on public.content_packs from anon, authenticated;

create table if not exists public.viagem_itens (
 id uuid primary key default gen_random_uuid(), modo text not null check (modo in ('carro','aviao','ambos')),
 titulo text not null check (char_length(titulo) between 3 and 80), detalhe text check (char_length(detalhe) <= 120),
 automatico text check (automatico in ('antirrabica')), ordem int not null default 0, ativo boolean not null default true, revisado_em date
);
alter table public.viagem_itens enable row level security;
revoke all on public.viagem_itens from anon, authenticated;
grant select on public.viagem_itens to authenticated;
drop policy if exists "viagem_itens: leitura" on public.viagem_itens;
create policy "viagem_itens: leitura" on public.viagem_itens for select to authenticated using (ativo);
insert into public.viagem_itens(modo,titulo,detalhe,automatico,ordem) values
 ('ambos','Carteira de vacinação em dia','Antirrábica válida','antirrabica',10),
 ('aviao','Atestado de saúde do veterinário','Confira o prazo exigido pela companhia',null,20),
 ('aviao','Caixa de transporte aprovada','Medidas da companhia',null,30),
 ('aviao','Regras da companhia aérea','Peso, raça e tipo de cabine',null,40),
 ('carro','Caixa de transporte ou cinto para pet','Pet preso e seguro no banco de trás',null,30),
 ('carro','Paradas no caminho','Para água, xixi e esticar as patas',null,40),
 ('ambos','Comida, água e remédios',null,null,50),
 ('ambos','Coleira com plaquinha e contato','Telefone atualizado',null,60),
 ('ambos','Endereço de uma clínica no destino','Para alguma emergência',null,70)
on conflict do nothing;

create table if not exists public.companhias_aereas (
 id uuid primary key default gen_random_uuid(), nome text not null unique, regras text check (char_length(regras) <= 600), link text not null, revisado_em date
);
alter table public.companhias_aereas enable row level security;
revoke all on public.companhias_aereas from anon, authenticated;
grant select on public.companhias_aereas to authenticated;
drop policy if exists "companhias_aereas: leitura" on public.companhias_aereas;
create policy "companhias_aereas: leitura" on public.companhias_aereas for select to authenticated using (true);
insert into public.companhias_aereas(nome,link) values ('Azul','https://www.voeazul.com.br'),('GOL','https://www.voegol.com.br'),('LATAM','https://www.latamairlines.com/br/pt') on conflict(nome) do nothing;

create table if not exists public.viagens (
 id uuid primary key default gen_random_uuid(), tutor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
 pet_id uuid not null references public.pets(id) on delete cascade, modo text not null check (modo in ('carro','aviao')),
 destino text check (char_length(destino) <= 80), data date, companhia_id uuid references public.companhias_aereas(id) on delete set null,
 marcados uuid[] not null default '{}', criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create index if not exists viagens_pet on public.viagens(pet_id,criado_em desc);
alter table public.viagens enable row level security;
revoke all on public.viagens from anon;
grant select,insert,update,delete on public.viagens to authenticated;
drop policy if exists "viagens: tutor lê" on public.viagens;
drop policy if exists "viagens: tutor cria" on public.viagens;
drop policy if exists "viagens: tutor muda" on public.viagens;
drop policy if exists "viagens: tutor apaga" on public.viagens;
create policy "viagens: tutor lê" on public.viagens for select to authenticated using (tutor_id=auth.uid());
create policy "viagens: tutor cria" on public.viagens for insert to authenticated with check (tutor_id=auth.uid() and exists(select 1 from public.pets p where p.id=pet_id and p.tutor_id=auth.uid()));
create policy "viagens: tutor muda" on public.viagens for update to authenticated using (tutor_id=auth.uid()) with check (tutor_id=auth.uid() and exists(select 1 from public.pets p where p.id=pet_id and p.tutor_id=auth.uid()));
create policy "viagens: tutor apaga" on public.viagens for delete to authenticated using (tutor_id=auth.uid());

create table if not exists public.campanhas (
 id uuid primary key default gen_random_uuid(), titulo text not null check(char_length(titulo) between 3 and 65),
 mensagem text not null check(char_length(mensagem) between 3 and 180),
 publico text not null check(publico in ('todos','caes','gatos','sem_pet','vacina_vencendo','inativos')),
 link text check(link in ('/inicio','/mapa','/lembretes','/ferramentas/calculadoras','/sos')),
 status text not null default 'rascunho' check(status in ('rascunho','agendada','enviada','cancelada')),
 agendada_para timestamptz, enviada_em timestamptz, destinatarios int,
 criada_por uuid references auth.users(id) on delete set null, criada_em timestamptz not null default now(),
 constraint campanhas_agendada_tem_data check(status <> 'agendada' or agendada_para is not null)
);
alter table public.campanhas enable row level security;
revoke all on public.campanhas from anon, authenticated;
alter table public.notification_log add column if not exists campanha_id uuid references public.campanhas(id) on delete set null;
alter table public.notification_log drop constraint if exists notification_log_type_check;
alter table public.notification_log add constraint notification_log_type_check check (type in ('lembrete','vacina','dose','peso','sistema','campanha'));
create index if not exists notification_log_campanha on public.notification_log(campanha_id) where campanha_id is not null;

create table if not exists public.datas_fogos (
 id uuid primary key default gen_random_uuid(), nome text not null, data date not null, regiao text, dica text, revisado_em date, criado_em timestamptz not null default now()
);
alter table public.datas_fogos enable row level security;
revoke all on public.datas_fogos from anon, authenticated;
insert into public.datas_fogos(nome,data,regiao,dica) values
 ('Réveillon','2026-12-31','Brasil','Prepare um local seguro e silencioso para o pet.'),
 ('Réveillon','2027-12-31','Brasil','Prepare um local seguro e silencioso para o pet.') on conflict do nothing;

-- Campanha eligibility can safely return zero until consent history exists.
create table if not exists public.consentimentos (
 id uuid primary key default gen_random_uuid(), tutor_id uuid not null references public.profiles(id) on delete cascade,
 tipo text not null, aceito boolean not null, registrado_em timestamptz not null default now()
);
alter table public.consentimentos enable row level security;
revoke all on public.consentimentos from anon, authenticated;
