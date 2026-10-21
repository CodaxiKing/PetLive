import { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, typography } from '../theme/typography';
import { spacing } from '../theme/tokens';

type Variante = 'roxo' | 'azul' | 'verde' | 'neutro';

type Props = TextInputProps & {
  rotulo: string;
  variante?: Variante;
  icone?: ReactNode;
};

const temaPorVariante: Record<Variante, { fundo: string; texto: string }> = {
  roxo: { fundo: colors.premiumSurface, texto: colors.premiumText },
  azul: { fundo: colors.primarySurface, texto: colors.primaryDeep },
  verde: { fundo: colors.successSurface, texto: colors.successText },
  neutro: { fundo: colors.disabled, texto: colors.textMuted },
};

/**
 * Campo do protótipo: caixa colorida arredondada com rótulo pequeno
 * colorido, ícone à esquerda e texto forte.
 */
export function Campo({ rotulo, variante = 'neutro', icone, ...props }: Props) {
  const tema = temaPorVariante[variante];

  return (
    <View style={[estilos.campo, { backgroundColor: tema.fundo }]}>
      {icone ? <View style={estilos.icone}>{icone}</View> : null}

      <View style={estilos.conteudo}>
        <Text style={[estilos.rotulo, { color: tema.texto }]}>{rotulo}</Text>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[estilos.texto, { color: colors.text }]}
          {...props}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 28,
    paddingHorizontal: spacing.xl,
    minHeight: 62,
  },
  icone: {
    flexShrink: 0,
  },
  conteudo: {
    flex: 1,
    minWidth: 0,
  },
  rotulo: {
    ...typography.label,
    fontSize: 11,
    marginBottom: 2,
  },
  texto: {
    ...typography.body,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    paddingVertical: 0,
  },
});
