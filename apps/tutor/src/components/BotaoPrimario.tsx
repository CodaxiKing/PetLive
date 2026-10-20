import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  titulo: string;
  onPress?: () => void;
  /** Desabilita o botão e mostra o indicador de carregamento. */
  carregando?: boolean;
  desabilitado?: boolean;
  /** Ícone do círculo azul à esquerda. */
  variante?: 'seta' | 'pata';
  estilo?: ViewStyle;
};

/**
 * Botão principal do protótipo: fundo preto, círculo azul com ícone à
 * esquerda e seta discreta à direita.
 */
export function BotaoPrimario({ titulo, onPress, carregando, desabilitado, variante = 'seta', estilo }: Props) {
  const inativo = desabilitado || carregando;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: Boolean(inativo), busy: Boolean(carregando) }}
      onPress={inativo ? undefined : onPress}
      style={({ pressed }) => [
        estilos.botao,
        inativo && estilos.botaoInativo,
        pressed && !inativo && estilos.botaoPressionado,
        estilo,
      ]}
    >
      <View style={estilos.circulo}>
        {carregando ? (
          <ActivityIndicator size="small" color={colors.black} />
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

      <View style={estilos.seta}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M7 6l6 6-6 6M13 6l6 6-6 6" stroke={colors.white} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </Pressable>
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
  botaoPressionado: {
    transform: [{ scale: 0.98 }],
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
