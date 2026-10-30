import { useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Fundo em degradê dos cartões do protótipo (`linear-gradient(160deg, ...)`):
 * fica atrás do conteúdo, preenchendo o pai (que deve ter overflow hidden).
 * Desenha no tamanho medido: com porcentagem o SVG não acompanhava o
 * cartão quando ele crescia (fonte grande do sistema).
 */
export function Gradiente({
  de,
  ate,
  opacidadeDe = 1,
  opacidadeAte = 1,
}: {
  de: string;
  ate: string;
  /** Opacidade de cada ponta (o stopColor em rgba perde a transparência no Android). */
  opacidadeDe?: number;
  opacidadeAte?: number;
}) {
  const id = useId();
  const [tamanho, setTamanho] = useState({ largura: 0, altura: 0 });

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setTamanho({ largura: e.nativeEvent.layout.width, altura: e.nativeEvent.layout.height })}
    >
      {tamanho.largura > 0 ? (
        <Svg width={tamanho.largura} height={tamanho.altura} aria-hidden>
          <Defs>
            {/* 160° no CSS: de cima (um pouco à esquerda) para baixo. */}
            <LinearGradient id={id} x1="0.33" y1="0" x2="0.67" y2="1">
              <Stop offset="0" stopColor={de} stopOpacity={opacidadeDe} />
              <Stop offset="1" stopColor={ate} stopOpacity={opacidadeAte} />
            </LinearGradient>
          </Defs>
          <Rect width={tamanho.largura} height={tamanho.altura} fill={`url(#${id})`} />
        </Svg>
      ) : null}
    </View>
  );
}
