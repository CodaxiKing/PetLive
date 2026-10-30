import { ReactNode } from 'react';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { voltarOuInicio } from '../lib/voltar';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadow } from '../theme/tokens';

type Props = {
  titulo: string;
  /** Ação opcional exibida à direita (ex.: um texto-botão). */
  acao?: string;
  onAcao?: () => void;
  /** Título ao lado do voltar, como em Peso do protótipo. */
  aEsquerda?: boolean;
  children?: ReactNode;
};

/**
 * Cabeçalho das telas empilhadas (Pets, detalhe do pet, formulários):
 * volta à tela anterior, título centralizado e ação opcional.
 */
export function CabecalhoTela({ titulo, acao, onAcao, aEsquerda, children }: Props) {
  return (
    <View style={estilos.cabecalho}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        hitSlop={12}
        onPress={voltarOuInicio}
        style={({ pressed }) => [estilos.botaoVoltar, pressed && estilos.pressionado]}
      >
        <ArrowLeft size={22} color={colors.black} />
      </Pressable>

      <Text style={[estilos.titulo, aEsquerda && estilos.tituloEsquerda]} accessibilityRole="header">
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
    gap: 12,
    // Mesma posição do HeroiOnda, para o título não pular entre as telas.
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  botaoVoltar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pressionado: {
    opacity: 0.6,
  },
  titulo: {
    flex: 1,
    textAlign: 'left',
    ...typography.h1,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.8,
    color: colors.black,
  },
  tituloEsquerda: {
    textAlign: 'left',
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
    width: 0,
  },
});
