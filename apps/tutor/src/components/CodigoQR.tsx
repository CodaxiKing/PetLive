import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { geometriaQr } from '../lib/geometriaQr';

/**
 * QR Code desenhado em SVG (sem módulo nativo: vai pela atualização pelo
 * ar). Correção média: aguenta o celular da clínica lendo de lado.
 */
export function CodigoQR({ valor, tamanho }: { valor: string; tamanho: number }) {
  const { caminho, lado } = useMemo(() => geometriaQr(valor), [valor]);

  return (
    <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} accessibilityLabel="QR Code do link da ficha">
      <Rect width={lado} height={lado} fill="#FFFFFF" />
      <Path d={caminho} fill="#111111" />
    </Svg>
  );
}
