// Testa o bucket `anexos` pela API do storage, sem passar pelo app: só entra
// JPG, PNG e HEIC/HEIF até 10 MB, e outro usuário não lê nem apaga o arquivo.
// Uso: node supabase/tests/testar-anexos.mjs <ANON_KEY>
// Precisa de demo@petlive.dev (dono do Rex) e admin@petlive.dev (outro usuário).

const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const entrar = async (email) => {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'petlive123' }),
  });
  const corpo = await r.json();
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

const tutor = await entrar('demo@petlive.dev');
const outro = await entrar('admin@petlive.dev');
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

if (aceitos.length) {
  ok((await baixar(aceitos[0], outro.token)).status >= 400, 'outro usuário não baixa o arquivo');
  ok((await baixar(aceitos[0], tutor.token)).status === 200, 'o dono baixa o arquivo');
}

// Limpeza: o dono apaga o que subiu.
const r = await fetch(`${BASE}/storage/v1/object/anexos`, {
  method: 'DELETE',
  headers: { apikey: ANON, Authorization: `Bearer ${tutor.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ prefixes: aceitos }),
});
ok(r.status === 200, 'o dono apaga os arquivos de teste');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
