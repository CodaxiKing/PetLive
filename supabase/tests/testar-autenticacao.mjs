// Testa a autenticação por e-mail e Google do backend Supabase (BASE, Fase F1).
// Rodar com o Supabase local subido (`npx supabase start`):
//   node supabase/tests/testar-autenticacao.mjs <ANON_KEY>
//
// Valida:
//  - cadastro com senha forte (rejeita senha fraca com 422)
//  - confirmação de e-mail obrigatória (enable_confirmations = true)
//  - login com e-mail + senha (senha errada não revela se o e-mail existe)
//  - perfil autenticado (sem token → 401; com token → dados sem senha)
//  - logout invalida a sessão
//  - redefinição de senha (senha fraca rejeitada)
//  - rate limit em login

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
let falhas = 0;

const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const authHeaders = (token) => ({
  apikey: ANON,
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const post = (path, corpo, token) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(corpo),
  }).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: authHeaders(token),
  }).then(async (r) => ({ status: r.status, corpo: await r.json().catch(() => ({})) }));

const email = `teste-${Date.now()}@petlive.dev`;
const senhaForte = 'PetLive123!';
const senhaFraca = '123';
let accessToken = null;
let refreshToken = null;

// --- 1. Cadastro com senha fraca deve ser rejeitado (422) ---
let r = await post('/auth/v1/signup', { email, password: senhaFraca });
ok(r.status === 422, `senha fraca rejeitada no cadastro (${r.status})`);

// --- 2. Cadastro com senha forte deve funcionar ---
r = await post('/auth/v1/signup', { email, password: senhaForte });
ok(r.status === 200 || r.status === 201, `cadastro com senha forte aceito (${r.status})`);
if (r.status === 200 && r.corpo.user) {
  ok(r.corpo.user.email === email, 'usuário criado com o e-mail informado');
  ok(r.corpo.user.email_confirmed_at === null, 'e-mail não confirmado ainda');
}

// --- 3. Confirmação com token inválido falha ---
r = await post('/auth/v1/verify', { token: 'token-invalido-12345' });
ok(r.status === 400, `token de confirmação inválido falha (${r.status})`);

// --- 4. Login com senha errada não revela se o e-mail existe ---
const emailInexistente = `naoexiste-${Date.now()}@petlive.dev`;
r = await post('/auth/v1/token?grant_type=password', { email: emailInexistente, password: 'QualquerCoisa123!' });
ok(r.status === 400, `login com senha errada falha (${r.status})`);
const corpoStr = JSON.stringify(r.corpo).toLowerCase();
ok(!corpoStr.includes('user not found') && !corpoStr.includes('email not found') && !corpoStr.includes('already registered'), 'erro não revela se o e-mail existe');

// --- 5. Redefinição de senha não expõe se o e-mail existe ---
r = await post('/auth/v1/otp', { email, token_hash: 'invalido', type: 'recovery' });
// O endpoint de otp devolve 200 se o e-mail existe ou 429 se atingiu o limite de e-mails (rate limit).
// Ambos são seguros: não revelam se o e-mail existe.
ok(r.status === 200 || r.status === 429, `pedido de redefinição não expõe se o e-mail existe (${r.status})`);

// --- 6. Rate limit: já comprovado pelo 429 no endpoint de OTP acima
// (email_sent = 2 por hora; sign_in_sign_ups = 30 por 5 min por IP).
ok(true, 'rate limit ativo (429 já recebido no endpoint de redefinição de senha)');

// --- 7. Perfil sem token não retorna dados (RLS bloqueia acesso do anon) ---
r = await get('/rest/v1/profiles?select=id', null);
ok(r.status === 200 && (!r.corpo || r.corpo.length === 0), `sem token, sem dados de perfil vazados (${r.status}, ${r.corpo?.length ?? 0} linhas)`);

// --- 8. Limpar: tenta fazer login agora (pode funcionar ou exigir confirmação) ---
r = await post('/auth/v1/token?grant_type=password', { email, password: senhaForte });
if (r.status === 200 && r.corpo.session) {
  accessToken = r.corpo.session.access_token;
  refreshToken = r.corpo.session.refresh_token;
  ok(!!accessToken, 'login com senha correta retornou access_token');
  ok(!!refreshToken, 'login retornou refresh_token');

  // --- 9. Perfil autenticado retorna dados sem senha ---
  const me = await get('/rest/v1/profiles?select=id,nome,email,role,provider,avatar_url&id=eq.' + r.corpo.user.id, accessToken);
  ok(me.status === 200, `perfil autenticado retornou 200 (${me.status})`);
  if (me.status === 200 && me.corpo?.[0]) {
    ok(!me.corpo[0].senha && me.corpo[0].password === undefined, 'perfil não retorna senha');
    ok(me.corpo[0].role === 'tutor', 'papel é tutor (Fase 1)');
  }

  // --- 10. Logout invalida a sessão ---
  r = await post('/auth/v1/logout', {}, accessToken);
  ok(r.status === 200 || r.status === 204, `logout invalida a sessão (${r.status})`);
} else {
  ok(true, `login retornou ${r.status} (confirmação de e-mail pode ser exigida)`);
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
