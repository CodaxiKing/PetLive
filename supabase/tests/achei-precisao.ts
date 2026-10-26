// Execução paga e explícita, somente com conjunto consentido de homologação.
// deno run --allow-read --allow-write --allow-env --allow-net supabase/tests/achei-precisao.ts PASTA CRITERIOS.json RELATORIO.json [SEMENTE]
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { comparar, TIPOS, MODELO_COMPARACAO, type Imagem } from '../functions/find-lost-pet/comparar.ts';
import { avaliarReconhecimento, embaralhar, validarCriterios } from './metricas-reconhecimento.mjs';

const [pasta, arquivoCriterios, saida, semente = 'petlive-v1'] = Deno.args;
if (!pasta || !arquivoCriterios || !saida) throw new Error('Informe pasta, critérios e caminho do relatório.');
const criterios = validarCriterios(JSON.parse(Deno.readTextFileSync(arquivoCriterios)));
const EXT: Record<string, Imagem['tipo']> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
function ler(caminho: string): Imagem {
  const tipo = EXT[caminho.split('.').pop()?.toLowerCase() ?? ''];
  if (!tipo || !TIPOS.includes(tipo)) throw new Error('Formato inválido no conjunto de avaliação.');
  const bytes = Deno.readFileSync(caminho);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Imagem vazia ou acima de 5 MB.');
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { data: btoa(bin), tipo };
}
const client = new Anthropic();
const casos = [];
for (const id of [...Deno.readDirSync(pasta)].filter(d => d.isDirectory).map(d => d.name).sort()) {
  const dir = `${pasta}/${id}`;
  const arquivos = [...Deno.readDirSync(dir)].filter(f => f.isFile).map(f => f.name).sort();
  const achados = arquivos.filter(f => f.startsWith('achado.'));
  const mesmos = arquivos.filter(f => f.startsWith('mesmo.'));
  if (achados.length !== 1 || mesmos.length > 1) throw new Error('Cada caso precisa de um achado e no máximo um mesmo.');
  const especie = Deno.readTextFileSync(`${dir}/especie.txt`).trim();
  if (!criterios.especies.includes(especie)) throw new Error('Espécie ausente ou fora dos critérios.');
  const candidatos = embaralhar(arquivos.filter(f => f.startsWith('mesmo.') || f.startsWith('outro-')), `${semente}:${id}`);
  if (!candidatos.length || candidatos.length > 20) throw new Error('Cada caso precisa de 1 a 20 candidatos.');
  const fotos = candidatos.map(nome => ({ nome, foto: ler(`${dir}/${nome}`) }));
  let resultado = null;
  let erro = false;
  try { resultado = await comparar(client, ler(`${dir}/${achados[0]}`), fotos.map(f => ({ ...f.foto, especie }))); }
  catch { erro = true; }
  // Falha, recusa ou resposta incompleta não removem o caso da amostra.
  const indices = resultado?.candidatos.map(c => c.numero) ?? [];
  if (resultado?.foto_valida && (new Set(indices).size !== fotos.length || indices.some(i => i < 1 || i > fotos.length))) erro = true;
  casos.push({ id, especie, esperado: mesmos[0] ?? null, erro, fotoValida: resultado?.foto_valida === true,
    candidatos: fotos.map((f, i) => ({ id: f.nome, nivel: resultado?.candidatos.find(c => c.numero === i + 1)?.nivel ?? 'diferente' })) });
}
const metrica = avaliarReconhecimento(casos, criterios);
const fonte = await Deno.readTextFile(new URL('../functions/find-lost-pet/comparar.ts', import.meta.url));
const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fonte)))).map(b => b.toString(16).padStart(2, '0')).join('');
const relatorio = { versao: 1, executadoEm: new Date().toISOString(), modelo: MODELO_COMPARACAO, fonteSha256: hash, semente, criterios, ...metrica, casos };
await Deno.writeTextFile(saida, JSON.stringify(relatorio, null, 2));
console.log(JSON.stringify({ ...metrica, saida }, null, 2));
// Não altera flags nem libera o recurso. A aprovação é só pelos critérios fornecidos.
if (!metrica.aprovadoPelosCriterios) Deno.exit(2);
