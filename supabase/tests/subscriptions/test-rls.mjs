// PetLive: Testes de RLS para assinaturas.
// Verifica que tutor A não lê assinatura do tutor B; admin_finance lê todas.
// Roda: node supabase/tests/subscriptions/test-rls.mjs <ANON_KEY>

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
if (!ANON) {
  console.error('Uso: node test-rls.mjs <ANON_KEY>');
  process.exit(1);
}

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Cria usuário de teste.
async function createUser(email, password) {
  const r = await fetch(`${BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  return r.json();
}

// Login e pega token.
async function login(email, password) {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
}

// Insere assinatura via service_role.
async function insertSubscription(userId, provider = 'apple') {
  const plan = await fetch(`${BASE}/rest/v1/plans?code=eq.premium_mensal&select=id`, { headers: { apikey: ANON } }).then(r => r.json());
  return fetch(`${BASE}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      plan_id: plan[0]?.id,
      provider,
      provider_subscription_id: `${provider}_${userId}_123`,
      provider_original_transaction_id: `${provider}_${userId}_orig`,
      status: 'ativa',
      started_at: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      renews_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
  }).then(r => r.json());
}

// ===== TESTES =====

console.log('\n=== Setup: cria usuários de teste ===');
const userA = await createUser('test_rls_a@petlive.dev', 'test123456');
const userB = await createUser('test_rls_b@petlive.dev', 'test123456');
const adminUser = await createUser('test_rls_admin@petlive.dev', 'test123456');

ok(userA?.id, `User A criado: ${userA?.id}`);
ok(userB?.id, `User B criado: ${userB?.id}`);
ok(adminUser?.id, `Admin criado: ${adminUser?.id}`);

const loginA = await login('test_rls_a@petlive.dev', 'test123456');
const loginB = await login('test_rls_b@petlive.dev', 'test123456');
const loginAdmin = await login('test_rls_admin@petlive.dev', 'test123456');

const tokenA = loginA?.access_token;
const tokenB = loginB?.access_token;
const tokenAdmin = loginAdmin?.access_token;

ok(tokenA, 'Token A obtido');
ok(tokenB, 'Token B obtido');
ok(tokenAdmin, 'Token Admin obtido');

// Adiciona admin_finance role ao admin
await fetch(`${BASE}/rest/v1/admin_members`, {
  method: 'POST',
  headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
  body: JSON.stringify({ user_id: adminUser.id, papel: 'financeiro', active: true }),
});

console.log('\n=== Insere assinaturas ===');
const subA = await insertSubscription(userA.id, 'apple');
const subB = await insertSubscription(userB.id, 'google');

ok(subA?.id, `Assinatura A criada: ${subA?.id}`);
ok(subB?.id, `Assinatura B criada: ${subB?.id}`);

console.log('\n=== 1. Tutor A lê própria assinatura ===');
{
  const r = await fetch(`${BASE}/rest/v1/subscriptions?select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tokenA}` },
  });
  const data = await r.json();
  ok(r.ok, `Status ${r.status}`);
  ok(data.length === 1, `Vê 1 assinatura (own)`);
  ok(data[0]?.user_id === userA.id, 'Assinatura pertence ao user A');
}

console.log('\n=== 2. Tutor A NÃO lê assinatura do Tutor B ===');
{
  const r = await fetch(`${BASE}/rest/v1/subscriptions?select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tokenA}` },
  });
  const data = await r.json();
  ok(data.every(d => d.user_id === userA.id), 'Só vê próprias assinaturas');
  ok(!data.some(d => d.user_id === userB.id), 'Não vê assinatura do user B');
}

console.log('\n=== 3. Tutor B lê própria assinatura ===');
{
  const r = await fetch(`${BASE}/rest/v1/subscriptions?select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tokenB}` },
  });
  const data = await r.json();
  ok(r.ok, `Status ${r.status}`);
  ok(data.length === 1, `Vê 1 assinatura (own)`);
  ok(data[0]?.user_id === userB.id, 'Assinatura pertence ao user B');
}

console.log('\n=== 4. Admin financeiro lê TODAS as assinaturas (via RPC plano_ativo_do_usuario) ===');
{
  // Testa a função security definer que ignora RLS
  const r = await fetch(`${BASE}/rest/v1/rpc/plano_ativo_do_usuario`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userA.id }),
  });
  const data = await r.json();
  ok(r.ok, `RPC plano_ativo_do_usuario responde ${r.status}`);
  ok(data?.id === subA.id, 'Admin vê assinatura do user A via RPC');
}

console.log('\n=== 5. Admin financeiro lê assinatura do user B via RPC ===');
{
  const r = await fetch(`${BASE}/rest/v1/rpc/plano_ativo_do_usuario`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_user_id: userB.id }),
  });
  const data = await r.json();
  ok(r.ok, `RPC responde ${r.status}`);
  ok(data?.id === subB.id, 'Admin vê assinatura do user B via RPC');
}

console.log('\n=== 6. Tutor A NÃO consegue inserir assinatura para Tutor B ===');
{
  const plan = await fetch(`${BASE}/rest/v1/plans?code=eq.premium_mensal&select=id`, { headers: { apikey: ANON } }).then(r => r.json());
  const r = await fetch(`${BASE}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userB.id, // Tenta inserir para outro user
      plan_id: plan[0]?.id,
      provider: 'apple',
      provider_subscription_id: 'apple_fake_123',
      provider_original_transaction_id: 'apple_fake_orig',
      status: 'ativa',
      started_at: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      renews_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
  });
  ok(r.status === 403 || r.status === 401, `Inserção para outro user bloqueada (${r.status})`);
}

console.log('\n=== 7. Tutor A NÃO consegue atualizar assinatura do Tutor B ===');
{
  const r = await fetch(`${BASE}/rest/v1/subscriptions?id=eq.${subB.id}`, {
    method: 'PATCH',
    headers: { apikey: ANON, Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'cancelada' }),
  });
  ok(r.status === 403 || r.status === 404, `Atualização de outro user bloqueada (${r.status})`);
}

console.log('\n=== 8. Tutor A NÃO consegue deletar assinatura do Tutor B ===');
{
  const r = await fetch(`${BASE}/rest/v1/subscriptions?id=eq.${subB.id}`, {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: `Bearer ${tokenA}`, Prefer: 'return=minimal' },
  });
  ok(r.status === 403 || r.status === 404, `Deleção de outro user bloqueada (${r.status})`);
}

console.log('\n=== 9. Planos: todos autenticados podem ler (active) ===');
{
  const r = await fetch(`${BASE}/rest/v1/plans?select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${tokenA}` },
  });
  const data = await r.json();
  ok(r.ok, `Planos listados (${r.status})`);
  ok(data.length >= 2, 'Pelo menos 2 planos (mensal e anual)');
  ok(data.every(p => p.active === true), 'Só planos ativos');
}

console.log('\n=== 10. Índice único (user_id, provider, provider_subscription_id) impede duplicata ===');
{
  // Tenta inserir duplicata via service_role (deve falhar no banco)
  const r = await fetch(`${BASE}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userA.id,
      plan_id: (await fetch(`${BASE}/rest/v1/plans?code=eq.premium_mensal&select=id`, { headers: { apikey: ANON } }).then(r => r.json()))[0]?.id,
      provider: 'apple',
      provider_subscription_id: subA.provider_subscription_id, // MESMO ID
      provider_original_transaction_id: subA.provider_original_transaction_id,
      status: 'ativa',
      started_at: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      renews_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
  });
  ok(r.status === 409 || r.status === 400, `Duplicata bloqueada pelo índice único (${r.status})`);
}

console.log('\n=== Limpeza ===');
// Remove usuários de teste
for (const u of [userA, userB, adminUser]) {
  if (u?.id) {
    await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { apikey: ANON, Authorization: `Bearer ${serviceKey}` },
    });
  }
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);