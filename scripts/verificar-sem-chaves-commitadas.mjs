// PetLive: garante que nenhuma chave de API (Google Maps/Places etc.) esteja
// commitada no repositório. Chaves viajam somente em variáveis de ambiente e
// segredos das plataformas de deploy (EAS, Vercel, Supabase).
//
//   node scripts/verificar-sem-chaves-commitadas.mjs [raiz]
//   pnpm guard:chaves-google
//
// Sai com código 1 ao encontrar alguma chave ou arquivo de segredo versionado.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const RAIZ = process.argv[2] ?? new URL('.', import.meta.url).pathname.replace(/^file:\/\//, '');

// Chaves da Google Maps Platform começam com AIza (Maps SDK, Places, etc.),
// seguidas de 35+ caracteres alfanuméricos, traço ou underline.
const CHAVE_GOOGLE = new RegExp('\\bAIza[0-9A-Za-z_-]{34,}\\b');

// Arquivos que nunca devem aparecer versionados (o gitignore já os cobre,
// mas este é o último guarda-chave antes do commit).
const ARQUIVOS_PROIBIDOS = [
  [/^(.*)\.env(?!\.example)$/, 'arquivo de ambiente versionado'],
  [/secrets\./i, 'arquivo de segredos versionado'],
  [/\.(pem|p12|jks|key|mobileprovision)$/, 'certificado ou chave privada versionado'],
];

function arquivosVersionados() {
  try {
    const saida = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf-8' });
    return saida.split('\0').filter(Boolean);
  } catch {
    // Fora de um repositório git: não há o que varrer.
    return [];
  }
}

function conteudo(caminho) {
  try {
    return readFileSync(caminho, 'utf-8');
  } catch {
    return '';
  }
}

/** Devolve as chaves do Google encontradas num texto. */
export function encontrarChavesGoogle(texto) {
  const achados = [];
  let correspondencia;
  while ((correspondencia = CHAVE_GOOGLE.exec(texto))) achados.push(correspondencia[0]);
  return achados;
}

/** Analisa um arquivo versionado e devolve mensagens de problema (vazio = ok). */
export function analisarArquivo(caminhoRelativo) {
  const problemas = [];
  const texto = conteudo(caminhoRelativo);

  for (const chave of encontrarChavesGoogle(texto)) {
    problemas.push(`chave do Google Maps/Places em ${caminhoRelativo}: ${chave}`);
  }

  for (const [padrao, nome] of ARQUIVOS_PROIBIDOS) {
    if (padrao.test(caminhoRelativo)) {
      problemas.push(`${nome} versionado: ${caminhoRelativo}`);
    }
  }

  return problemas;
}

function main() {
  const arquivos = arquivosVersionados();
  const problemas = arquivos.flatMap((caminho) => analisarArquivo(caminho));

  if (problemas.length === 0) {
    console.log('OK - nenhuma chave de API commitada no repositório.');
    return 0;
  }

  console.error('FALHA - chaves de API ou segredos encontrados no repositório:');
  for (const problema of problemas) {
    console.error(`  - ${problema}`);
  }
  console.error(
    '\nMova o valor para variáveis de ambiente / segredos do deploy e apague do arquivo. '
      + 'Modelos sem valor ficam apenas em *.env.example.',
  );
  return 1;
}

// Só varre quando executado diretamente (npm script), não quando importado em teste.
if (pathToFileURL(process.argv[1]).href === import.meta.url) {
  const codigo = main();
  process.exit(codigo);
}
