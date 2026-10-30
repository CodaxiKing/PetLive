import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { voltarOuInicio } from '../lib/voltar';
import { colors } from '../theme/colors';
import { shadow } from '../theme/tokens';
import { typography } from '../theme/typography';
import { Surgir } from './Animacoes';

type Props = {
  titulo: string;
  /** Linha pequena acima do título ("Conta", o nome do pet). */
  subtitulo?: string;
  /** Esconde o botão de voltar (ex.: primeiro acesso, sem tela anterior). */
  semVoltar?: boolean;
  /** Fundo com significado (rosa da emergência, lilás do memorial). Sem ele, o topo é o próprio fundo da tela. */
  fundo?: string;
  /** Fundo da tela logo abaixo; o topo sem `fundo` usa esta cor. */
  corOnda?: string;
  /** Mantido por compatibilidade: o topo agora tem a altura do conteúdo. */
  altura?: number;
  /** Selo verde no canto direito (ex.: "Funciona sem internet"). */
  selo?: string;
  /** Conteúdo abaixo da linha do título (ex.: "Para o Rex"). */
  children?: ReactNode;
};

/**
 * Topo das telas empilhadas na versão 2 do protótipo: o voltar redondo e o
 * título na mesma linha ("← Remédios do Rex"), com o subtítulo pequeno acima
 * do título. Telas com cor de significado (`fundo`) ganham uma faixa colorida
 * de cantos arredondados.
 */
export function HeroiOnda({
  titulo,
  subtitulo,
  semVoltar,
  fundo,
  corOnda = 'transparent',
  selo,
  children,
}: Props) {
  const colorido = Boolean(fundo && fundo !== colors.hero);

  return (
    <View style={[estilos.heroi, { backgroundColor: colorido ? fundo : corOnda }, colorido && estilos.faixa]}>
      <Surgir style={estilos.linha}>
        {semVoltar ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={12}
            onPress={voltarOuInicio}
            style={({ pressed }) => [estilos.voltar, pressed && { opacity: 0.6 }]}
          >
            <ArrowLeft size={22} color={colors.black} />
          </Pressable>
        )}
        <View style={estilos.textos}>
          {subtitulo ? (
            <Text style={estilos.subtitulo} numberOfLines={1}>
              {subtitulo}
            </Text>
          ) : null}
          {titulo ? (
            <Text style={estilos.titulo} accessibilityRole="header">
              {titulo}
            </Text>
          ) : null}
        </View>
        {selo ? <Text style={estilos.selo}>{selo}</Text> : null}
      </Surgir>
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  heroi: {
    flexShrink: 0,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  faixa: {
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voltar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  textos: {
    flex: 1,
    minWidth: 0,
  },
  subtitulo: {
    ...typography.captionMedium,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textMuted,
  },
  titulo: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.8,
    color: colors.black,
  },
  selo: {
    fontSize: 11,
    fontFamily: typography.h1.fontFamily,
    color: colors.successText,
    backgroundColor: colors.successSurface,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});
