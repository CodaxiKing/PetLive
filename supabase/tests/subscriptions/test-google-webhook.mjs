// PetLive: Testes de integração para webhook Google Play RTDN.
// Testa cada tipo de notificação, idempotência e transições de estado.
// Roda: node supabase/tests/subscriptions/test-google-webhook.mjs <ANON_KEY>

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
if (!ANON) {
  console.error('Uso: node test-google-webhook.mjs <ANON_KEY>');
  process.exit(1);
}

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Gera mensagem Pub/Sub base64.
function makePubSubMessage(data) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(data)).toString('base64'),
      messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      publishTime: new Date().toISOString(),
    },
    subscription: 'projects/test/subscriptions/test-sub',
  };
}

// Cria subscriptionNotification.
function makeSubscriptionNotification(notificationType, purchaseToken, subscriptionId = 'petlive_premium_mensal') {
  const typeMap = {
    'SUBSCRIPTION_PURCHASED': 1,
    'SUBSCRIPTION_RENEWED': 2,
    'SUBSCRIPTION_CANCELED': 3,
    'SUBSCRIPTION_ON_HOLD': 4,
    'SUBSCRIPTION_IN_GRACE_PERIOD': 5,
    'SUBSCRIPTION_RESTARTED': 6,
    'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED': 7,
    'SUBSCRIPTION_DEFERRED': 8,
    'SUBSCRIPTION_PAUSED': 9,
    'SUBSCRIPTION_REVOKED': 10,
    'SUBSCRIPTION_EXPIRED': 11,
  };

  return {
    version: '1.0',
    packageName: 'com.petlive.tutor',
    eventTimeMillis: Date.now().toString(),
    subscriptionNotification: {
      notificationType: typeMap[notificationType] ?? 1,
      purchaseToken,
      subscriptionId,
    },
  };
}

// Chama webhook.
async function callWebhook(body) {
  return fetch(`${BASE}/functions/v1/google-webhook`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// Verifica assinatura no banco.
async function getSubscription(userId, provider = 'google') {
  const client = await fetch(`${BASE}/rest/v1/subscriptions?user_id=eq.${userId}&provider=eq.${provider}&select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}` },
  });
  const data = await client.json();
  return data[0] ?? null;
}

async function cleanSubscriptions(userId) {
  await fetch(`${BASE}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=minimal' },
  });
}

const TEST_USER = '550e8400-e29b-41d4-a716-446655440000';
const PURCHASE_TOKEN = 'token_abc123';

// ===== TESTES =====

console.log('\n=== Limpeza inicial ===');
await cleanSubscriptions(TEST_USER);

console.log('\n=== 1. SUBSCRIPTION_PURCHASED (nova compra/teste) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub !== null, 'Assinatura criada');
  ok(sub?.status === 'ativa' || sub?.status === 'em_teste', `Status: ${sub?.status}`);
  ok(sub?.provider === 'google', 'Provider google');
  ok(sub?.provider_subscription_id === PURCHASE_TOKEN, 'provider_subscription_id = purchaseToken');
}

console.log('\n=== 2. SUBSCRIPTION_RENEWED (renovação) ===');
{
  const newToken = 'token_abc124'; // purchaseToken muda a cada renovação
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_RENEWED', newToken));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status ativa: ${sub?.status}`);
  ok(sub?.retry_count === 0, 'retry_count zerado');
  ok(sub?.provider_subscription_id === newToken, 'provider_subscription_id atualizado');
  ok(sub?.provider_original_transaction_id === PURCHASE_TOKEN, 'original_transaction_id mantido');
}

console.log('\n=== 3. SUBSCRIPTION_CANCELED (cancelamento pelo usuário) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_CANCELED', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelando', `Status cancelando: ${sub?.status}`);
  ok(sub?.cancel_reason === 'user_cancel', 'cancel_reason user_cancel');
}

console.log('\n=== 4. SUBSCRIPTION_ON_HOLD (account hold -> pagamento_falhou) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_ON_HOLD', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'pagamento_falhou', `Status pagamento_falhou: ${sub?.status}`);
  ok((sub?.retry_count ?? 0) >= 1, 'retry_count >= 1');
}

console.log('\n=== 5. SUBSCRIPTION_IN_GRACE_PERIOD (grace period -> ativa com retry) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_IN_GRACE_PERIOD', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status mantido ativa: ${sub?.status}`);
  ok((sub?.retry_count ?? 0) >= 1, 'retry_count >= 1');
}

console.log('\n=== 6. SUBSCRIPTION_RESTARTED (reativação) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_RESTARTED', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status ativa após restart: ${sub?.status}`);
  ok(sub?.retry_count === 0, 'retry_count zerado');
}

console.log('\n=== 7. SUBSCRIPTION_PRICE_CHANGE_CONFIRMED (aumento confirmado) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PRICE_CHANGE_CONFIRMED', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status ativa: ${sub?.status}`);
}

console.log('\n=== 8. SUBSCRIPTION_DEFERRED (prorrogação) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_DEFERRED', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status ativa: ${sub?.status}`);
}

console.log('\n=== 9. SUBSCRIPTION_PAUSED (pausada -> cancelando) ===');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PAUSED', PURCHASE_TOKEN));
  const r = await callWebhook(msg);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelando', `Status cancelando: ${sub?.status}`);
}

console.log('\n=== 10. SUBSCRIPTION_REVOKED (revogação -> cancelada) ===');
{
  await cleanSubscriptions(TEST_USER);
  const msg1 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', PURCHASE_TOKEN));
  await callWebhook(msg1);

  const msg2 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_REVOKED', PURCHASE_TOKEN));
  const r = await callWebhook(msg2);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelada', `Status cancelada: ${sub?.status}`);
  ok(sub?.cancel_reason === 'billing_error', 'cancel_reason billing_error');
}

console.log('\n=== 11. SUBSCRIPTION_EXPIRED (expiração -> expirada) ===');
{
  await cleanSubscriptions(TEST_USER);
  const msg1 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', PURCHASE_TOKEN));
  await callWebhook(msg1);

  const msg2 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_EXPIRED', PURCHASE_TOKEN));
  const r = await callWebhook(msg2);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'expirada', `Status expirada: ${sub?.status}`);
  ok(sub?.cancel_reason === 'billing_error', 'cancel_reason billing_error');
}

console.log('\n=== 12. TEST_NOTIFICATION (não processa, só OK) ===');
{
  const msg = makePubSubMessage({ testNotification: { version: '1.0' } });
  const r = await callWebhook(msg);
  ok(r.status === 200, `Test notification retorna 200 (${r.status})`);
}

console.log('\n=== 13. VOIDED_PURCHASE_NOTIFICATION (compra anulada) ===');
{
  await cleanSubscriptions(TEST_USER);
  const msg1 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', PURCHASE_TOKEN));
  await callWebhook(msg1);

  const voidedMsg = makePubSubMessage({
    voidedPurchaseNotification: {
      purchaseToken: PURCHASE_TOKEN,
      orderId: 'GPA.1234-5678-9012-34567',
      productType: 2, // subscription
      voidedTimeMillis: Date.now().toString(),
      voidedReason: 1, // user cancelled
      voidedSource: 1,
    },
  });
  const r = await callWebhook(voidedMsg);
  ok(r.status === 200, `Voided purchase retorna 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelada', `Status cancelada: ${sub?.status}`);
  ok(sub?.cancel_reason === 'user_cancel', 'cancel_reason user_cancel');
}

console.log('\n=== 14. IDEMPOTÊNCIA: mesmo webhook 3x ===');
{
  await cleanSubscriptions(TEST_USER);
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', PURCHASE_TOKEN));

  for (let i = 0; i < 3; i++) {
    const r = await callWebhook(msg);
    ok(r.status === 200, `Envio ${i + 1}: 200`);
  }

  const count = await fetch(`${BASE}/rest/v1/subscriptions?user_id=eq.${TEST_USER}&provider=eq.google&select=id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}` },
  }).then(r => r.json());
  ok(count.length === 1, `Apenas 1 registro no banco (count=${count.length})`);
}

console.log('\n=== 15. Webhook sem obfuscatedExternalAccountId (não falha) ===');
{
  await cleanSubscriptions(TEST_USER);
  // Simula notificação sem user_id (Google API não retorna)
  // O webhook loga e retorna OK sem criar assinatura
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', 'token_no_user'));
  const r = await callWebhook(msg);
  ok(r.status === 200, 'Retorna 200 mesmo sem user_id');
}

console.log('\n=== 16. Webhook com product_id desconhecido (não falha) ===');
{
  await cleanSubscriptions(TEST_USER);
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', PURCHASE_TOKEN, 'unknown_product'));
  const r = await callWebhook(msg);
  ok(r.status === 200, 'Retorna 200 para product_id desconhecido');
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);