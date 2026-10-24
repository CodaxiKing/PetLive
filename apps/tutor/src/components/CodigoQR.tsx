import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { geometriaQr } from '../lib/geometriaQr';

/**
 * QR Code desenhado em SVG (sem módulo nativo: vai pela atualização pelo
 * ar). Correção média: aguenta o celular da clínica lendo de lado.
 */
export function CodigoQR({ valor, tamanho, rotulo = 'QR Code do link da ficha' }: { valor: string; tamanho: number; rotulo?: string }) {
  const { caminho, lado } = useMemo(() => geometriaQr(valor), [valor]);

  return (
    <Svg width={tamanho} height={tamanho} viewBox={`0 0 ${lado} ${lado}`} accessibilityLabel={rotulo}>
      <Rect width={lado} height={lado} fill="#FFFFFF" />
      <Path d={caminho} fill="#111111" />
    </Svg>
  );
}
