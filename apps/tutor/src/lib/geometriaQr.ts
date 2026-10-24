import QRCode from 'qrcode';

/** Módulos SVG com quatro módulos brancos de margem (quiet zone). */
export function geometriaQr(valor: string) {
  const { modules } = QRCode.create(valor, { errorCorrectionLevel: 'M' });
  let caminho = '';
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      // A biblioteca recebe linha e coluna; SVG usa x e y.
      if (modules.get(y, x)) caminho += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
  }
  return { caminho, lado: modules.size + 8 };
}
