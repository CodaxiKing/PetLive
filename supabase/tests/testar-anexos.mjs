// Testa o bucket `anexos` pela API do storage, sem passar pelo app: só entra
// JPG, PNG e HEIC/HEIF até 10 MB, e outro usuário não lê nem apaga o arquivo.
// Uso: node supabase/tests/testar-anexos.mjs <ANON_KEY>
//  (ou SUPABASE_ANON_KEY e SUPABASE_URL no ambiente; `pnpm verify:supabase` já faz isso)
// Não depende do seed: cria dois usuários de teste na hora (o Supabase local
// vem com a confirmação de e-mail desligada).

const BASE = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.argv[2] || process.env.SUPABASE_ANON_KEY;
if (!ANON) {
  console.error('Falta a ANON_KEY: node supabase/tests/testar-anexos.mjs <ANON_KEY>');
  process.exit(1);
}
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const criarUsuario = async (nome) => {
  const email = `teste-anexos-${nome}-${Date.now()}@petlive.dev`;
  const r = await fetch(`${BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'petlive123' }),
  });
  const corpo = await r.json();
  if (!corpo.access_token) {
    console.error(`Não deu para criar ${email} (${r.status}): ${JSON.stringify(corpo)}`);
    process.exit(1);
  }
  return { token: corpo.access_token, uid: corpo.user.id };
};
const subir = (caminho, token, tipo, bytes = new Uint8Array(16)) =>
  fetch(`${BASE}/storage/v1/object/anexos/${caminho}`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': tipo },
    body: bytes,
  });
const baixar = (caminho, token) =>
  fetch(`${BASE}/storage/v1/object/authenticated/anexos/${caminho}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
const apagar = (caminhos, token) =>
  fetch(`${BASE}/storage/v1/object/anexos`, {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: caminhos }),
  });

const tutor = await criarUsuario('dono');
const outro = await criarUsuario('outro');
const pasta = `${tutor.uid}/anexos/teste-${Date.now()}`;

for (const tipo of ['image/gif', 'image/webp', 'application/pdf']) {
  const r = await subir(`${pasta}/recusado.${tipo.split('/')[1]}`, tutor.token, tipo);
  ok(r.status >= 400, `upload direto com ${tipo} é recusado pelo bucket (${r.status})`);
}

const grande = await subir(`${pasta}/grande.jpg`, tutor.token, 'image/jpeg', new Uint8Array(10 * 1024 * 1024 + 1));
ok(grande.status >= 400, `upload direto acima de 10 MB é recusado pelo bucket (${grande.status})`);

const aceitos = [];
for (const tipo of ['image/jpeg', 'image/png', 'image/heic', 'image/heif']) {
  const caminho = `${pasta}/aceito.${tipo.split('/')[1]}`;
  const r = await subir(caminho, tutor.token, tipo);
  ok(r.status === 200, `upload com ${tipo} entra (${r.status})`);
  if (r.status === 200) aceitos.push(caminho);
}

ok((await subir(`${pasta}/invasor.jpg`, outro.token, 'image/jpeg')).status >= 400, 'outro usuário não sobe na pasta do dono');

if (aceitos.length) {
  ok((await baixar(aceitos[0], outro.token)).status >= 400, 'outro usuário não baixa o arquivo');
  await apagar([aceitos[0]], outro.token);
  ok((await baixar(aceitos[0], tutor.token)).status === 200, 'outro usuário não apaga o arquivo (o dono ainda baixa)');
}

// Limpeza: o dono apaga o que subiu.
ok((await apagar(aceitos, tutor.token)).status === 200, 'o dono apaga os arquivos de teste');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
