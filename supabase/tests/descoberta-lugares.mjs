// Teste de integração exclusivamente local. Não aceita banco remoto.
// Iniciar `supabase functions serve discover-places` antes de executar.
import assert from 'node:assert/strict';
import { createClient } from '../../apps/tutor/node_modules/@supabase/supabase-js/dist/index.mjs';

const url = process.env.LOCAL_SUPABASE_URL || 'http://127.0.0.1:54321';
assert(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Teste permitido apenas no ambiente local');
const admin = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const cliente = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const email = `mapa-${Date.now()}@example.invalid`;
const senha = `Teste-${crypto.randomUUID()}`;
let usuario;
try {
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  assert.ifError(error);
  usuario = data.user;
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  assert.ifError(login.error);
  const chamar = (corpo, token = login.data.session.access_token) => fetch(`${url}/functions/v1/discover-places`, {
    method: 'POST', headers: { apikey: process.env.LOCAL_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo), signal: AbortSignal.timeout(35_000),
  });
  assert.equal((await chamar({ lat: 91, lng: 0 })).status, 400);
  assert.equal((await chamar({ lat: 0, lng: 0 }, 'invalido')).status, 401);
  for (const regiao of [{ nome: 'Nova Iguaçu', lat: -22.76, lng: -43.45 }, { nome: 'Curitiba', lat: -25.43, lng: -49.27 }]) {
    const corpo = { lat: regiao.lat, lng: regiao.lng, raioKm: 3 };
    const resposta = await chamar(corpo);
    const dados = await resposta.json();
    assert.equal(resposta.status, 200, JSON.stringify(dados));
    assert(dados.lugares.length > 0, 'A região deve retornar estabelecimentos públicos');
    assert(dados.lugares.every((l) => l.id && l.fonte === 'osm' && Number.isFinite(l.lat)));
    const repetida = await chamar(corpo);
    assert.equal(repetida.status, 200);
    assert.deepEqual((await repetida.json()).lugares.map((l) => l.id), dados.lugares.map((l) => l.id));
    const ficha = await cliente.from('places').select('id,nome').eq('id', dados.lugares[0].id).single();
    assert.ifError(ficha.error);
    console.log(`${regiao.nome}: ${dados.lugares.length} lugares, cache e ficha OK; categorias: ${[...new Set(dados.lugares.map((l) => l.categoria))].join(', ')}`);
  }
  console.log('Autenticação e validação de entrada OK');
} finally {
  // Remove somente os IDs reservados ao provedor determinístico de teste local.
  await admin.from('places').delete().in('fonte_id', ['node/9900000010', 'way/9900000011', 'node/9900000012', 'node/9900000020', 'way/9900000021', 'node/9900000022']);
  if (usuario) {
    const { error } = await admin.auth.admin.deleteUser(usuario.id);
    assert.ifError(error);
    console.log('Conta de teste local removida');
  }
}
