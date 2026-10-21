#!/usr/bin/env node
/**
 * Monitoramento da pilha Supabase: saúde da API e invariantes de segurança.
 *
 * Uso:  node scripts/monitorar.mjs   (exit 1 se algo falhar — serve para cron/CI)
 * Checa: auth, REST, storage, e que tabelas/RPC sensíveis continuem bloqueados
 * para o papel anon (RLS + EXECUTE revogado).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function lerEnv() {
  try {
    const texto = readFileSync(path.join(raiz, 'apps', 'tutor', '.env'), 'utf8');
    const url = texto.match(/^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim();
    const anon = texto.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)?.[1]?.trim();
    if (url && anon) return { url, anon };
  } catch {
    // sem .env: cai no padrão da pilha local
  }
  return {
    url: 'http://127.0.0.1:54321',
    anon:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  };
}

const { url, anon } = lerEnv();
const resultados = [];

async function checar(nome, funcao) {
  try {
    const ok = await funcao();
    resultados.push({ nome, ok });
    console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}`);
  } catch (erro) {
    resultados.push({ nome, ok: false });
    console.log(`FALHA ${nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
  }
}

async function statusDe(resposta) {
  return { status: resposta.status, texto: await resposta.text() };
}

await checar('auth /health', async () => {
  const r = await fetch(`${url}/auth/v1/health`);
  const { status, texto } = await statusDe(r);
  return status === 200 && texto.includes('GoTrue');
});

await checar('storage /health', async () => {
  const r = await fetch(`${url}/storage/v1/health`, { headers: { apikey: anon } });
  return r.status === 200;
});

await checar('REST responde com anon', async () => {
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: anon } });
  return r.status === 200;
});

await checar('RLS: pets sem dados para anon', async () => {
  // RLS por tutor: anon passa pelo grant, mas as políticas filtram tudo —
  // a resposta precisa ser vazia (ou negada), nunca com linhas de outros tutores.
  const r = await fetch(`${url}/rest/v1/pets?select=id,tutor_id&limit=5`, {
    headers: { apikey: anon },
  });
  if (r.status === 401 || r.status === 403) return true;
  const corpo = (await r.text()).trim();
  return r.status === 200 && (corpo === '[]' || corpo === '');
});

await checar('RPC lugares_por_perto sem EXECUTE para anon', async () => {
  const r = await fetch(`${url}/rest/v1/rpc/lugares_por_perto`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return r.status === 401 || r.status === 403 || r.status === 404;
});

const falhas = resultados.filter((r) => !r.ok).length;
if (falhas > 0) {
  console.log(`\n${falhas} verificacao(oes) falharam.`);
  process.exit(1);
}
console.log('\nTodas as verificacoes passaram.');
