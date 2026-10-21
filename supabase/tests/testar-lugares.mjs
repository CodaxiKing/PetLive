// Testa as Edge Functions de lugares contra o google-falso.
const BASE = 'http://127.0.0.1:54321';
const ANON = process.argv[2];
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHA'} ${msg}`);
  if (!cond) falhas++;
};

const login = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'demo@petlive.dev', password: 'petlive123' }),
}).then((r) => r.json());
const token = login.access_token;

const chamar = (fn, corpo, auth = token) =>
  fetch(`${BASE}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: JSON.stringify(corpo),
  }).then(async (r) => ({ status: r.status, corpo: await r.json() }));

const centro = { lat: -22.9519, lng: -43.1822 };

let r = await chamar('places-nearby', { ...centro, categoria: 'clinica', raioKm: 10 });
ok(r.status === 200, `nearby clinica responde 200 (${r.status})`);
ok(r.corpo.lugares?.[0]?.nome === 'Clínica Perto', 'ordenado pela distância, mais perto primeiro');
ok(r.corpo.lugares?.[0]?.distancia_km < 1, `distância calculada (${r.corpo.lugares?.[0]?.distancia_km} km)`);
ok(r.corpo.lugares?.every((l) => l.fonte === 'google' && l.categoria === 'clinica'), 'normalizado com fonte e categoria');

r = await chamar('places-nearby', { ...centro, categoria: 'creche', raioKm: 10 });
ok(r.corpo.lugares?.length === 1 && r.corpo.lugares[0].nome.includes('creche'), 'creche por texto fixo; fora do raio descartado');

r = await chamar('places-nearby', { ...centro, categoria: 'restaurante', raioKm: 10 });
ok(r.corpo.lugares?.[0]?.aceita_caes === true, 'pet friendly traz "aceita cães" do Google');

r = await chamar('places-nearby', { ...centro, categoria: 'banana' });
ok(r.status === 400 && r.corpo.erro === 'pedido', 'categoria inválida recusada (400)');

r = await chamar('places-nearby', { ...centro, categoria: 'clinica' }, null);
ok(r.status === 401, `sem sessão recusado (${r.status})`);

r = await chamar('place-details', { placeId: 'ChIJperto0000001' });
ok(r.status === 200 && r.corpo.lugar.telefone === '(21) 99999-0000', 'detalhe com telefone');
ok(r.corpo.lugar?.fotos?.length === 5, `no máximo 5 fotos (${r.corpo.lugar?.fotos?.length})`);
ok(r.corpo.lugar?.fotos?.[0]?.autores?.[0]?.nome === 'Fulano', 'foto com a atribuição do autor');

r = await chamar('place-details', { placeId: '../../segredo' });
ok(r.status === 400, 'place_id malicioso recusado');

r = await chamar('place-photo', { nome: 'places/ChIJperto0000001/photos/foto0', larguraPx: 640 });
ok(r.status === 200 && r.corpo.uri.startsWith('https://lh3.'), 'foto devolve o endereço da imagem');

r = await chamar('nearest-emergency', centro);
ok(r.status === 200 && r.corpo.confirmada24h === true && r.corpo.clinica.nome === 'Hospital Vet 24h', 'SOS acha a 24 h aberta');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
