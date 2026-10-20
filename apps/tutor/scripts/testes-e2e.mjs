// Testes ponta a ponta dos fluxos principais (board: [APP-CLIENTE]
// Qualidade: Testes ponta a ponta — cadastro, vacina, lembrete e mapa).
//
// Contra o Supabase local:
//   npx supabase start       (uma vez)
//   node scripts/testes-e2e.mjs
//
// Sai com código 1 se qualquer checagem falhar. Os dados de teste são
// removidos no fim (pets, vacinas e lembretes); os usuários de e2e
// ficam no auth local — use e-mails com carimbo, como abaixo.
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
// ANON_KEY do stack local de demonstração (mesma do docs.expo/supabase demo).
const ANON =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const marca = Date.now();

let total = 0;
let falhas = 0;

function checar(nome, ok, detalhe) {
  total += 1;
  if (ok) {
    console.log(`  ok: ${nome}`);
  } else {
    falhas += 1;
    console.error(`  FALHOU: ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** Cliente sem sessão (anon). */
function anon() {
  return createClient(BASE, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fluxoCadastro() {
  console.log('\n1) Cadastro');
  const supa = anon();
  const { data: cadastro, error: erro } = await supa.auth.signUp({
    email: `e2e-a-${marca}@petlive.app`,
    password: 'senha12345',
  });
  checar('cadastro devolve sessão', Boolean(cadastro.session?.access_token), erro?.message);
  if (!cadastro.session) return { supa: null, tutorA: null, tutorB: null };

  const tutorA = cadastro.user;
  checar('usuário criado com id', Boolean(tutorA?.id));

  // handle_new_user: o trigger cria a linha em profiles.
  const { data: perfil } = await supa
    .from('profiles')
    .select('id, email, plano, aceite_termos')
    .eq('id', tutorA.id)
    .maybeSingle();
  checar('perfil criado pelo trigger', perfil?.id === tutorA.id, JSON.stringify(perfil));
  checar('LGPD: aceite_termos começa falso', perfil?.aceite_termos === false);

  // Tutor B: segunda conta para as checagens de RLS dos outros fluxos.
  const supaB = anon();
  const { data: cadastroB } = await supaB.auth.signUp({
    email: `e2e-b-${marca}@petlive.app`,
    password: 'senha12345',
  });
  checar('segunda conta criada', Boolean(cadastroB.session?.access_token));

  return { supa, tutorA, tutorB: cadastroB.user ?? null, supaB };
}

async function fluxoVacina(supa, supaB, tutorA) {
  console.log('\n2) Vacina');
  if (!supa || !tutorA) {
    checar('fluxo de vacina roda', false, 'cadastro falhou antes');
    return null;
  }

  const { data: pet, error: erroPet } = await supa
    .from('pets')
    .insert({ tutor_id: tutorA.id, nome: 'Tico (e2e)', especie: 'cao' })
    .select('id, nome, tutor_id')
    .single();
  checar('pet criado', Boolean(pet?.id), erroPet?.message);
  if (!pet) return null;

  const { data: vacina, error: erroVacina } = await supa
    .from('vaccinations')
    .insert({
      pet_id: pet.id,
      nome: 'Antirrábica (e2e)',
      aplicada_em: '2026-10-01',
      proxima_dose: '2027-10-01',
    })
    .select('id, nome, proxima_dose, pet_id')
    .single();
  checar('vacina criada', Boolean(vacina?.id), erroVacina?.message);

  const { data: lista } = await supa
    .from('vaccinations')
    .select('id')
    .eq('pet_id', pet.id);
  checar('vacina aparece na listagem do tutor', (lista ?? []).length === 1);

  if (supaB) {
    const { data: alheia } = await supaB.from('vaccinations').select('id').eq('pet_id', pet.id);
    checar('outro tutor não vê a vacina (RLS)', (alheia ?? []).length === 0);
    const { data: petAlheio } = await supaB.from('pets').select('id').eq('id', pet.id);
    checar('outro tutor não vê o pet (RLS)', (petAlheio ?? []).length === 0);
  }

  return pet;
}

async function fluxoLembrete(supa, supaB, tutorA, pet) {
  console.log('\n3) Lembrete');
  if (!supa || !tutorA || !pet) {
    checar('fluxo de lembrete roda', false, 'cadastro/vacina falharam antes');
    return null;
  }

  const { data: lembrete, error: erro } = await supa
    .from('reminders')
    .insert({
      tutor_id: tutorA.id,
      pet_id: pet.id,
      tipo: 'vacina',
      titulo: 'Antirrábica (e2e)',
      proxima_em: new Date(Date.now() + 3 * 86400_000).toISOString(),
    })
    .select('id, aviso_antes, ativo, tipo')
    .single();
  checar('lembrete criado', Boolean(lembrete?.id), erro?.message);
  if (!lembrete) return null;
  checar('aviso_antes começa ligado (padrão)', lembrete?.aviso_antes === true);
  checar('lembrete nasce ativo', lembrete?.ativo === true);

  const { data: atualizado } = await supa
    .from('reminders')
    .update({ aviso_antes: false })
    .eq('id', lembrete.id)
    .select('aviso_antes')
    .single();
  checar('toggle "avisar 1 dia antes" persiste', atualizado?.aviso_antes === false);

  if (supaB) {
    const { data: alheio } = await supaB
      .from('reminders')
      .select('id')
      .eq('pet_id', pet.id);
    checar('outro tutor não vê o lembrete (RLS)', (alheio ?? []).length === 0);
  }

  return lembrete;
}

async function fluxoMapa(supa) {
  console.log('\n4) Mapa');
  const { data: perto, error: erro } = await supa.rpc('lugares_por_perto', {
    p_lat: -22.9068,
    p_lng: -43.1729,
  });
  checar('lugares_por_perto responde', !erro, erro?.message);
  checar('há lugares no centro do Rio', (perto ?? []).length > 0);

  const distancias = (perto ?? []).map((l) => l.distancia_km);
  const ordenado = distancias.every((d, i) => i === 0 || d >= distancias[i - 1]);
  checar('ordenado pela distância', ordenado);

  const { data: clinicas } = await supa.rpc('lugares_por_perto', {
    p_lat: -22.9068,
    p_lng: -43.1729,
    p_categoria: 'clinica',
  });
  checar(
    'filtro de categoria devolve só clínicas',
    (clinicas ?? []).every((l) => l.categoria === 'clinica'),
    `recebidos: ${(clinicas ?? []).length}`,
  );

  const { data: raio } = await supa.rpc('lugares_por_perto', {
    p_lat: -22.9068,
    p_lng: -43.1729,
    p_raio_km: 1,
  });
  checar(
    'raio de 1 km respeitado',
    (raio ?? []).every((l) => l.distancia_km <= 1),
  );

  // Sem sessão: a RPC é de autenticado (migração 20261022010000).
  const { error: erroAnon } = await anon().rpc('lugares_por_perto', {
    p_lat: -22.9068,
    p_lng: -43.1729,
  });
  checar('RPC negada para anônimo (42501)', erroAnon?.code === '42501', erroAnon?.message);

  // Já a leitura da tabela places é pública (mesma ideia do calendário).
  const { data: places, error: erroPlaces } = await anon()
    .from('places')
    .select('id')
    .limit(1);
  checar('places legível sem sessão', !erroPlaces && (places ?? []).length > 0, erroPlaces?.message);
}

async function limpar(supa, pet) {
  console.log('\n5) Limpeza');
  if (!supa || !pet) return;
  await supa.from('reminders').delete().eq('pet_id', pet.id);
  await supa.from('vaccinations').delete().eq('pet_id', pet.id);
  const { error } = await supa.from('pets').delete().eq('id', pet.id);
  const { data: restante } = await supa.from('pets').select('id').eq('id', pet.id);
  checar('dados de teste removidos', !error && (restante ?? []).length === 0, error?.message);
  await supa.auth.signOut();
}

async function main() {
  console.log(`E2E PetLive — ${BASE}`);

  const cadastro = await fluxoCadastro();
  const pet = await fluxoVacina(cadastro.supa, cadastro.supaB, cadastro.tutorA);
  await fluxoLembrete(cadastro.supa, cadastro.supaB, cadastro.tutorA, pet);
  await fluxoMapa(cadastro.supa ?? anon());
  await limpar(cadastro.supa, pet);

  console.log(`\nResultado: ${total - falhas}/${total} checagens ok`);
  if (falhas > 0) {
    console.error(`${falhas} falha(s)`);
    process.exitCode = 1;
  }
}

main().catch((erro) => {
  console.error(`\nE2E abortado: ${erro.message}`);
  console.error('O Supabase local está no ar? `npx supabase start`');
  process.exitCode = 1;
});
