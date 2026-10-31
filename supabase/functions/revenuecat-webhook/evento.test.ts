// Rode com: deno test supabase/functions/revenuecat-webhook/evento.test.ts
import { assertEquals } from 'jsr:@std/assert@1';
import { traduzirEvento } from './evento.ts';

const base = {
  app_user_id: '4b000000-0000-4000-8000-000000000001',
  store: 'PLAY_STORE',
  original_transaction_id: 'GPA.1234',
  purchased_at_ms: Date.parse('2026-11-01T12:00:00Z'),
  expiration_at_ms: Date.parse('2026-11-08T12:00:00Z'),
  event_timestamp_ms: Date.parse('2026-11-01T12:00:05Z'),
};

Deno.test('compra com o teste de 7 dias da loja vira em_teste', () => {
  const a = traduzirEvento({ ...base, type: 'INITIAL_PURCHASE', period_type: 'TRIAL', price_in_purchased_currency: 0, currency: 'BRL' });
  assertEquals(a?.status, 'em_teste');
  assertEquals(a?.provedor, 'google_play');
  assertEquals(a?.fim, '2026-11-08T12:00:00.000Z');
  assertEquals(a?.valorCentavos, 0);
});

Deno.test('renovação, cancelamento, falha e vencimento', () => {
  assertEquals(traduzirEvento({ ...base, type: 'RENEWAL', period_type: 'NORMAL', price_in_purchased_currency: 19.9, currency: 'BRL', store: 'APP_STORE' }),
    { tutor: base.app_user_id, provedor: 'app_store', referencia: 'GPA.1234', status: 'ativa', inicio: '2026-11-01T12:00:00.000Z',
      fim: '2026-11-08T12:00:00.000Z', valorCentavos: 1990, eventoEm: '2026-11-01T12:00:05.000Z' });
  assertEquals(traduzirEvento({ ...base, type: 'CANCELLATION' })?.status, 'cancelando');
  assertEquals(traduzirEvento({ ...base, type: 'BILLING_ISSUE' })?.status, 'pagamento_falhou');
  assertEquals(traduzirEvento({ ...base, type: 'EXPIRATION' })?.status, 'expirada');
  assertEquals(traduzirEvento({ ...base, type: 'RENEWAL', price_in_purchased_currency: 4.99, currency: 'USD' })?.valorCentavos, null);
});

Deno.test('ignora teste do painel, loja desconhecida e usuário anônimo', () => {
  assertEquals(traduzirEvento({ ...base, type: 'TEST' }), null);
  assertEquals(traduzirEvento({ ...base, type: 'RENEWAL', store: 'STRIPE' }), null);
  assertEquals(traduzirEvento({ ...base, type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc', original_app_user_id: undefined }), null);
  assertEquals(traduzirEvento({ ...base, type: 'RENEWAL', expiration_at_ms: null }), null);
});
