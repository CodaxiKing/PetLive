// Testa o QR da coleira e envio de localização por quem encontra o pet.
// Uso: node supabase/tests/testar-qr-localizacao.mjs <ANON_KEY>
// Precisa do Supabase rodando localmente (pnpm supabase:start) e do seed demo.

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

console.log('\n=== Testes do QR da coleira e localização ===\n');

const tutor = await entrar('demo@petlive.dev');
const outro = await entrar('admin@petlive.dev');
const rex = (await pedir('/rest/v1/pets?select=id&nome=eq.Rex', { token: tutor, metodo: 'GET' })).corpo[0];

// 1) Tutor configura o QR com permitir_localizacao_finder = true
const upd = await rpc('atualizar_qr_pet', tutor, {
  p_pet: rex.id,
  p_code: 'TEST123',
  p_show_photo: true,
  p_show_phone: true,
  p_show_allergies: false,
  p_permitir_localizacao_finder: true,
  p_active: true,
});
ok(upd.status === 200, 'tutor atualiza QR com localização permitida');

// 2) Anônimo abre a página pública /p/TEST123 e vê o botão
const publico = (await rpc('public_qr', null, { p_codigo: 'TEST123' })).corpo;
ok(publico.valido === true, 'página pública abre sem login');
ok(publico.pet.nome === 'Rex', 'nome do pet aparece');
ok(publico.permitir_localizacao_finder === true, 'flag permitir_localizacao_finder vem true');
ok(publico.tutor.telefone !== null, 'telefone aparece porque show_phone=true');

// 3) Tutor desliga permitir_localizacao_finder
const upd2 = await rpc('atualizar_qr_pet', tutor, {
  p_pet: rex.id,
  p_code: 'TEST123',
  p_permitir_localizacao_finder: false,
});
ok(upd2.status === 200, 'tutor desliga localização');
const publico2 = (await rpc('public_qr', null, { p_codigo: 'TEST123' })).corpo;
ok(publico2.permitir_localizacao_finder === false, 'flag permitir_localizacao_finder agora false');

// 4) Anônimo tenta enviar localização sem permissão -> erro
const semPerm = await rpc('qr_location', null, { p_codigo: 'TEST123', p_lat: -22.9, p_lng: -43.2 });
ok(semPerm.corpo.sucesso === false, 'qr_location falha quando tutor não autorizou');
ok(semPerm.corpo.erro?.includes('não autorizou'), 'mensagem de erro clara');

// 5) Tutor liga novamente
await rpc('atualizar_qr_pet', tutor, {
  p_pet: rex.id,
  p_code: 'TEST123',
  p_permitir_localizacao_finder: true,
});

// 6) Anônimo envia localização válida
const comPerm = await rpc('qr_location', null, { p_codigo: 'TEST123', p_lat: -22.9068, p_lng: -43.1729 });
ok(comPerm.corpo.sucesso === true, 'qr_location succeeds com permissão');

// 7) Mesmo IP não pode enviar de novo (anti-spam 1 por abertura)
const segunda = await rpc('qr_location', null, { p_codigo: 'TEST123', p_lat: -22.9068, p_lng: -43.1729 });
ok(segunda.corpo.sucesso === false, 'segunda tentativa do mesmo IP falha');
ok(segunda.corpo.erro?.includes('já enviada'), 'mensagem anti-spam clara');

// 8) QR inexistente -> erro
const inexistente = await rpc('qr_location', null, { p_codigo: 'NAOEXISTE', p_lat: 0, p_lng: 0 });
ok(inexistente.corpo.sucesso === false, 'qr_location falha com QR inexistente');
ok(inexistente.corpo.erro?.includes('inválido'), 'mensagem de QR inválido');

// 9) QR inativo -> erro
await rpc('atualizar_qr_pet', tutor, { p_pet: rex.id, p_code: 'TEST123', p_active: false });
const inativo = await rpc('qr_location', null, { p_codigo: 'TEST123', p_lat: 0, p_lng: 0 });
ok(inativo.corpo.sucesso === false, 'qr_location falha com QR inativo');

// 10) Verifica se scan foi registrado com lat/lng
const scans = (await pedir('/rest/v1/qr_scans?select=lat,lng,location_sent&pet_id=eq.' + rex.id + '&order=scanned_at.desc&limit=1', { token: tutor, metodo: 'GET' })).corpo;
ok(scans.length === 1, 'scan registrado');
ok(scans[0].location_sent === true, 'location_sent = true');
ok(scans[0].lat !== null && scans[0].lng !== null, 'lat/lng salvos no scan');

// 11) Notificação criada para o tutor
const avisos = (await pedir('/rest/v1/notification_log?select=title,body&type=eq.sistema&order=sent_at.desc&limit=1', { token: tutor, metodo: 'GET' })).corpo;
ok(avisos.length >= 1, 'notificação criada');
ok(avisos[0].title?.includes('Localização'), 'título da notificação menciona localização');
ok(avisos[0].body?.includes('enviou a localização'), 'corpo da notificação menciona envio');

// Limpa o QR de teste
await rpc('atualizar_qr_pet', tutor, { p_pet: rex.id, p_code: 'TEST123', p_active: false });

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);