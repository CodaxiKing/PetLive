// Testa o limite de pets por plano (BUSINESS.md 5.13 e 10): no grátis só o
// pet ativo há mais tempo é editável, o cadastro além do limite é recusado
// com erro tratável (PT402 -> HTTP 402), nada é apagado, pet em memória não
// conta e voltar ao Premium libera tudo na hora.
// Uso: node supabase/tests/testar-limite-pets.mjs <ANON_KEY> <SERVICE_ROLE_KEY>
// Precisa de demo@petlive.dev (Premium, com Rex e Mia). Ao final o demo volta ao Premium.

const BASE = 'http://127.0.0.1:54321';
const [ANON, SERVICE] = process.argv.slice(2);
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const pedir = async (caminho, { token, chave = ANON, metodo = 'POST', corpo } = {}) => {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      apikey: chave,
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
const servidor = (caminho, opcoes) => pedir(caminho, { ...opcoes, chave: SERVICE, token: SERVICE });

const tutor = await entrar('demo@petlive.dev');
const eu = (await pedir('/auth/v1/user', { token: tutor, metodo: 'GET' })).corpo.id;
const mudarPlano = (plano) => servidor(`/rest/v1/profiles?id=eq.${eu}`, { metodo: 'PATCH', corpo: { plano } });
const pets = async () =>
  (await pedir('/rest/v1/pets?select=id,nome,somente_leitura&order=nome', { token: tutor, metodo: 'GET' })).corpo;
const leitura = async (nome) => (await pets()).find((p) => p.nome === nome)?.somente_leitura;
const novoPet = { tutor_id: eu, nome: 'Teste limite', especie: 'cao' };

// Premium: tudo editável
ok((await pets()).every((p) => p.somente_leitura === false), 'no Premium nenhum pet fica só para consulta');
const auto = await pedir(`/rest/v1/profiles?id=eq.${eu}`, { token: tutor, metodo: 'PATCH', corpo: { plano: 'gratis' } });
ok(auto.status >= 400, 'o tutor não muda o próprio plano pela API');

// Volta ao grátis (cancelamento ou falha de cobrança)
await mudarPlano('gratis');
const [rex, mia] = [(await pets()).find((p) => p.nome === 'Rex'), (await pets()).find((p) => p.nome === 'Mia')];
ok(rex.somente_leitura === false && mia.somente_leitura === true, 'no grátis só o pet mais antigo continua editável');
ok((await pets()).length >= 2, 'nenhum pet some por causa do limite');

const cadastro = await pedir('/rest/v1/pets', { token: tutor, corpo: novoPet });
ok(cadastro.status === 402 && cadastro.corpo?.hint === 'limite_pets', 'cadastro além do limite volta 402 (limite_pets)');

const edicao = await pedir(`/rest/v1/pets?id=eq.${mia.id}`, { token: tutor, metodo: 'PATCH', corpo: { nome: 'Outra' } });
ok(edicao.status === 402 && edicao.corpo?.hint === 'somente_leitura', 'editar o pet só para consulta volta 402 (somente_leitura)');
ok((await pets()).some((p) => p.id === mia.id && p.nome === 'Mia'), 'os dados do pet ficam intactos');

const vacinaMia = await pedir('/rest/v1/vaccinations', { token: tutor, corpo: { pet_id: mia.id, nome: 'Teste', aplicada_em: '2026-01-01' } });
ok(vacinaMia.status === 402, 'não adiciona vacina no pet só para consulta');
const vacinasMia = (await pedir(`/rest/v1/vaccinations?select=id&pet_id=eq.${mia.id}`, { token: tutor, metodo: 'GET' })).corpo;
ok(vacinasMia.length > 0, 'as vacinas do pet só para consulta continuam visíveis');
if (vacinasMia[0]) {
  const apagar = await pedir(`/rest/v1/vaccinations?id=eq.${vacinasMia[0].id}`, { token: tutor, metodo: 'DELETE' });
  ok(apagar.status === 402, 'não apaga vacina do pet só para consulta');
}
ok((await pedir('/rest/v1/weights', { token: tutor, corpo: { pet_id: mia.id, peso: 4.3, medido_em: '2026-01-01' } })).status === 402, 'não registra peso no pet só para consulta');

const remedioMia = (await pedir(`/rest/v1/medications?select=id&pet_id=eq.${mia.id}`, { token: tutor, metodo: 'GET' })).corpo[0];
if (remedioMia) {
  const dose = await rpc('registrar_dose', tutor, { p_medication_id: remedioMia.id, p_prevista_para: new Date().toISOString(), p_acao: 'dei', p_origem: 'app' });
  ok(dose.status === 402, 'não marca Feito em dose do pet só para consulta');
}

const lembreteMia = await pedir('/rest/v1/reminders', { token: tutor, corpo: { tutor_id: eu, pet_id: mia.id, tipo: 'outro', titulo: 'Teste', proxima_em: new Date().toISOString() } });
ok(lembreteMia.status === 402, 'não cria lembrete no pet só para consulta');
const lembretesMia = (await pedir(`/rest/v1/reminders?select=id&pet_id=eq.${mia.id}`, { token: tutor, metodo: 'GET' })).corpo;
if (lembretesMia[0]) {
  const feito = await pedir(`/rest/v1/reminders?id=eq.${lembretesMia[0].id}`, { token: tutor, metodo: 'PATCH', corpo: { ativo: false } });
  ok(feito.status === 402, 'não marca Feito nem desliga lembrete do pet só para consulta');
}
ok((await pedir('/rest/v1/viagens', { token: tutor, corpo: { pet_id: mia.id, modo: 'carro' } })).status === 402, 'não salva checklist de viagem do pet só para consulta');
ok((await pedir('/rest/v1/despesas', { token: tutor, corpo: { pet_id: mia.id, categoria: 'racao', valor_centavos: 100 } })).status === 402, 'não registra despesa do pet só para consulta');
const despesaGeral = await pedir('/rest/v1/despesas', { token: tutor, corpo: { categoria: 'racao', valor_centavos: 100 } });
ok(despesaGeral.status < 300, 'despesa de todos os pets continua liberada');
if (despesaGeral.corpo?.[0]) await pedir(`/rest/v1/despesas?id=eq.${despesaGeral.corpo[0].id}`, { token: tutor, metodo: 'DELETE' });
const cuidador = await rpc('criar_acesso_cuidador', tutor, { p_pets: [mia.id], p_cuidador: 'Teste', p_fim: new Date(Date.now() + 86_400_000).toISOString() });
ok(cuidador.status === 402 || cuidador.corpo?.message?.includes('1 acesso ativo'), 'não cria acesso de cuidador com o pet só para consulta');

const vacinaRex = await pedir('/rest/v1/vaccinations', { token: tutor, corpo: { pet_id: rex.id, nome: 'Teste', aplicada_em: '2026-01-01' } });
ok(vacinaRex.status < 300, 'o pet editável segue com todas as funções');
if (vacinaRex.corpo?.[0]) await pedir(`/rest/v1/vaccinations?id=eq.${vacinaRex.corpo[0].id}`, { token: tutor, metodo: 'DELETE' });

ok((await pedir(`/rest/v1/pets?id=eq.${rex.id}`, { token: tutor, metodo: 'PATCH', corpo: { ativo_desde: '2000-01-01T00:00:00Z' } })).status >= 400,
  'o tutor não mexe na ordem de quem fica editável');

// Em memória não conta; quem volta da memória entra no fim da fila
const hoje = new Date().toISOString().slice(0, 10);
ok((await rpc('registrar_partida', tutor, { p_pet: rex.id, p_data: hoje })).status < 300, 'registra a partida do pet editável');
ok((await leitura('Mia')) === false, 'com o outro em memória, a Mia fica editável');
ok((await rpc('reativar_pet', tutor, { p_pet: rex.id })).status < 300, 'reativa o pet');
ok((await leitura('Rex')) === true && (await leitura('Mia')) === false, 'no grátis o pet reativado volta só para consulta');

// Volta ao Premium: tudo editável na hora
await mudarPlano('premium');
ok((await pets()).every((p) => p.somente_leitura === false), 'de volta ao Premium, todos editáveis sem outra ação');
const outro = await pedir('/rest/v1/pets', { token: tutor, corpo: novoPet });
ok(outro.status < 300, 'no Premium cadastra mais pets');
if (outro.corpo?.[0]) await pedir(`/rest/v1/pets?id=eq.${outro.corpo[0].id}`, { token: tutor, metodo: 'DELETE' });

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
