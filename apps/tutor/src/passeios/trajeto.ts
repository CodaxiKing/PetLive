import type { PontoPasseio } from './passeio';

/** Projeção local do trajeto, com escala igual nos eixos e sem unir pausas. */
export function desenhoTrajeto(pontos: PontoPasseio[]) {
  if (!pontos.length) return { caminho: '', inicio: null, fim: null };
  const origem = pontos[0];
  const fator = Math.cos(origem.lat * Math.PI / 180);
  const plano = pontos.map((p) => ({
    x: (((p.lng - origem.lng + 540) % 360) - 180) * fator,
    y: origem.lat - p.lat, trecho: p.trecho,
  }));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of plano) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const escala = Math.min(280 / Math.max(maxX - minX, 0.000001), 140 / Math.max(maxY - minY, 0.000001));
  const projetados = plano.map((p) => ({ x: 160 + (p.x - (minX + maxX) / 2) * escala, y: 90 + (p.y - (minY + maxY) / 2) * escala }));
  const caminho = projetados.map((p, i) => `${i === 0 || plano[i].trecho !== plano[i - 1].trecho ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  return { caminho, inicio: projetados[0], fim: projetados.at(-1)! };
}
