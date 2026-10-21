import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { Surgir, Tocavel } from './Animacoes';
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
  /** Posição na lista, para escalonar a entrada (animação "rise"). */
  indice?: number;
};

/**
 * Linha do protótipo com círculo branco de ícone, rótulo pequeno e
 * valor em negrito (Privacidade e dados, SOS, Calculadoras).
 */
export function LinhaIcone({ indice = 0, ...props }: Props) {
  return (
    <Surgir indice={indice}>
      <Linha {...props} />
    </Surgir>
  );
}

function Linha({ icone, rotulo, valor, fundo = colors.background, onPress, desabilitado, direita }: Props) {
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
    <Tocavel
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${valor}`}
      accessibilityState={{ disabled: Boolean(desabilitado) }}
      disabled={desabilitado}
      onPress={onPress}
      escala={0.97}
      style={[estilos.linha, { backgroundColor: fundo }]}
    >
      {conteudo}
    </Tocavel>
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
