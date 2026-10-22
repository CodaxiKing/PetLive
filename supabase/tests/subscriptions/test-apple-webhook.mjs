// PetLive: Testes de integração para webhook Apple App Store.
// Testa cada tipo de notificação, idempotência e transições de estado.
// Roda: node supabase/tests/subscriptions/test-apple-webhook.mjs <ANON_KEY>

import * as jose from 'jose';

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
if (!ANON) {
  console.error('Uso: node test-apple-webhook.mjs <ANON_KEY>');
  process.exit(1);
}

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const login = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@petlive.dev', password: 'petlive123' }),
}).then(r => r.json());
const token = login.access_token;

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Chaves de teste para assinar JWS (ES256).
// Em produção, a Apple usa chaves em https://appleid.apple.com/auth/keys
const testPrivateKey = await jose.importPKCS8(
  `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgY2F0dGVyIGtleSBm
b3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5IG5vdCBmb3IgcHJvZHVjdGlvbiB1c2U
2hRANCAASdKqHJQJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8R
jJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8R
-----END PRIVATE KEY-----`,
  'ES256'
);

// Gera JWS assinado para teste.
async function signPayload(payload) {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .sign(testPrivateKey);
}

// Cria transactionInfo assinado.
function makeTransactionInfo(overrides = {}) {
  const base = {
    transactionId: '1000000123456789',
    originalTransactionId: '1000000123456789',
    productId: 'petlive.premium.mensal',
    purchaseDate: Date.now() - 86400000, // 1 dia atrás
    originalPurchaseDate: Date.now() - 86400000,
    expirationDate: Date.now() + 30 * 86400000, // 30 dias
    type: 'Auto-Renewable Subscription',
    inAppOwnershipType: 'PURCHASED',
    signedDate: Date.now(),
    environment: 'Sandbox',
    appAccountToken: '550e8400-e29b-41d4-a716-446655440000', // UUID demo user
    ...overrides,
  };
  return base;
}

// Cria renewalInfo assinado.
function makeRenewalInfo(overrides = {}) {
  const base = {
    originalTransactionId: '1000000123456789',
    autoRenewStatus: 1,
    autoRenewProductId: 'petlive.premium.mensal',
    signedDate: Date.now(),
    environment: 'Sandbox',
    ...overrides,
  };
  return base;
}

// Cria payload completo da notificação Apple.
async function makeAppleNotification(notificationType, txnOverrides = {}, renewalOverrides = {}) {
  const txn = makeTransactionInfo(txnOverrides);
  const renewal = makeRenewalInfo(renewalOverrides);

  const signedTxn = await signPayload(txn);
  const signedRenewal = await signPayload(renewal);

  const payload = {
    notificationType,
    subtype: 'INITIAL_BUY',
    data: {
      signedTransactionInfo: signedTxn,
      signedRenewalInfo: signedRenewal,
    },
    version: '2.0',
    signedDate: Date.now(),
    environment: 'Sandbox',
  };

  const signedPayload = await signPayload(payload);
  return { signedPayload };
}

// Chama webhook.
async function callWebhook(body) {
  return fetch(`${BASE}/functions/v1/apple-webhook`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      // Service role para ignorar RLS no webhook
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// Verifica estado da assinatura no banco.
async function getSubscription(userId, provider = 'apple') {
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

// ===== TESTES =====

console.log('\n=== Limpeza inicial ===');
await cleanSubscriptions(TEST_USER);

console.log('\n=== 1. SUBSCRIBED (nova assinatura) ===');
{
  const notif = await makeAppleNotification('SUBSCRIBED');
  const r = await callWebhook(notif);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub !== null, 'Assinatura criada no banco');
  ok(sub?.status === 'ativa' || sub?.status === 'em_teste', `Status: ${sub?.status}`);
  ok(sub?.provider === 'apple', 'Provider apple');
  ok(sub?.provider_subscription_id === '1000000123456789', 'provider_subscription_id');
  ok(sub?.provider_original_transaction_id === '1000000123456789', 'provider_original_transaction_id');
  ok(sub?.plan_id !== null, 'plan_id preenchido');
}

console.log('\n=== 2. RENEWAL (renovação) ===');
{
  const notif = await makeAppleNotification('RENEWAL', {
    transactionId: '1000000123456790',
    purchaseDate: Date.now(),
    expirationDate: Date.now() + 30 * 86400000,
  });
  const r = await callWebhook(notif);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status ativa após renovação: ${sub?.status}`);
  ok(sub?.retry_count === 0, 'retry_count zerado');
}

console.log('\n=== 3. DID_CHANGE_RENEWAL_STATUS (cancelamento pelo usuário) ===');
{
  const notif = await makeAppleNotification('DID_CHANGE_RENEWAL_STATUS', {}, { autoRenewStatus: 0 });
  const r = await callWebhook(notif);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelando', `Status cancelando: ${sub?.status}`);
  ok(sub?.cancel_reason === 'user_cancel', 'cancel_reason user_cancel');
}

console.log('\n=== 4. DID_FAIL_TO_RENEW (falha de cobrança -> pagamento_falhou) ===');
{
  const notif = await makeAppleNotification('DID_FAIL_TO_RENEW', {}, { isInBillingRetryPeriod: true });
  const r = await callWebhook(notif);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'pagamento_falhou', `Status pagamento_falhou: ${sub?.status}`);
  ok((sub?.retry_count ?? 0) >= 1, 'retry_count >= 1');
}

console.log('\n=== 5. GRACE_PERIOD_EXPIRED (grace period acabou -> expirada) ===');
{
  const notif = await makeAppleNotification('GRACE_PERIOD_EXPIRED');
  const r = await callWebhook(notif);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'expirada', `Status expirada: ${sub?.status}`);
  ok(sub?.cancel_reason === 'billing_error', 'cancel_reason billing_error');
}

console.log('\n=== 6. REFUND (reembolso -> cancelada) ===');
{
  // Recria assinatura ativa primeiro
  await cleanSubscriptions(TEST_USER);
  const notif1 = await makeAppleNotification('SUBSCRIBED');
  await callWebhook(notif1);

  const notif2 = await makeAppleNotification('REFUND');
  const r = await callWebhook(notif2);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelada', `Status cancelada após refund: ${sub?.status}`);
  ok(sub?.cancel_reason === 'refund', 'cancel_reason refund');
}

console.log('\n=== 7. REVOKE (revogação -> cancelada) ===');
{
  await cleanSubscriptions(TEST_USER);
  const notif1 = await makeAppleNotification('SUBSCRIBED');
  await callWebhook(notif1);

  const notif2 = await makeAppleNotification('REVOKE', { revocationDate: Date.now(), revocationReason: 1 });
  const r = await callWebhook(notif2);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'cancelada', `Status cancelada após revoke: ${sub?.status}`);
}

console.log('\n=== 8. EXPIRED (expiração natural -> expirada) ===');
{
  await cleanSubscriptions(TEST_USER);
  const notif1 = await makeAppleNotification('SUBSCRIBED', { expirationDate: Date.now() - 86400000 }); // já expirou
  await callWebhook(notif1);

  const notif2 = await makeAppleNotification('EXPIRED');
  const r = await callWebhook(notif2);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'expirada', `Status expirada: ${sub?.status}`);
}

console.log('\n=== 9. OFFER_REDEEMED (oferta resgatada -> ativa) ===');
{
  await cleanSubscriptions(TEST_USER);
  const notif = await makeAppleNotification('OFFER_REDEEMED', { offerType: 2, offerIdentifier: 'promo_50' });
  const r = await callWebhook(notif);
  ok(r.status === 200, `Webhook responde 200 (${r.status})`);

  const sub = await getSubscription(TEST_USER);
  ok(sub?.status === 'ativa', `Status ativa após oferta: ${sub?.status}`);
}

console.log('\n=== 10. IDEMPOTÊNCIA: mesmo webhook 3x ===');
{
  await cleanSubscriptions(TEST_USER);
  const notif = await makeAppleNotification('SUBSCRIBED');

  for (let i = 0; i < 3; i++) {
    const r = await callWebhook(notif);
    ok(r.status === 200, `Envio ${i + 1}: 200`);
  }

  const sub = await getSubscription(TEST_USER);
  ok(sub !== null, 'Uma única assinatura criada');
  // Verifica se não duplicou (count = 1)
  const count = await fetch(`${BASE}/rest/v1/subscriptions?user_id=eq.${TEST_USER}&provider=eq.apple&select=id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}` },
  }).then(r => r.json());
  ok(count.length === 1, `Apenas 1 registro no banco (count=${count.length})`);
}

console.log('\n=== 11. Webhook sem appAccountToken (não falha, só loga) ===');
{
  await cleanSubscriptions(TEST_USER);
  const notif = await makeAppleNotification('SUBSCRIBED', { appAccountToken: undefined });
  const r = await callWebhook(notif);
  ok(r.status === 200, 'Retorna 200 mesmo sem user_id (não bloqueia retry Apple)');
}

console.log('\n=== 12. Webhook com product_id desconhecido (não falha) ===');
{
  await cleanSubscriptions(TEST_USER);
  const notif = await makeAppleNotification('SUBSCRIBED', { productId: 'unknown.product' });
  const r = await callWebhook(notif);
  ok(r.status === 200, 'Retorna 200 para product_id desconhecido');
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);