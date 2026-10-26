-- Push dos avisos de pet perdido (BUSINESS.md 5.29) e dos convites da guarda
-- compartilhada (5.45), além da Caixa de avisos. Mesmo envio das campanhas:
-- pg_net para o serviço de push da Expo, com os aparelhos ativos da conta.
-- Avisos de alteração da guarda (com pet_id) ficam só na Caixa: é o push
-- opcional que entra com a preferência em Notificações.

create or replace function public.aviso_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if not (new.type = 'perdido' or (new.type = 'guarda' and new.pet_id is null)) then return new; end if;
  for v_token in select token from push_tokens where tutor_id = new.user_id and ativo loop
    begin
      perform net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := jsonb_build_object(
          'to', v_token, 'title', new.title, 'body', new.body, 'sound', 'default',
          'priority', case when new.type = 'perdido' then 'high' else 'default' end,
          'data', jsonb_build_object('tipo', new.type, 'url', coalesce(new.deep_link, '/avisos/caixa'), 'aviso_id', new.id)
        ),
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      -- Sem push (pg_net fora do ar), o aviso continua na Caixa.
      null;
    end;
  end loop;
  return new;
end;
$$;
revoke all on function public.aviso_push() from public, anon, authenticated;

drop trigger if exists notification_log_push_perdido_guarda on public.notification_log;
create trigger notification_log_push_perdido_guarda
  after insert on public.notification_log
  for each row when (new.type in ('perdido', 'guarda'))
  execute function public.aviso_push();
