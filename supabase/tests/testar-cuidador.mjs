// Testa o cuidador temporário: só o dono cria, 1 acesso ativo no plano
// grátis, a visão sem login respeita o que foi liberado, o cuidador marca
// a dose e, revogado, nada aparece.
// Uso: node supabase/tests/testar-cuidador.mjs <ANON_KEY>
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
    headers: { apikey: ANON, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
// Começa limpo: revoga o que estiver ativo.
for (const a of (await pedir('/rest/v1/cuidador_acessos?select=id&revogado_em=is.null', { token: tutor, metodo: 'GET' })).corpo) {
  await rpc('revogar_acesso_cuidador', tutor, { p_id: a.id });
}
const fim = new Date(Date.now() + 2 * 86_400_000).toISOString();

ok((await rpc('criar_acesso_cuidador', outro, { p_pets: [rex.id], p_cuidador: 'Intruso', p_fim: fim })).status >= 400, 'outro usuário não cria acesso ao pet');
ok((await rpc('criar_acesso_cuidador', tutor, { p_pets: [rex.id], p_cuidador: 'Ana', p_fim: new Date(Date.now() + 90 * 86_400_000).toISOString() })).status >= 400, 'acesso de mais de 60 dias é barrado');
const acesso = (await rpc('criar_acesso_cuidador', tutor, { p_pets: [rex.id], p_cuidador: 'Ana', p_fim: fim, p_vacinas: true, p_remedios: true, p_contatos: false })).corpo;
ok(acesso?.codigo?.length >= 10, 'cria o acesso');
ok((await rpc('criar_acesso_cuidador', tutor, { p_pets: [rex.id], p_cuidador: 'Bia', p_fim: fim })).status >= 400, 'plano grátis: só 1 acesso ativo');

const visao = (await rpc('cuidador_visao', null, { p_codigo: acesso.codigo })).corpo;
ok(visao.valido && visao.pets[0].nome === 'Rex', 'cuidador abre sem login');
ok(visao.pets[0].alergias == null && visao.tutor.telefone == null, 'contatos e alergias ficam de fora quando não liberados');
const dose = visao.pets[0].doses?.[0];
if (dose) {
  ok((await rpc('cuidador_marcar_dose', null, { p_codigo: acesso.codigo, p_medication: dose.medication_id, p_prevista_para: dose.prevista_para })).status < 300, 'cuidador marca a dose');
  const depois = (await rpc('cuidador_visao', null, { p_codigo: acesso.codigo })).corpo;
  ok(depois.pets[0].doses.find((d) => d.prevista_para === dose.prevista_para)?.confirmada_em, 'dose aparece como dada');
}
ok((await rpc('cuidador_marcar_dose', null, { p_codigo: acesso.codigo, p_medication: '00000000-0000-4000-8000-000000000000', p_prevista_para: new Date().toISOString() })).status >= 400, 'remédio de fora do acesso é barrado');

const meus = (await pedir('/rest/v1/cuidador_acessos?select=id,aberturas&revogado_em=is.null', { token: tutor, metodo: 'GET' })).corpo;
ok(meus.length === 1 && meus[0].aberturas >= 1, 'tutor vê o acesso e as aberturas');
ok((await pedir('/rest/v1/cuidador_acessos?select=id', { token: outro, metodo: 'GET' })).corpo.length === 0, 'outro usuário não vê os acessos');
await rpc('revogar_acesso_cuidador', tutor, { p_id: meus[0].id });
ok(JSON.stringify((await rpc('cuidador_visao', null, { p_codigo: acesso.codigo })).corpo) === '{"valido":false}', 'acesso revogado não mostra nada');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
