#!/usr/bin/env node
/**
 * Verificação do QA: install com lockfile congelado, typecheck e testes.
 *
 * Uso:  pnpm verify   (ou node scripts/verify.mjs; exit 1 se algum passo falhar)
 * Cada passo roda como um comando curto e separado: o terminal do Windows
 * recusa a linha longa do `a && b && c` ("Linha de comando muito longa").
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const passos = [
  ['Instalar (lockfile congelado)', ['install', '--frozen-lockfile']],
  ['Typecheck', ['-r', 'typecheck']],
  ['Testes', ['-r', '--if-present', 'test']],
];

for (const [nome, args] of passos) {
  console.log(`\n=== ${nome}: pnpm ${args.join(' ')}`);
  const r = spawnSync('pnpm', args, { cwd: raiz, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    console.error(`\nFALHA em "${nome}" (código ${r.status ?? r.error?.message}).`);
    process.exit(1);
  }
}

console.log('\nTudo certo: install, typecheck e testes passaram.');
