-- QR permanente: o código não muda ao ajustar as permissões ou pausar.
create table public.pet_qr_settings (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  code text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  show_photo boolean not null default false,
  show_phone boolean not null default false,
  show_allergies boolean not null default false,
  active boolean not null default true
);
alter table public.pet_qr_settings enable row level security;
revoke all on public.pet_qr_settings from anon, authenticated;
grant select on public.pet_qr_settings to authenticated;
create policy "QR: dono consulta" on public.pet_qr_settings for select to authenticated
using (public.is_pet_owner(pet_id));

create function public.salvar_qr_pet(p_pet uuid, p_foto boolean, p_telefone boolean, p_alergias boolean, p_ativo boolean)
returns public.pet_qr_settings language plpgsql security definer set search_path = public as $$
declare v_resultado pet_qr_settings;
begin
  perform 1 from pets where id = p_pet and tutor_id = auth.uid() and ativo and not em_memoria for update;
  if not found then raise exception 'Pet não encontrado.' using errcode = '42501'; end if;
  if p_foto is null or p_telefone is null or p_alergias is null or p_ativo is null then
    raise exception 'Informe as permissões do QR.';
  end if;
  if p_telefone and not exists(select 1 from profiles where id = auth.uid() and nullif(trim(telefone), '') is not null) then
    raise exception 'Cadastre seu telefone no perfil antes de exibi-lo no QR.';
  end if;
  insert into pet_qr_settings(pet_id, show_photo, show_phone, show_allergies, active)
  values(p_pet, p_foto, p_telefone, p_alergias, p_ativo)
  on conflict(pet_id) do update set show_photo = excluded.show_photo, show_phone = excluded.show_phone,
    show_allergies = excluded.show_allergies, active = excluded.active
  returning * into v_resultado;
  return v_resultado;
end;
$$;
revoke all on function public.salvar_qr_pet(uuid,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.salvar_qr_pet(uuid,boolean,boolean,boolean,boolean) to authenticated;

-- Contador por hora sem armazenar IP em claro nem histórico de localização.
create table public.qr_limites (
  chave text primary key, janela timestamptz not null, total int not null
);
alter table public.qr_limites enable row level security;
revoke all on public.qr_limites from public, anon, authenticated;
create function public.qr_pet_publico(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q pet_qr_settings; p pets; v_total int; v_ip text; v_chave text; v_dados jsonb;
begin
  v_ip := coalesce(split_part(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for', ',', 1), 'local');
  v_chave := encode(extensions.digest(v_ip || 'petlive-qr', 'sha256'), 'hex');
  insert into qr_limites(chave,janela,total) values(v_chave,date_trunc('hour',now()),1)
  on conflict(chave) do update set janela = excluded.janela,
    total = case when qr_limites.janela = excluded.janela then qr_limites.total + 1 else 1 end
  returning total into v_total;
  if v_total > 60 then return jsonb_build_object('limite',true); end if;
  select * into q from pet_qr_settings where code = p_codigo and active;
  select * into p from pets where id = q.pet_id and ativo and not em_memoria;
  if p.id is null then return jsonb_build_object('valido',false); end if;
  v_dados := jsonb_build_object('nome',p.nome,'especie',p.especie);
  if q.show_photo then v_dados := v_dados || jsonb_build_object('foto',p.foto_url); end if;
  if q.show_allergies then v_dados := v_dados || jsonb_build_object('alergias',p.alergias); end if;
  if q.show_phone then v_dados := v_dados || jsonb_build_object('telefone',(select telefone from profiles where id = p.tutor_id)); end if;
  return jsonb_build_object('valido',true,'pet',v_dados);
end;
$$;
revoke all on function public.qr_pet_publico(text) from public;
grant execute on function public.qr_pet_publico(text) to anon, authenticated;
