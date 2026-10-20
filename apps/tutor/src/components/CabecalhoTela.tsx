import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/tokens';

type Props = {
  titulo: string;
  /** Ação opcional exibida à direita (ex.: um texto-botão). */
  acao?: string;
  onAcao?: () => void;
  children?: ReactNode;
};

/**
 * Cabeçalho das telas empilhadas (Pets, detalhe do pet, formulários):
 * volta à tela anterior, título centralizado e ação opcional.
 */
export function CabecalhoTela({ titulo, acao, onAcao, children }: Props) {
  return (
    <View style={estilos.cabecalho}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={12}
        onPress={() => router.back()}
        style={({ pressed }) => [estilos.botaoVoltar, pressed && estilos.pressionado]}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 5l-7 7 7 7"
            stroke={colors.black}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>

      <Text style={estilos.titulo} numberOfLines={1}>
        {titulo}
      </Text>

      {acao ? (
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onAcao} style={estilos.acao}>
          <Text style={estilos.acaoTexto}>{acao}</Text>
        </Pressable>
      ) : (
        <View style={estilos.espacador} />
      )}

      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  botaoVoltar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: {
    opacity: 0.6,
  },
  titulo: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    color: colors.black,
  },
  acao: {
    minWidth: 44,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  acaoTexto: {
    ...typography.captionMedium,
    color: colors.primaryDeep,
  },
  espacador: {
    width: 44,
  },
});
