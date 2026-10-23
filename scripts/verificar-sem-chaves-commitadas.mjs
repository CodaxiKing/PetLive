// PetLive: garante que nenhuma chave de API (Google Maps/Places etc.) esteja
// commitada no repositório. Chaves viajam somente em variáveis de ambiente e
// segredos das plataformas de deploy (EAS, Vercel, Supabase).
//
//   node scripts/verificar-sem-chaves-commitadas.mjs [raiz]
//   pnpm guard:chaves-google
//
// Sai com código 1 ao encontrar alguma chave ou arquivo de segredo versionado.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ_PADRAO = fileURLToPath(new URL('../', import.meta.url));
const RAIZ = resolve(process.argv[2] ?? RAIZ_PADRAO);

// Chaves da Google Maps Platform começam com AIza (Maps SDK, Places, etc.),
// seguidas de 35+ caracteres alfanuméricos, traço ou underline.
const CHAVE_GOOGLE = new RegExp('\\bAIza[0-9A-Za-z_-]{35,40}\\b', 'g');

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
    // Evita decodificar mídia e bundles grandes como texto: além de não
    // conterem configuração legível, isso podia consumir toda a memória do CI.
    const extensoesTexto = new Set([
      '.cjs', '.css', '.env', '.example', '.html', '.ini', '.java', '.js',
      '.json', '.jsx', '.md', '.mjs', '.properties', '.py', '.sh', '.sql',
      '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
    ]);
    if (!extensoesTexto.has(extname(caminho).toLowerCase()) || statSync(caminho).size > 2_000_000) {
      return '';
    }
    return readFileSync(caminho, 'utf-8');
  } catch {
    return '';
  }
}

/** Devolve as chaves do Google encontradas num texto. */
export function encontrarChavesGoogle(texto) {
  return [...texto.matchAll(CHAVE_GOOGLE)].map(([chave]) => chave);
}

/** Analisa um arquivo versionado e devolve mensagens de problema (vazio = ok). */
export function analisarArquivo(caminhoRelativo, conteudoFornecido) {
  const problemas = [];
  const texto = conteudoFornecido ?? conteudo(resolve(RAIZ, caminhoRelativo));

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
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const codigo = main();
  process.exit(codigo);
}
