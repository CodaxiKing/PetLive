#!/usr/bin/env node
/**
 * Backup do banco local (Supabase CLI -> pg_dump).
 *
 * Uso:  node scripts/backup-db.mjs
 * Sai:  backups/petlive-AAAAAMMDD-HHMMSS.sql (mantém os 10 mais recentes).
 *
 * O banco remoto usa o mesmo dump: `supabase db dump --linked -f arquivo.sql`
 * (veja supabase/README.md para senha do pooler e agendamento).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(raiz, 'backups');
const MAXIMO = 10;

const carimbo = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace('T', '-')
  .slice(0, 15); // 20261020-140322
const destino = path.join(dir, `petlive-${carimbo}.sql`);

mkdirSync(dir, { recursive: true });
const dados = `${destino}.dados.tmp`;

function dump(argumentos, arquivo) {
  execFileSync('npx', ['--yes', 'supabase', 'db', 'dump', '--local', ...argumentos, '-f', arquivo], {
    cwd: raiz,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

console.log(`Dump (esquema + dados) do banco local em ${destino} ...`);
dump([], destino);
dump(['--data-only'], dados);
appendFileSync(destino, `\n-- Dados\n${readFileSync(dados, 'utf8')}`);
unlinkSync(dados);

const tamanho = statSync(destino).size;
if (tamanho === 0) {
  console.error('Backup vazio — abortando.');
  process.exit(1);
}
console.log(`Backup OK: ${destino} (${(tamanho / 1024).toFixed(1)} kB)`);

const backups = readdirSync(dir)
  .filter((arquivo) => arquivo.startsWith('petlive-') && arquivo.endsWith('.sql'))
  .sort();
while (backups.length > MAXIMO) {
  const velho = backups.shift();
  unlinkSync(path.join(dir, velho));
  console.log(`Backup antigo removido: ${velho}`);
}
