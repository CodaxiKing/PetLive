import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { Tocavel, useMovimentoReduzido } from './Animacoes';
import { typography } from '../theme/typography';

type Props = {
  titulo: string;
  onPress?: () => void;
  /** Desabilita o botão e mostra o indicador de carregamento. */
  carregando?: boolean;
  desabilitado?: boolean;
  /** Ícone do círculo azul à esquerda. */
  variante?: 'seta' | 'pata';
  /** Ícone próprio no círculo azul (substitui a variante). */
  icone?: ReactNode;
  estilo?: ViewStyle;
};

/**
 * Botão principal do protótipo: fundo preto, círculo azul com ícone à
 * esquerda e seta discreta à direita.
 */
export function BotaoPrimario({ titulo, onPress, carregando, desabilitado, variante = 'seta', icone, estilo }: Props) {
  const inativo = desabilitado || carregando;

  return (
    <Tocavel
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: Boolean(inativo), busy: Boolean(carregando) }}
      disabled={Boolean(inativo)}
      onPress={onPress}
      escala={0.97}
      style={[estilos.botao, inativo && estilos.botaoInativo, estilo]}
    >
      <View style={estilos.circulo}>
        {carregando ? (
          <ActivityIndicator size="small" color={colors.black} />
        ) : icone ? (
          icone
        ) : (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill={variante === 'pata' ? colors.black : 'none'}>
            {variante === 'pata' ? (
              <Path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
            ) : (
              <Path
                d="M5 12h14M13 6l6 6-6 6"
                stroke={colors.black}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </Svg>
        )}
      </View>

      <Text style={estilos.titulo} numberOfLines={1}>
        {titulo}
      </Text>

      <SetaConvite parada={Boolean(inativo)} />
    </Tocavel>
  );
}

/** "»" discreto que avança e volta devagar, convidando ao toque. */
function SetaConvite({ parada }: { parada: boolean }) {
  const reduzido = useMovimentoReduzido();
  const valor = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduzido || parada) {
      valor.setValue(0);
      return;
    }
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(valor, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(valor, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [reduzido, parada, valor]);

  return (
    <Animated.View
      style={[estilos.seta, { transform: [{ translateX: valor.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }] }]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M7 6l6 6-6 6M13 6l6 6-6 6" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.black,
    paddingLeft: 6,
    paddingRight: 6,
  },
  botaoInativo: {
    opacity: 0.55,
  },
  circulo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titulo: {
    flex: 1,
    textAlign: 'center',
    ...typography.button,
    fontSize: 17,
    color: colors.white,
    // Compensa o círculo da direita para o texto ficar centrado na tela.
    paddingRight: 44,
  },
  seta: {
    width: 44,
    alignItems: 'center',
    opacity: 0.5,
  },
});
