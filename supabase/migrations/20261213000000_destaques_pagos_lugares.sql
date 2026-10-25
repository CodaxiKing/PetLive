begin;
-- Alimentada somente pelo backend confiável após validar o pagamento no provedor.
-- Identificador textual suporta places UUID e place_id do Google sem copiar dados externos.
create table if not exists public.lugares_destaques_pagos (
  id uuid primary key default gen_random_uuid(),
  lugar_id text not null check(char_length(btrim(lugar_id)) between 1 and 200),
  pagamento_ref text not null unique check(char_length(btrim(pagamento_ref)) between 1 and 200),
  pagamento_confirmado_em timestamptz not null,
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  status text not null default 'ativo' check(status in ('ativo','cancelado','reembolsado')),
  criado_em timestamptz not null default now(),
  check(isfinite(inicio_em) and isfinite(fim_em) and isfinite(pagamento_confirmado_em) and fim_em>inicio_em)
);
create index if not exists lugares_destaques_consulta on public.lugares_destaques_pagos(lugar_id,fim_em) where status='ativo';
alter table public.lugares_destaques_pagos enable row level security;
revoke all on public.lugares_destaques_pagos from public,anon,authenticated;
grant all on public.lugares_destaques_pagos to service_role;
create or replace function public.destaques_lugares(p_ids text[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  if p_ids is null or cardinality(p_ids)>200 or coalesce(array_ndims(p_ids),1)<>1
    or exists(select 1 from unnest(p_ids) i where i is null or char_length(i) not between 1 and 200) then
    raise exception 'Lista de lugares inválida.';
  end if;
  return jsonb_build_object('servidor_em',now(),'destaques',(
    select coalesce(jsonb_agg(jsonb_build_object('lugar_id',lugar_id,'fim_em',fim_em)),'[]'::jsonb) from (
      select lugar_id,max(fim_em) as fim_em from public.lugares_destaques_pagos
      where lugar_id=any(p_ids) and status='ativo' and pagamento_confirmado_em<=now()
        and inicio_em<=now() and fim_em>now() group by lugar_id
    ) ativos));
end;
$$;
revoke all on function public.destaques_lugares(text[]) from public,anon;
grant execute on function public.destaques_lugares(text[]) to authenticated;
notify pgrst,'reload schema';
commit;
