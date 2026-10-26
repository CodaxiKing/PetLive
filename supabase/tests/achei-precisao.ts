// Mede a precisão do Achei um pet por foto antes de ligar o recurso
// 'achei_foto' no admin (BUSINESS.md 5.38: "se não for boa o bastante para
// pets parecidos, a função não sobe").
//
// Uso (Deno, com ANTHROPIC_API_KEY no ambiente; cada caso é uma chamada paga):
//   deno run --allow-read --allow-env --allow-net supabase/tests/achei-precisao.ts <pasta>
//
// A pasta tem um subdiretório por caso, com fotos JPEG, PNG ou WebP:
//   achado.*   foto tirada por quem achou
//   mesmo.*    outra foto do mesmo pet (o alerta certo); pode faltar, para medir falso positivo
//   outro-*.*  fotos de pets diferentes, de preferência parecidos (mesma raça e cor)
// Opcional: especie.txt com "cao" ou "gato".
//
// Resultado por caso e o resumo: quantas vezes o certo veio como muito parecido
// ou parecido e em primeiro, e quantas vezes um pet diferente veio como muito parecido.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { comparar, TIPOS, type Imagem } from '../functions/find-lost-pet/comparar.ts';

const EXT: Record<string, Imagem['tipo']> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const ORDEM: Record<string, number> = { muito_parecido: 0, parecido: 1, pouco_parecido: 2, diferente: 3 };

function ler(caminho: string): Imagem | null {
  const tipo = EXT[caminho.split('.').pop()?.toLowerCase() ?? ''];
  if (!tipo || !TIPOS.includes(tipo)) return null;
  const bytes = Deno.readFileSync(caminho);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { data: btoa(bin), tipo };
}

const pasta = Deno.args[0];
if (!pasta) {
  console.error('Informe a pasta dos casos.');
  Deno.exit(1);
}

const client = new Anthropic();
const total = { casos: 0, comCerto: 0, certoAchado: 0, certoPrimeiro: 0, outros: 0, falsoMuitoParecido: 0, fotoRecusada: 0 };

for (const caso of [...Deno.readDirSync(pasta)].filter((d) => d.isDirectory).map((d) => d.name).sort()) {
  const dir = `${pasta}/${caso}`;
  const arquivos = [...Deno.readDirSync(dir)].map((f) => f.name);
  const achadoNome = arquivos.find((f) => f.startsWith('achado.'));
  const achado = achadoNome ? ler(`${dir}/${achadoNome}`) : null;
  if (!achado) {
    console.log(`${caso}: sem achado.*, pulado`);
    continue;
  }
  let especie = 'cao';
  try {
    especie = Deno.readTextFileSync(`${dir}/especie.txt`).trim() || 'cao';
  } catch { /* cão por padrão */ }
  const candidatos = arquivos
    .filter((f) => f.startsWith('mesmo.') || f.startsWith('outro-'))
    .sort(() => Math.random() - 0.5)
    .map((f) => ({ nome: f, foto: ler(`${dir}/${f}`) }))
    .filter((c) => c.foto);

  const r = await comparar(client, achado, candidatos.map((c) => ({ ...c.foto!, especie })));
  total.casos++;
  if (!r || !r.foto_valida) {
    total.fotoRecusada++;
    console.log(`${caso}: foto recusada (${r?.motivo ?? 'recusa do modelo'})`);
    continue;
  }
  const nivel = (i: number) => r.candidatos.find((c) => c.numero === i + 1)?.nivel ?? 'diferente';
  const ranking = candidatos.map((c, i) => ({ nome: c.nome, nivel: nivel(i) })).sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
  const certo = ranking.find((c) => c.nome.startsWith('mesmo.'));
  if (certo) {
    total.comCerto++;
    if (ORDEM[certo.nivel] <= 1) total.certoAchado++;
    if (ranking[0] === certo && ORDEM[certo.nivel] <= 1) total.certoPrimeiro++;
  }
  for (const o of ranking.filter((c) => c.nome.startsWith('outro-'))) {
    total.outros++;
    if (o.nivel === 'muito_parecido') total.falsoMuitoParecido++;
  }
  console.log(`${caso}: ${ranking.map((c) => `${c.nome}=${c.nivel}`).join(', ')}`);
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
console.log('\nResumo');
console.log(`Casos: ${total.casos} (fotos recusadas: ${total.fotoRecusada})`);
console.log(`Certo como muito parecido ou parecido: ${pct(total.certoAchado, total.comCerto)} de ${total.comCerto}`);
console.log(`Certo em primeiro: ${pct(total.certoPrimeiro, total.comCerto)}`);
console.log(`Pet diferente como muito parecido (falso positivo): ${pct(total.falsoMuitoParecido, total.outros)} de ${total.outros}`);
