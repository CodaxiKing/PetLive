import { useMemo } from 'react';
import QRCode from 'qrcode';
import Svg, { Path, Rect } from 'react-native-svg';

/**
 * QR Code desenhado em SVG (sem módulo nativo: vai pela atualização pelo
 * ar). Correção média: aguenta o celular da clínica lendo de lado.
 */
export function CodigoQR({ valor, tamanho }: { valor: string; tamanho: number }) {
  const { caminho, lado } = useMemo(() => {
    const { modules } = QRCode.create(valor, { errorCorrectionLevel: 'M' });
    const n = modules.size;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (modules.get(x, y)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
      }
    }
    // 4 módulos de margem branca em volta (zona de silêncio do padrão).
    return { caminho: d, lado: n + 8 };
  }, [valor]);

  return (
    <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} accessibilityLabel="QR Code do link da ficha">
      <Rect width={lado} height={lado} fill="#FFFFFF" />
      <Path d={caminho} fill="#111111" />
    </Svg>
  );
}
