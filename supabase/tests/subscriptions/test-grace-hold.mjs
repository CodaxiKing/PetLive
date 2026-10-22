// PetLive: Testes de grace period (Apple) e account hold (Google).
// Simula falha de cobrança -> grace period -> recuperação / expiração.
// Roda: node supabase/tests/subscriptions/test-grace-hold.mjs <ANON_KEY>

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
if (!ANON) {
  console.error('Uso: node test-grace-hold.mjs <ANON_KEY>');
  process.exit(1);
}

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Importa jose para assinar JWS
import * as jose from 'jose';

const testPrivateKey = await jose.importPKCS8(
  `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgY2F0dGVyIGtleSBm
b3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5IG5vdCBmb3IgcHJvZHVjdGlvbiB1c2U
2hRANCAASdKqHJQJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8R
jJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8RjJ5Q8R
-----END PRIVATE KEY-----`,
  'ES256'
);

async function signPayload(payload) {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .sign(testPrivateKey);
}

function makeTransactionInfo(overrides = {}) {
  return {
    transactionId: '1000000123456789',
    originalTransactionId: '1000000123456789',
    productId: 'petlive.premium.mensal',
    purchaseDate: Date.now() - 30 * 86400000,
    originalPurchaseDate: Date.now() - 30 * 86400000,
    expirationDate: Date.now() + 5 * 86400000, // 5 dias
    type: 'Auto-Renewable Subscription',
    inAppOwnershipType: 'PURCHASED',
    signedDate: Date.now(),
    environment: 'Sandbox',
    appAccountToken: '550e8400-e29b-41d4-a716-446655440001',
    ...overrides,
  };
}

function makeRenewalInfo(overrides = {}) {
  return {
    originalTransactionId: '1000000123456789',
    autoRenewStatus: 1,
    autoRenewProductId: 'petlive.premium.mensal',
    signedDate: Date.now(),
    environment: 'Sandbox',
    ...overrides,
  };
}

async function makeAppleNotification(notificationType, txnOverrides = {}, renewalOverrides = {}) {
  const txn = makeTransactionInfo(txnOverrides);
  const renewal = makeRenewalInfo(renewalOverrides);

  const signedTxn = await signPayload(txn);
  const signedRenewal = await signPayload(renewal);

  const payload = {
    notificationType,
    subtype: 'INITIAL_BUY',
    data: { signedTransactionInfo: signedTxn, signedRenewalInfo: signedRenewal },
    version: '2.0',
    signedDate: Date.now(),
    environment: 'Sandbox',
  };

  const signedPayload = await signPayload(payload);
  return { signedPayload };
}

function makePubSubMessage(data) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(data)).toString('base64'),
      messageId: `msg-${Date.now()}`,
      publishTime: new Date().toISOString(),
    },
    subscription: 'projects/test/subscriptions/test-sub',
  };
}

function makeSubscriptionNotification(notificationType, purchaseToken) {
  const typeMap = {
    'SUBSCRIPTION_PURCHASED': 1,
    'SUBSCRIPTION_RENEWED': 2,
    'SUBSCRIPTION_CANCELED': 3,
    'SUBSCRIPTION_ON_HOLD': 4,
    'SUBSCRIPTION_IN_GRACE_PERIOD': 5,
    'SUBSCRIPTION_RESTARTED': 6,
    'SUBSCRIPTION_REVOKED': 10,
    'SUBSCRIPTION_EXPIRED': 11,
  };
  return {
    version: '1.0',
    packageName: 'com.petlive.tutor',
    eventTimeMillis: Date.now().toString(),
    subscriptionNotification: {
      notificationType: typeMap[notificationType],
      purchaseToken,
      subscriptionId: 'petlive_premium_mensal',
    },
  };
}

async function callAppleWebhook(body) {
  return fetch(`${BASE}/functions/v1/apple-webhook`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function callGoogleWebhook(body) {
  return fetch(`${BASE}/functions/v1/google-webhook`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function getSubscription(userId, provider) {
  const r = await fetch(`${BASE}/rest/v1/subscriptions?user_id=eq.${userId}&provider=eq.${provider}&select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}` },
  });
  return (await r.json())[0] ?? null;
}

async function cleanSubscriptions(userId) {
  await fetch(`${BASE}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}`, Prefer: 'return=minimal' },
  });
}

const USER_APPLE = '550e8400-e29b-41d4-a716-446655440001';
const USER_GOOGLE = '550e8400-e29b-41d4-a716-446655440002';

console.log('\n=== Limpeza ===');
await cleanSubscriptions(USER_APPLE);
await cleanSubscriptions(USER_GOOGLE);

// ===== APPLE GRACE PERIOD =====

console.log('\n=== APPLE: Grace Period Flow ===');

console.log('\n1. Assinatura ativa inicial');
{
  await cleanSubscriptions(USER_APPLE);
  const notif = await makeAppleNotification('SUBSCRIBED');
  const r = await callAppleWebhook(notif);
  ok(r.status === 200, 'SUBSCRIBED: 200');

  const sub = await getSubscription(USER_APPLE, 'apple');
  ok(sub?.status === 'ativa' || sub?.status === 'em_teste', `Status inicial: ${sub?.status}`);
}

console.log('\n2. DID_FAIL_TO_RENEW -> pagamento_falhou (início grace period)');
{
  const notif = await makeAppleNotification('DID_FAIL_TO_RENEW', {}, { isInBillingRetryPeriod: true, gracePeriodExpirationDate: Date.now() + 16 * 86400000 }); // 16 dias grace
  const r = await callAppleWebhook(notif);
  ok(r.status === 200, 'DID_FAIL_TO_RENEW: 200');

  const sub = await getSubscription(USER_APPLE, 'apple');
  ok(sub?.status === 'pagamento_falhou', `Status: ${sub?.status}`);
  ok((sub?.retry_count ?? 0) >= 1, 'retry_count >= 1');
  ok(sub?.renews_at !== null, 'renews_at no grace period');
}

console.log('\n3. GRACE_PERIOD_EXPIRED -> expirada (falhou após grace period)');
{
  const notif = await makeAppleNotification('GRACE_PERIOD_EXPIRED');
  const r = await callAppleWebhook(notif);
  ok(r.status === 200, 'GRACE_PERIOD_EXPIRED: 200');

  const sub = await getSubscription(USER_APPLE, 'apple');
  ok(sub?.status === 'expirada', `Status: ${sub?.status}`);
  ok(sub?.cancel_reason === 'billing_error', 'cancel_reason billing_error');
}

console.log('\n4. Recuperação: RENEWAL após DID_FAIL_TO_RENEW -> ativa');
{
  await cleanSubscriptions(USER_APPLE);
  // Simula: SUBSCRIBED -> DID_FAIL_TO_RENEW -> RENEWAL
  const notif1 = await makeAppleNotification('SUBSCRIBED');
  await callAppleWebhook(notif1);

  const notif2 = await makeAppleNotification('DID_FAIL_TO_RENEW', {}, { isInBillingRetryPeriod: true });
  await callAppleWebhook(notif2);

  let sub = await getSubscription(USER_APPLE, 'apple');
  ok(sub?.status === 'pagamento_falhou', `Após falha: ${sub?.status}`);

  const notif3 = await makeAppleNotification('RENEWAL', {
    transactionId: '1000000123456790',
    purchaseDate: Date.now(),
    expirationDate: Date.now() + 30 * 86400000,
  });
  const r = await callAppleWebhook(notif3);
  ok(r.status === 200, 'RENEWAL após falha: 200');

  sub = await getSubscription(USER_APPLE, 'apple');
  ok(sub?.status === 'ativa', `Após recuperação: ${sub?.status}`);
  ok(sub?.retry_count === 0, 'retry_count zerado após recuperação');
}

// ===== GOOGLE ACCOUNT HOLD =====

console.log('\n=== GOOGLE: Account Hold Flow ===');

console.log('\n1. Assinatura ativa inicial');
{
  await cleanSubscriptions(USER_GOOGLE);
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', 'gp_token_123'));
  const r = await callGoogleWebhook(msg);
  ok(r.status === 200, 'SUBSCRIPTION_PURCHASED: 200');

  const sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'ativa' || sub?.status === 'em_teste', `Status inicial: ${sub?.status}`);
}

console.log('\n2. SUBSCRIPTION_ON_HOLD -> pagamento_falhou (account hold)');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_ON_HOLD', 'gp_token_123'));
  const r = await callGoogleWebhook(msg);
  ok(r.status === 200, 'SUBSCRIPTION_ON_HOLD: 200');

  const sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'pagamento_falhou', `Status: ${sub?.status}`);
  ok((sub?.retry_count ?? 0) >= 1, 'retry_count >= 1');
}

console.log('\n3. SUBSCRIPTION_IN_GRACE_PERIOD -> ativa (grace period, não bloqueia acesso)');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_IN_GRACE_PERIOD', 'gp_token_123'));
  const r = await callGoogleWebhook(msg);
  ok(r.status === 200, 'SUBSCRIPTION_IN_GRACE_PERIOD: 200');

  const sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'ativa', `Status mantido ativa: ${sub?.status}`);
  ok((sub?.retry_count ?? 0) >= 1, 'retry_count >= 1');
}

console.log('\n4. SUBSCRIPTION_RESTARTED -> ativa (recuperação de account hold)');
{
  const msg = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_RESTARTED', 'gp_token_123'));
  const r = await callGoogleWebhook(msg);
  ok(r.status === 200, 'SUBSCRIPTION_RESTARTED: 200');

  const sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'ativa', `Status recuperado: ${sub?.status}`);
  ok(sub?.retry_count === 0, 'retry_count zerado');
}

console.log('\n5. SUBSCRIPTION_EXPIRED após account hold -> expirada');
{
  await cleanSubscriptions(USER_GOOGLE);
  const msg1 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', 'gp_token_456'));
  await callGoogleWebhook(msg1);

  const msg2 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_ON_HOLD', 'gp_token_456'));
  await callGoogleWebhook(msg2);

  let sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'pagamento_falhou', `Em hold: ${sub?.status}`);

  const msg3 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_EXPIRED', 'gp_token_456'));
  const r = await callGoogleWebhook(msg3);
  ok(r.status === 200, 'SUBSCRIPTION_EXPIRED: 200');

  sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'expirada', `Expirada: ${sub?.status}`);
  ok(sub?.cancel_reason === 'billing_error', 'cancel_reason billing_error');
}

console.log('\n6. SUBSCRIPTION_REVOKED (chargeback) -> cancelada');
{
  await cleanSubscriptions(USER_GOOGLE);
  const msg1 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_PURCHASED', 'gp_token_789'));
  await callGoogleWebhook(msg1);

  const msg2 = makePubSubMessage(makeSubscriptionNotification('SUBSCRIPTION_REVOKED', 'gp_token_789'));
  const r = await callGoogleWebhook(msg2);
  ok(r.status === 200, 'SUBSCRIPTION_REVOKED: 200');

  const sub = await getSubscription(USER_GOOGLE, 'google');
  ok(sub?.status === 'cancelada', `Cancelada: ${sub?.status}`);
  ok(sub?.cancel_reason === 'billing_error', 'cancel_reason billing_error');
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);