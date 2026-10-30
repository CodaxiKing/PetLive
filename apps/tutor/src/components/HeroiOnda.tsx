import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { voltarOuInicio } from '../lib/voltar';
import { colors } from '../theme/colors';
import { shadow } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Surgir } from './Animacoes';

type Props = {
  titulo: string;
  /** Linha pequena em azul escuro acima do título ("Conta", "Quase lá"). */
  subtitulo?: string;
  /** Esconde o botão de voltar (ex.: primeiro acesso, sem tela anterior). */
  semVoltar?: boolean;
  /** Fundo com significado (rosa da emergência, lilás do memorial). Sem ele, o topo é o próprio fundo da tela. */
  fundo?: string;
  /** Fundo da tela logo abaixo; o topo sem `fundo` usa esta cor. */
  corOnda?: string;
  altura?: number;
  /** Selo verde no canto direito (ex.: "Funciona sem internet"). */
  selo?: string;
  /** Desenho decorativo (marca d'água) posicionado pelo chamador. */
  children?: ReactNode;
};

/**
 * Topo das telas empilhadas (Termos, Permissões, Privacidade, SOS,
 * Calculadoras...), na versão 2 do protótipo: botão de voltar redondo,
 * subtítulo e título grande sobre o fundo da tela. Telas com cor de
 * significado (`fundo`) ganham uma faixa colorida de cantos arredondados.
 */
export function HeroiOnda({
  titulo,
  subtitulo,
  semVoltar,
  fundo,
  corOnda = colors.surface,
  altura = 230,
  selo,
  children,
}: Props) {
  const colorido = Boolean(fundo && fundo !== colors.hero);

  return (
    <View
      style={[
        estilos.heroi,
        // Sem a onda, o rodapé de 28 px que ela ocupava sobra.
        { height: altura - 28, backgroundColor: colorido ? fundo : corOnda },
        colorido && estilos.faixa,
      ]}
    >
      {children}

      {semVoltar ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={12}
          onPress={voltarOuInicio}
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

      <Surgir style={[estilos.blocoTitulo, semVoltar && estilos.blocoTituloAlto]}>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
        <Text style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Text>
      </Surgir>

    </View>
  );
}

const estilos = StyleSheet.create({
  heroi: {
    overflow: 'hidden',
    flexShrink: 0,
  },
  faixa: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
    ...shadow.card,
  },
  selo: {
    position: 'absolute',
    right: 24,
    top: 62,
    fontSize: 11,
    fontFamily: typography.h1.fontFamily,
    color: colors.successText,
    backgroundColor: colors.successSurface,
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
  // Sem o botão de voltar, o título ocupa o topo (abas Pets e Perfil).
  blocoTituloAlto: {
    top: 96,
  },
  subtitulo: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  titulo: {
    ...typography.h1,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.1,
    color: colors.black,
  },
});
