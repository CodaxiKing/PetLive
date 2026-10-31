-- A tela da solicitação pede nome e CPF antes do primeiro Pix, junto com a
-- forma de pagamento, em vez de interromper depois. Para isso precisa saber se
-- a conta já tem cliente no provedor de pagamento. O CPF continua sem ir para
-- o banco: só o código do cliente fica guardado (payment_customers).

create or replace function public.pagamento_precisa_cpf()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and not exists (select 1 from payment_customers where user_id = auth.uid() and provider = 'asaas');
$$;

revoke all on function public.pagamento_precisa_cpf() from public, anon;
grant execute on function public.pagamento_precisa_cpf() to authenticated;

notify pgrst, 'reload schema';
