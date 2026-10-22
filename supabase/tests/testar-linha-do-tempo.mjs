// Testa a linha do tempo: marcos só do dono, foto na pasta dele, limite
// de 10 fotos no plano grátis e os marcos automáticos.
// Uso: node supabase/tests/testar-linha-do-tempo.mjs <ANON_KEY>
// Precisa de demo@petlive.dev (dono do Rex) e admin@petlive.dev (outro usuário).

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
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : null };
};
const entrar = async (email) =>
  (await pedir('/auth/v1/token?grant_type=password', { corpo: { email, password: 'petlive123' } })).corpo.access_token;
const rpc = (nome, token, corpo = {}) => pedir(`/rest/v1/rpc/${nome}`, { token, corpo });

const tutor = await entrar('demo@petlive.dev');
const outro = await entrar('admin@petlive.dev');
const rex = (await pedir('/rest/v1/pets?select=id&nome=eq.Rex', { token: tutor, metodo: 'GET' })).corpo[0];
const uid = JSON.parse(Buffer.from(tutor.split('.')[1], 'base64url').toString()).sub;

const linha = (await rpc('linha_do_tempo', tutor, { p_pet: rex.id })).corpo;
ok(linha.some((i) => i.tipo === 'aniversario') && linha.some((i) => i.tipo === 'vacina'), 'linha do tempo traz aniversários e vacinas');
ok((await rpc('linha_do_tempo', outro, { p_pet: rex.id })).corpo.every((i) => i.manual === false && i.tipo !== 'vacina') , 'outro usuário não vê vacinas nem marcos do pet');
ok((await pedir('/rest/v1/marcos', { token: outro, corpo: { pet_id: rex.id, data: '2025-01-01', titulo: 'Intruso' } })).status >= 400, 'não cria marco em pet de outro');
ok((await pedir('/rest/v1/marcos', { token: tutor, corpo: { pet_id: rex.id, data: '2025-01-01', titulo: 'Foto alheia', foto_path: 'outro/x.jpg' } })).status >= 400, 'foto fora da pasta do tutor é barrada');

// Limite de fotos do grátis: cria até 10 e a 11ª é barrada.
const ja = (await pedir('/rest/v1/marcos?select=id&foto_path=not.is.null', { token: tutor, metodo: 'GET' })).corpo.length;
const criados = [];
for (let i = ja; i < 10; i++) {
  const r = await pedir('/rest/v1/marcos', { token: tutor, corpo: { pet_id: rex.id, data: '2024-01-01', titulo: `Teste ${i}`, foto_path: `${uid}/marcos/teste-${i}.jpg` } });
  criados.push(r.corpo[0].id);
}
ok((await pedir('/rest/v1/marcos', { token: tutor, corpo: { pet_id: rex.id, data: '2024-01-01', titulo: 'Passou', foto_path: `${uid}/marcos/teste-11.jpg` } })).status >= 400, 'plano grátis: a 11ª foto é barrada');
ok((await pedir('/rest/v1/marcos', { token: tutor, corpo: { pet_id: rex.id, data: '2024-01-01', titulo: 'Sem foto passa' } })).status < 300, 'marco sem foto continua liberado');
for (const id of criados) await pedir(`/rest/v1/marcos?id=eq.${id}`, { token: tutor, metodo: 'DELETE' });
await pedir('/rest/v1/marcos?titulo=eq.Sem%20foto%20passa', { token: tutor, metodo: 'DELETE' });

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
