import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Fundo em degradê dos cartões do protótipo (`linear-gradient(160deg, ...)`):
 * fica atrás do conteúdo, preenchendo o pai (que deve ter overflow hidden).
 */
export function Gradiente({ de, ate }: { de: string; ate: string }) {
  const id = useId();
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none" aria-hidden>
      <Defs>
        {/* 160° no CSS: de cima (um pouco à esquerda) para baixo. */}
        <LinearGradient id={id} x1="0.33" y1="0" x2="0.67" y2="1">
          <Stop offset="0" stopColor={de} />
          <Stop offset="1" stopColor={ate} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
