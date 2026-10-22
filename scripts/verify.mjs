#!/usr/bin/env node
/**
 * Verificação do QA: install com lockfile congelado, typecheck, testes e o
 * teste do bucket `anexos` contra o Supabase local.
 *
 * Uso:  pnpm verify            (o teste do Supabase roda se o local estiver no ar; senão sai como PULADO)
 *       pnpm verify:supabase   (o teste do Supabase é obrigatório: Supabase fora do ar é falha)
 * Cada passo roda como um comando curto e separado: o terminal do Windows
 * recusa a linha longa do `a && b && c` ("Linha de comando muito longa").
 * A saída inteira vai também para docs/qa/verify-saida.txt, para anexar no PR.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exigirSupabase = process.argv.includes('--supabase');
const shell = process.platform === 'win32';

const arquivoSaida = path.join(raiz, 'docs', 'qa', 'verify-saida.txt');
fs.mkdirSync(path.dirname(arquivoSaida), { recursive: true });
const saida = fs.createWriteStream(arquivoSaida);
const escrever = (texto) => {
  process.stdout.write(texto);
  saida.write(texto);
};
const terminar = async (codigo, mensagem) => {
  escrever(mensagem);
  await new Promise((resolve) => saida.end(resolve));
  process.exit(codigo);
};

const rodar = (comando, args, env) =>
  new Promise((resolve) => {
    const filho = spawn(comando, args, { cwd: raiz, shell, env: { ...process.env, ...env }, stdio: ['inherit', 'pipe', 'pipe'] });
    filho.stdout.on('data', (b) => escrever(b.toString()));
    filho.stderr.on('data', (b) => escrever(b.toString()));
    filho.on('error', (e) => resolve(e.message));
    filho.on('close', (codigo) => resolve(codigo));
  });

/** URL e chave anônima do Supabase local: do ambiente ou do `supabase status`. */
function supabaseLocal() {
  if (process.env.SUPABASE_ANON_KEY) {
    return { SUPABASE_URL: process.env.SUPABASE_URL || 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY };
  }
  const r = spawnSync('supabase', ['status', '-o', 'env'], { cwd: raiz, shell, encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) return null;
  const valor = (nome) => r.stdout.match(new RegExp(`^${nome}="?([^"\\r\\n]+)"?`, 'm'))?.[1];
  const chave = valor('ANON_KEY');
  return chave ? { SUPABASE_URL: valor('API_URL') || 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: chave } : null;
}

const commit = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: raiz, shell, encoding: 'utf8' }).stdout?.trim();
escrever(`PetLive verify — ${new Date().toISOString()} — commit ${commit || '?'} — node ${process.version} — ${process.platform}\n`);

const passos = [
  ['Instalar (lockfile congelado)', 'pnpm', ['install', '--frozen-lockfile']],
  ['Typecheck', 'pnpm', ['-r', 'typecheck']],
  ['Testes', 'pnpm', ['-r', '--if-present', 'test']],
];

for (const [nome, comando, args] of passos) {
  escrever(`\n=== ${nome}: ${comando} ${args.join(' ')}\n`);
  const codigo = await rodar(comando, args);
  if (codigo !== 0) await terminar(1, `\nFALHA em "${nome}" (código ${codigo}).\n`);
}

const testesSupabase = ['supabase/tests/testar-anexos.mjs'];
const env = supabaseLocal();
let pulado = false;
if (!env) {
  if (exigirSupabase) {
    await terminar(1, '\nFALHA: Supabase local fora do ar. Rode `supabase start` (ou defina SUPABASE_ANON_KEY) e tente de novo.\n');
  }
  pulado = true;
  escrever('\n=== Testes do Supabase: PULADO (Supabase local fora do ar; rode `supabase start` e `pnpm verify:supabase`)\n');
} else {
  for (const teste of testesSupabase) {
    escrever(`\n=== Teste do Supabase: node ${teste}\n`);
    const codigo = await rodar('node', [teste], env);
    if (codigo !== 0) await terminar(1, `\nFALHA em "${teste}" (código ${codigo}).\n`);
  }
}

await terminar(
  0,
  (pulado
    ? '\nTudo certo: install, typecheck e testes passaram (testes do Supabase PULADOS).\n'
    : '\nTudo certo: install, typecheck, testes e testes do Supabase passaram.\n') + 'Saída salva em docs/qa/verify-saida.txt\n',
);
