// Testa o acesso ao painel admin: sem 2FA é recusado, com 2FA entra, e o
// tutor comum nunca entra. Uso: node supabase/tests/testar-admin.mjs <ANON_KEY>
// Precisa de admin@petlive.dev (super, sem fator) e demo@petlive.dev (tutor).
import { createHmac } from 'node:crypto';

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const pedir = async (caminho, { token, metodo = 'POST', corpo } = {}) => {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { apikey: ANON, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
};
const entrar = async (email) =>
  (await pedir('/auth/v1/token?grant_type=password', { corpo: { email, password: 'petlive123' } })).corpo.access_token;
const rpc = (nome, token, corpo = {}) => pedir(`/rest/v1/rpc/${nome}`, { token, corpo });

// TOTP (RFC 6238) para gerar o código do "app autenticador".
function totp(segredoBase32) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of segredoBase32.replace(/=+$/, '')) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0');
  const chave = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac('sha1', chave).update(contador).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}

// 1) Tutor comum.
const tutor = await entrar('demo@petlive.dev');
ok((await rpc('admin_eu', tutor)).corpo.admin === false, 'tutor comum não é da equipe');
ok((await rpc('admin_visao', tutor)).status >= 400, 'tutor comum não vê a visão geral');

// 2) Admin sem o segundo fator.
const aal1 = await entrar('admin@petlive.dev');
const eu1 = (await rpc('admin_eu', aal1)).corpo;
ok(eu1.admin === true && eu1.verificado === false, 'admin sem 2FA: é da equipe, mas não verificado');
ok((await rpc('admin_visao', aal1)).status >= 400, 'admin sem 2FA não vê dados');

// 3) Cadastra o app autenticador e verifica.
const fator = (await pedir('/auth/v1/factors', { token: aal1, corpo: { factor_type: 'totp', friendly_name: `teste-${Date.now()}` } })).corpo;
ok(Boolean(fator.totp?.secret), 'cadastro do app autenticador devolve o segredo (QR)');
const desafio = (await pedir(`/auth/v1/factors/${fator.id}/challenge`, { token: aal1, corpo: {} })).corpo;
const verificado = (await pedir(`/auth/v1/factors/${fator.id}/verify`, {
  token: aal1,
  corpo: { challenge_id: desafio.id, code: totp(fator.totp.secret) },
})).corpo;
const aal2 = verificado.access_token;
ok(Boolean(aal2), 'código do autenticador aceito');
ok((await rpc('admin_eu', aal2)).corpo.verificado === true, 'com 2FA: verificado');

const visao = await rpc('admin_visao', aal2);
ok(visao.status === 200 && typeof visao.corpo.tutores === 'number', `visão geral com 2FA (${visao.corpo.tutores} tutores)`);
const usuarios = (await rpc('admin_usuarios', aal2, { p_busca: 'demo' })).corpo;
ok(Array.isArray(usuarios) && usuarios[0]?.email === 'demo@petlive.dev', 'busca de usuários acha o demo');
const ficha = (await rpc('admin_usuario', aal2, { p_id: usuarios[0].id })).corpo;
ok(ficha.pets.length >= 1 && !('peso' in ficha.pets[0]), 'ficha traz pets sem dados de saúde');

// 4) Suspender e reativar grava na auditoria.
ok((await rpc('admin_suspender', aal2, { p_id: usuarios[0].id, p_suspender: true, p_motivo: 'teste' })).status < 300, 'suspende a conta');
ok((await pedir('/auth/v1/token?grant_type=password', { corpo: { email: 'demo@petlive.dev', password: 'petlive123' } })).status === 400, 'conta suspensa não entra');
ok((await rpc('admin_suspender', aal2, { p_id: usuarios[0].id, p_suspender: false })).status < 300, 'reativa a conta');
ok(Boolean(await entrar('demo@petlive.dev')), 'conta reativada entra de novo');
const auditoria = (await rpc('admin_auditoria', aal2)).corpo;
ok(auditoria.some((a) => a.acao === 'suspendeu a conta') && auditoria.some((a) => a.acao === 'reativou a conta'), 'auditoria registra as duas ações');
ok((await rpc('admin_suspender', aal2, { p_id: (await rpc('admin_eu', aal2)).corpo && (await pedir('/auth/v1/user', { token: aal2, metodo: 'GET' })).corpo.id, p_suspender: true })).status >= 400, 'não suspende a si mesmo');

// 5) Ninguém lê as tabelas direto.
ok((await pedir('/rest/v1/audit_log?select=*', { token: aal2, metodo: 'GET' })).status >= 400, 'audit_log não é lido direto pela API');

// Limpa o fator de teste (o admin volta a cadastrar pelo painel).
await pedir(`/auth/v1/factors/${fator.id}`, { token: aal2, metodo: 'DELETE' });

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
