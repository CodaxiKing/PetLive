// Testa a carteirinha por link: só o dono gera, a página pública vê só as
// seções escolhidas, e link cancelado ou inexistente não mostra nada.
// Uso: node supabase/tests/testar-carteirinha.mjs <ANON_KEY>
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

// 1) Só o dono gera o link.
ok((await rpc('criar_link_carteirinha', outro, { p_pet: rex.id, p_secoes: ['dados'], p_horas: 24 })).status >= 400, 'outro usuário não gera link do pet');
ok((await rpc('criar_link_carteirinha', null, { p_pet: rex.id, p_secoes: ['dados'], p_horas: 24 })).status >= 400, 'sem login não gera link');

// 2) A página pública vê só o que foi escolhido.
const link = (await rpc('criar_link_carteirinha', tutor, { p_pet: rex.id, p_secoes: ['vacinas', 'xx'], p_horas: 500 })).corpo;
ok(link?.codigo?.length >= 10, 'gera um código longo');
const horas = (new Date(link.expira_em) - Date.now()) / 3_600_000;
ok(horas > 71 && horas <= 72, 'prazo limitado a 72 horas');
const publica = (await rpc('carteirinha_publica', null, { p_codigo: link.codigo })).corpo;
ok(publica.valido && publica.conteudo.nome === 'Rex', 'página pública abre sem login');
ok(Array.isArray(publica.conteudo.vacinas) && publica.conteudo.raca === undefined && publica.conteudo.tutor === undefined, 'só as seções escolhidas aparecem');
ok(JSON.stringify(publica.secoes) === '["vacinas"]', 'seção desconhecida é ignorada');

// 3) O tutor vê os links e as aberturas, mas ninguém lê o conteúdo direto.
const lista = (await pedir(`/rest/v1/carteirinha_links?select=id,aberturas&codigo=eq.${link.codigo}`, { token: tutor, metodo: 'GET' })).corpo;
ok(lista.length === 1 && lista[0].aberturas === 1, 'tutor vê o link e quantas vezes abriu');
ok((await pedir(`/rest/v1/carteirinha_links?select=id&codigo=eq.${link.codigo}`, { token: outro, metodo: 'GET' })).corpo.length === 0, 'outro usuário não vê o link');
ok((await pedir('/rest/v1/carteirinha_links?select=conteudo', { token: tutor, metodo: 'GET' })).status >= 400, 'conteúdo não é lido direto pela API');

// 4) Cancelado ou inexistente: nenhum dado, nem o nome.
await rpc('cancelar_link_carteirinha', tutor, { p_id: lista[0].id });
ok(JSON.stringify((await rpc('carteirinha_publica', null, { p_codigo: link.codigo })).corpo) === '{"valido":false}', 'link cancelado não mostra nada');
ok(JSON.stringify((await rpc('carteirinha_publica', null, { p_codigo: 'nao-existe' })).corpo) === '{"valido":false}', 'código inexistente não mostra nada');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
