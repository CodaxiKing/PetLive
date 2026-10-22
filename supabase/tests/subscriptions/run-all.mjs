// PetLive: Runner principal para testes de assinaturas.
// Roda: node supabase/tests/subscriptions/run-all.mjs <ANON_KEY>

const ANON = process.argv[2];
if (!ANON) {
  console.error('Uso: node run-all.mjs <ANON_KEY>');
  process.exit(1);
}

const tests = [
  { file: 'test-apple-webhook.mjs', name: 'Apple Webhook' },
  { file: 'test-google-webhook.mjs', name: 'Google Webhook' },
  { file: 'test-reconciliation.mjs', name: 'Reconciliation Job' },
  { file: 'test-rls.mjs', name: 'RLS Policies' },
  { file: 'test-grace-hold.mjs', name: 'Grace Period / Account Hold' },
];

async function runTest(test) {
  console.log(`\n{'='.repeat(60)}`);
  console.log(`EXECUTANDO: ${test.name} (${test.file})`);
  console.log(`{'='.repeat(60)}`);

  try {
    // Importa dinamicamente o teste
    const testModule = await import(`./${test.file}`);
    // O teste roda automaticamente ao importar (top-level await)
    return true;
  } catch (e) {
    console.error(`ERRO em ${test.name}:`, e.message);
    return false;
  }
}

async function main() {
  console.log('PetLive - Testes de Assinaturas (Premium + Lojas)');
  console.log('================================================');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const success = await runTest(test);
    if (success) passed++;
    else failed++;
  }

  console.log(`\n{'='.repeat(60)}`);
  console.log(`RESULTADO: ${passed} passaram, ${failed} falharam`);
  console.log(`{'='.repeat(60)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();