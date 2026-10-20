import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type Props = {
  icone: ReactNode;
  /** Texto pequeno de cima (o "o quê"). */
  rotulo: string;
  /** Texto forte de baixo (o estado ou o detalhe). */
  valor: string;
  /** Fundo da linha: cinza por padrão, rosa nas ações destrutivas. */
  fundo?: string;
  onPress?: () => void;
  desabilitado?: boolean;
  /** Elemento à direita (interruptor, seta, selo). */
  direita?: ReactNode;
};

/**
 * Linha do protótipo com círculo branco de ícone, rótulo pequeno e
 * valor em negrito (Privacidade e dados, SOS, Calculadoras).
 */
export function LinhaIcone({ icone, rotulo, valor, fundo = colors.background, onPress, desabilitado, direita }: Props) {
  const conteudo = (
    <>
      <View style={estilos.circulo}>{icone}</View>
      <View style={estilos.textos}>
        <Text style={estilos.rotulo}>{rotulo}</Text>
        <Text style={estilos.valor}>{valor}</Text>
      </View>
      {direita}
    </>
  );

  if (!onPress) {
    return <View style={[estilos.linha, { backgroundColor: fundo }]}>{conteudo}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${valor}`}
      accessibilityState={{ disabled: Boolean(desabilitado) }}
      disabled={desabilitado}
      onPress={onPress}
      style={({ pressed }) => [estilos.linha, { backgroundColor: fundo }, pressed && { opacity: 0.7 }]}
    >
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
  },
  circulo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textos: {
    flex: 1,
    minWidth: 0,
  },
  rotulo: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
  },
  valor: {
    ...typography.captionMedium,
    fontFamily: typography.label.fontFamily,
    color: colors.black,
  },
});
