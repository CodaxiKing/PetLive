// Testa o modo memorial e o pet sênior: só o dono registra e reativa,
// o que pausa volta, a rotina sênior é criada uma vez e a escala é privada.
// Uso: node supabase/tests/testar-memorial-senior.mjs <ANON_KEY>
// Precisa de demo@petlive.dev (dona da Mia) e admin@petlive.dev (outro usuário).

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
const mia = (await pedir('/rest/v1/pets?select=id&nome=eq.Mia', { token: tutor, metodo: 'GET' })).corpo[0];
const hoje = new Date().toISOString().slice(0, 10);

// Memorial
ok((await rpc('registrar_partida', outro, { p_pet: mia.id, p_data: hoje })).status >= 400, 'outro usuário não registra a partida');
ok((await rpc('registrar_partida', tutor, { p_pet: mia.id, p_data: '2999-01-01' })).status >= 400, 'data no futuro é barrada');
const ativosAntes = (await pedir(`/rest/v1/reminders?select=id&pet_id=eq.${mia.id}&ativo=eq.true`, { token: tutor, metodo: 'GET' })).corpo.length;
ok((await rpc('registrar_partida', tutor, { p_pet: mia.id, p_data: hoje, p_mensagem: 'Teste' })).status < 300, 'registra a partida');
const petDepois = (await pedir(`/rest/v1/pets?select=em_memoria&id=eq.${mia.id}`, { token: tutor, metodo: 'GET' })).corpo[0];
const ativosDurante = (await pedir(`/rest/v1/reminders?select=id&pet_id=eq.${mia.id}&ativo=eq.true`, { token: tutor, metodo: 'GET' })).corpo.length;
ok(petDepois.em_memoria === true && ativosDurante === 0, 'pet em memória e lembretes pausados');
ok((await rpc('reativar_pet', outro, { p_pet: mia.id })).status >= 400, 'outro usuário não reativa');
ok((await rpc('reativar_pet', tutor, { p_pet: mia.id })).status < 300, 'reativa o pet');
const ativosDepois = (await pedir(`/rest/v1/reminders?select=id&pet_id=eq.${mia.id}&ativo=eq.true`, { token: tutor, metodo: 'GET' })).corpo.length;
ok(ativosDepois >= Math.min(ativosAntes, 1) && ativosDepois <= ativosAntes, 'lembretes futuros voltam ao reativar');

// Sênior (Mia nasceu há mais de 10 anos nos dados de teste)
ok((await rpc('conferir_senior', tutor, { p_pet: mia.id })).corpo === true, 'pet com idade sênior é marcado');
await rpc('conferir_senior', tutor, { p_pet: mia.id });
const rotina = (await pedir(`/rest/v1/reminders?select=id&pet_id=eq.${mia.id}&rotina_item=like.senior*`, { token: tutor, metodo: 'GET' })).corpo;
ok(rotina.length === 3, 'rotina sênior criada uma vez só (3 lembretes)');
ok((await rpc('conferir_senior', outro, { p_pet: mia.id })).corpo === false, 'outro usuário não mexe no sênior');

// Escala
const notas = { dor: 7, apetite: 6, higiene: 8, hidratacao: 7, mobilidade: 5, dias: 6, felicidade: 8 };
ok((await pedir('/rest/v1/qualidade_vida', { token: tutor, corpo: { pet_id: mia.id, notas, total: 47 } })).status < 300, 'registra a escala');
ok((await pedir('/rest/v1/qualidade_vida', { token: tutor, corpo: { pet_id: mia.id, notas: { dor: 7 }, total: 7 } })).status >= 400, 'escala incompleta é barrada');
ok((await pedir('/rest/v1/qualidade_vida', { token: outro, corpo: { pet_id: mia.id, notas, total: 47 } })).status >= 400, 'outro usuário não registra no pet');
ok((await pedir('/rest/v1/qualidade_vida?select=id', { token: outro, metodo: 'GET' })).corpo.length === 0, 'outro usuário não vê a escala');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
