import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { geometriaQr } from '../lib/geometriaQr';

/** Rasteriza o caminho que o componente SVG recebe, sem montar React Native. */
function rasterizar(valor: string, escala = 6) {
  const { caminho, lado } = geometriaQr(valor);
  const largura = lado * escala;
  const pixels = new Uint8ClampedArray(largura * largura * 4).fill(255);
  const pontos = [...caminho.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => [Number(m[1]), Number(m[2])]);
  for (const [x, y] of pontos) {
    for (let py = y * escala; py < (y + 1) * escala; py++) {
      for (let px = x * escala; px < (x + 1) * escala; px++) {
        const i = (py * largura + px) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = 17;
      }
    }
  }
  return { pixels, largura, pontos, lado };
}

describe('QR desenhado na etiqueta e nas fichas', () => {
  it('preserva a orientação da matriz canônica, sem transpor linhas e colunas', () => {
    const valor = 'https://petlive.app/p/0123456789abcdef';
    const { pontos, lado } = rasterizar(valor);
    const esperado = QRCode.create(valor, { errorCorrectionLevel: 'M' }).modules;
    const indices = new Set(pontos.map(([x, y]) => (y - 4) * esperado.size + x - 4));
    expect(lado).toBe(esperado.size + 8);
    for (const [i, preto] of esperado.data.entries()) expect(indices.has(i)).toBe(Boolean(preto));
    expect(pontos.every(([x, y]) => x >= 4 && y >= 4 && x < lado - 4 && y < lado - 4)).toBe(true);
  });
  it.each([
    `https://petlive.app/p/${'a1b2c3d4'.repeat(6)}`,
    'https://petlive.app/ficha/codigo-temporario',
    'https://petlive.app/cuidador/codigo-do-acesso',
  ])('um leitor independente recupera exatamente %s', (valor) => {
    const { pixels, largura } = rasterizar(valor);
    const lido = jsQR(pixels, largura, largura, { inversionAttempts: 'dontInvert' });
    expect(lido?.data).toBe(valor);
  });
});
