import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { router } from 'expo-router';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  titulo: string;
  /** Linha pequena em azul escuro acima do título ("Conta", "Quase lá"). */
  subtitulo?: string;
  /** Esconde o botão de voltar (ex.: primeiro acesso, sem tela anterior). */
  semVoltar?: boolean;
  /** Fundo do herói; o padrão é o azul das telas do protótipo. */
  fundo?: string;
  /** Cor da onda: a mesma do fundo da tela logo abaixo. */
  corOnda?: string;
  altura?: number;
  /** Selo verde no canto direito (ex.: "Funciona sem internet"). */
  selo?: string;
  /** Desenho decorativo (marca d'água) posicionado pelo chamador. */
  children?: ReactNode;
};

/**
 * Herói das telas empilhadas do protótipo (Termos, Permissões,
 * Privacidade, SOS, Calculadoras...): fundo azul, botão de voltar
 * branco, subtítulo, título grande e a onda branca no rodapé.
 */
export function HeroiOnda({
  titulo,
  subtitulo,
  semVoltar,
  fundo = colors.hero,
  corOnda = colors.surface,
  altura = 230,
  selo,
  children,
}: Props) {
  const { width } = useWindowDimensions();

  return (
    <View style={[estilos.heroi, { height: altura, backgroundColor: fundo }]}>
      {children}

      {semVoltar ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={12}
          onPress={() => router.back()}
          style={({ pressed }) => [estilos.voltar, pressed && { opacity: 0.6 }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 5l-7 7 7 7"
              stroke={colors.black}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      )}

      {selo ? <Text style={estilos.selo}>{selo}</Text> : null}

      <View style={estilos.blocoTitulo}>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>
      </View>

      <Svg
        style={estilos.onda}
        width={width}
        height={46}
        viewBox="0 0 390 46"
        preserveAspectRatio="none"
      >
        <Path
          d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
          fill={corOnda}
        />
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  heroi: {
    overflow: 'hidden',
    flexShrink: 0,
  },
  voltar: {
    position: 'absolute',
    left: 24,
    top: 56,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selo: {
    position: 'absolute',
    right: 24,
    top: 62,
    fontSize: 11,
    fontFamily: typography.h1.fontFamily,
    color: '#1F6B45',
    backgroundColor: '#D8F2E3',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  blocoTitulo: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 112,
  },
  subtitulo: {
    ...typography.captionMedium,
    color: colors.primaryDark,
  },
  titulo: {
    ...typography.h1,
    fontFamily: typography.bodyMedium.fontFamily,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.96,
    color: colors.black,
  },
  onda: {
    position: 'absolute',
    left: 0,
    bottom: -1,
  },
});
