// Testa as despesas: cada tutor só vê e mexe nas suas, não usa pet de
// outro, o recibo fica na pasta dele e o valor precisa ser positivo.
// Uso: node supabase/tests/testar-despesas.mjs <ANON_KEY>
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

const tutor = await entrar('demo@petlive.dev');
const outro = await entrar('admin@petlive.dev');
const rex = (await pedir('/rest/v1/pets?select=id&nome=eq.Rex', { token: tutor, metodo: 'GET' })).corpo[0];

const criada = (await pedir('/rest/v1/despesas', { token: tutor, corpo: { pet_id: rex.id, categoria: 'racao', valor_centavos: 1990, anotacao: 'teste' } })).corpo?.[0];
ok(criada?.id, 'tutor cria despesa do pet dele');
ok((await pedir('/rest/v1/despesas?select=id', { token: outro, metodo: 'GET' })).corpo.length === 0, 'outro usuário não vê as despesas');
ok((await pedir('/rest/v1/despesas', { token: outro, corpo: { pet_id: rex.id, categoria: 'racao', valor_centavos: 100 } })).status >= 400, 'não cria despesa em pet de outro');
ok((await pedir('/rest/v1/despesas', { token: tutor, corpo: { categoria: 'racao', valor_centavos: 100, recibo_path: 'outro/arquivo.jpg' } })).status >= 400, 'recibo fora da pasta do tutor é barrado');
ok((await pedir('/rest/v1/despesas', { token: tutor, corpo: { categoria: 'racao', valor_centavos: 0 } })).status >= 400, 'valor zero é barrado');
ok((await pedir(`/rest/v1/despesas?id=eq.${criada.id}`, { token: outro, metodo: 'DELETE' })).corpo.length === 0, 'outro usuário não apaga');
ok((await pedir(`/rest/v1/despesas?id=eq.${criada.id}`, { token: tutor, metodo: 'DELETE' })).corpo.length === 1, 'tutor apaga a dele');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
