// Testa a tradução do estado da App Store e da Google Play para a assinatura
// do PetLive (BUSINESS.md 5.13 e 20.4). Não precisa do Supabase rodando.
// Uso: node --test supabase/tests/assinatura-estado.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PRODUTOS,
  centavosGoogle,
  contaConfere,
  estadoApple,
  estadoGoogle,
  payloadJws,
} from '../functions/_shared/assinatura-estado.ts';

const DIA = 86_400_000;
const agora = Date.now();
const transacao = (extra = {}) => ({
  transactionId: '2000000001',
  originalTransactionId: '2000000000',
  productId: PRODUTOS.anual,
  purchaseDate: agora,
  originalPurchaseDate: agora - 30 * DIA,
  expiresDate: agora + 335 * DIA,
  appAccountToken: 'AAAA-BBBB',
  environment: 'Production',
  price: 99900,
  currency: 'BRL',
  ...extra,
});

test('Apple: renovação paga fica ativa, com o valor em centavos para o faturamento', () => {
  const e = estadoApple(1, transacao(), { autoRenewStatus: 1 });
  assert.equal(e.status, 'ativa');
  assert.equal(e.periodo, 'anual');
  assert.equal(e.referencia, '2000000000');
  assert.equal(e.conta, 'aaaa-bbbb');
  assert.deepEqual(e.cobranca?.valor_centavos, 9990);
});

test('Apple: teste grátis fica em_teste e não gera receita', () => {
  const e = estadoApple(1, transacao({ offerType: 1, offerDiscountType: 'FREE_TRIAL', price: 0 }), { autoRenewStatus: 1 });
  assert.equal(e.status, 'em_teste');
  assert.ok(e.trial_ends_at);
  assert.equal(e.cobranca, null);
});

test('Apple: quem cancela mantém o Premium até o fim do período pago', () => {
  const e = estadoApple(1, transacao(), { autoRenewStatus: 0 });
  assert.equal(e.status, 'cancelando');
  assert.equal(e.renews_at, new Date(agora + 335 * DIA).toISOString());
});

test('Apple: falha de cobrança usa a carência da loja e depois expira', () => {
  const carencia = agora + 6 * DIA;
  assert.equal(estadoApple(4, transacao(), { gracePeriodExpiresDate: carencia }).renews_at, new Date(carencia).toISOString());
  assert.equal(estadoApple(3, transacao({ expiresDate: agora - DIA }), null).status, 'pagamento_falhou');
  assert.equal(estadoApple(2, transacao({ expiresDate: agora - DIA }), { autoRenewStatus: 1 }).status, 'expirada');
  assert.equal(estadoApple(2, transacao({ expiresDate: agora - DIA }), { autoRenewStatus: 0 }).status, 'cancelada');
});

test('Apple: reembolso encerra na data da revogação; sandbox não entra no faturamento', () => {
  const e = estadoApple(5, transacao({ revocationDate: agora - 1000 }), null);
  assert.equal(e.status, 'cancelada');
  assert.equal(e.renews_at, new Date(agora - 1000).toISOString());
  assert.equal(estadoApple(1, transacao({ environment: 'Sandbox' }), null).ambiente, 'teste');
});

const google = (estado, extra = {}) => ({
  subscriptionState: estado,
  startTime: '2026-10-01T12:00:00Z',
  latestOrderId: 'GPA.1',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: 'USER-1' },
  lineItems: [{ productId: PRODUTOS.mensal, expiryTime: '2026-11-01T12:00:00Z', autoRenewingPlan: { autoRenewEnabled: true } }],
  ...extra,
});

test('Google: estados da assinatura viram os do PetLive', () => {
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_ACTIVE')).status, 'ativa');
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_CANCELED')).status, 'cancelando');
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_IN_GRACE_PERIOD')).status, 'pagamento_falhou');
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_ON_HOLD')).status, 'pagamento_falhou');
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_EXPIRED')).status, 'expirada');
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_EXPIRED', { canceledStateContext: {} })).status, 'cancelada');
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_PENDING')).status, 'expirada');
});

test('Google: teste grátis, referência pelo token e conta da compra', () => {
  const g = google('SUBSCRIPTION_STATE_ACTIVE');
  g.lineItems[0].offerPhase = { freeTrial: {} };
  const e = estadoGoogle('tok-123', g, 1990);
  assert.equal(e.status, 'em_teste');
  assert.equal(e.referencia, 'tok-123');
  assert.equal(e.cobranca, null);
  assert.equal(e.periodo, 'mensal');
  assert.ok(contaConfere(e, 'user-1'));
  assert.ok(!contaConfere(e, 'user-2'));
});

test('Google: cobrança com o valor do pedido em reais', () => {
  assert.equal(centavosGoogle({ currencyCode: 'BRL', units: '19', nanos: 900000000 }), 1990);
  assert.equal(centavosGoogle({ currencyCode: 'USD', units: '5' }), 0);
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_ACTIVE'), 1990).cobranca?.valor_centavos, 1990);
  assert.equal(estadoGoogle('tok', google('SUBSCRIPTION_STATE_ACTIVE', { testPurchase: {} })).ambiente, 'teste');
});

test('lê o payload de um JWS', () => {
  const parte = Buffer.from(JSON.stringify({ notificationType: 'DID_RENEW' })).toString('base64url');
  assert.deepEqual(payloadJws(`x.${parte}.y`), { notificationType: 'DID_RENEW' });
});
