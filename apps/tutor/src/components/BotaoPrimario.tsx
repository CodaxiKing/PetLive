import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
import { shadow } from '../theme/tokens';
import { Tocavel } from './Animacoes';
import { fontFamily, typography } from '../theme/typography';

type Props = {
  titulo: string;
  onPress?: () => void;
  /** Desabilita o botão e mostra o indicador de carregamento. */
  carregando?: boolean;
  desabilitado?: boolean;
  /** Mantido por compatibilidade: a versão 2 não desenha ícone padrão. */
  variante?: 'seta' | 'pata';
  /** Ícone próprio, num círculo azul-céu antes do texto. */
  icone?: ReactNode;
  /** Posição do botão no pai (flex, margem): vai no Pressable de fora. */
  estilo?: ViewStyle;
  /** Cor da pílula: escura por padrão, vermelha nas ações de emergência. */
  fundo?: string;
  /** Ação secundária: pílula branca com sombra e texto escuro. */
  claro?: boolean;
};

/**
 * Botão principal da versão 2 do protótipo: pílula escura com o texto ao
 * centro. Um ícone próprio aparece pequeno e branco antes do texto ("+ Novo
 * remédio"): as telas passam ícones escuros, então o botão os recolore.
 */
export function BotaoPrimario({ titulo, onPress, carregando, desabilitado, icone, estilo, fundo, claro }: Props) {
  const inativo = desabilitado || carregando;

  return (
    <Tocavel
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: Boolean(inativo), busy: Boolean(carregando) }}
      disabled={Boolean(inativo)}
      onPress={onPress}
      escala={0.97}
      // Sem isto, um flex: 1 no estilo ficava na camada de dentro e o botão
      // encolhia numa linha (ex.: "Começar" cortado nas boas-vindas).
      estiloExterno={estilo}
      style={[estilos.botao, claro && estilos.botaoClaro, fundo ? { backgroundColor: fundo } : null, inativo && estilos.botaoInativo]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={claro ? colors.black : colors.white} />
      ) : (
        <View style={estilos.conteudo}>
          {icone ? (claro ? icone : iconeBranco(icone)) : null}
          <Text style={[estilos.titulo, claro && estilos.tituloClaro]} numberOfLines={1}>
            {titulo}
          </Text>
        </View>
      )}
    </Tocavel>
  );
}

/** Ícone das telas (Icone, Phosphor ou um "+" em texto) em branco e no tamanho do botão. */
function iconeBranco(icone: ReactNode): ReactNode {
  if (!isValidElement(icone)) return icone;
  const props = icone.props as { style?: unknown };
  return cloneElement(icone as ReactElement<Record<string, unknown>>, {
    cor: colors.white,
    color: colors.white,
    size: 20,
    style: [props.style, { color: colors.white, fontSize: 22, lineHeight: 24 }],
  });
}

const estilos = StyleSheet.create({
  botao: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    paddingHorizontal: 20,
  },
  botaoClaro: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tituloClaro: {
    color: colors.black,
  },
  botaoInativo: {
    opacity: 0.55,
  },
  conteudo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    maxWidth: '100%',
  },
  titulo: {
    ...typography.button,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.white,
    flexShrink: 1,
  },
});
