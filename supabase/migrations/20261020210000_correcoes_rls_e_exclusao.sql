-- PetLive: correções de segurança descobertas na validação E2E.
--
-- 1. RLS desligado em 9 tabelas (advisory do Supabase CLI). As policies
--    das tabelas de dados já existiam na migração 000002, mas o "enable
--    row level security" ficou de fora — e com o RLS desligado as
--    policies são ignoradas, o que deixava qualquer cliente com a anon
--    key ler e escrever todas as linhas. Habilitar torna as policies
--    existentes efetivas: o tutor dono continua lendo e escrevendo os
--    próprios dados (mesmas policies) e os dados dos outros tutor é que
--    passam a ser bloqueados de verdade.
--
-- 2. Exclusão da conta: o Storage recusa DELETE direto em
--    storage.objects (trigger "Direct deletion from storage tables is
--    not allowed"). Os arquivos são apagados pelo app via Storage API
--    (buckets pets e anexos, pasta = uid, mesma convenção das policies)
--    antes de chamar esta função; o bloco SQL de storage sai daqui.

alter table public.vaccinations enable row level security;
alter table public.dewormings enable row level security;
alter table public.weights enable row level security;
alter table public.visits enable row level security;
alter table public.medications enable row level security;
alter table public.medication_doses enable row level security;
alter table public.reminders enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;

create or replace function public.excluir_minha_conta()
returns void
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

  -- Remove o usuário do Auth; profiles e todo o resto (pets, saúde,
  -- remédios, lembretes, tokens, avisos, aceites) caem em cascata.
  delete from auth.users where id = v_tutor;
end;
$$;

comment on function public.excluir_minha_conta() is
  'LGPD: apaga a conta inteira (cascata em profiles). Os arquivos no Storage são apagados antes, pelo app, via Storage API.';
