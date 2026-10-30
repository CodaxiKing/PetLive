import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors } from '../theme/colors';
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
};

/**
 * Botão principal da versão 2 do protótipo: pílula escura com o texto ao
 * centro. Um ícone próprio aparece num círculo azul-céu antes do texto
 * (os ícones das telas são escuros, e o círculo os mantém legíveis).
 */
export function BotaoPrimario({ titulo, onPress, carregando, desabilitado, icone, estilo }: Props) {
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
      style={[estilos.botao, inativo && estilos.botaoInativo]}
    >
      {carregando ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <View style={estilos.conteudo}>
          {icone ? <View style={estilos.circulo}>{icone}</View> : null}
          <Text style={estilos.titulo} numberOfLines={1}>
            {titulo}
          </Text>
        </View>
      )}
    </Tocavel>
  );
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
  circulo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titulo: {
    ...typography.button,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.white,
    flexShrink: 1,
  },
});
