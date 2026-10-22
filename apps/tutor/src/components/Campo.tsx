import { type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily, typography } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { aplicarMascara, TAMANHO_MASCARA, type Mascara } from '../lib/mascaras';

type Variante = 'roxo' | 'azul' | 'verde' | 'amarelo' | 'neutro';

type Props = TextInputProps & {
  rotulo: string;
  variante?: Variante;
  icone?: ReactNode;
  /** Data (DD/MM/AAAA), telefone ((21) 99876-5432) ou hora (09:30): os separadores entram sozinhos. */
  mascara?: Mascara;
};

const temaPorVariante: Record<Variante, { fundo: string; texto: string }> = {
  roxo: { fundo: colors.premiumSurface, texto: colors.premiumText },
  azul: { fundo: colors.primarySurface, texto: colors.primaryDeep },
  verde: { fundo: colors.successSurface, texto: colors.successText },
  amarelo: { fundo: colors.warningSurface, texto: colors.warningText },
  neutro: { fundo: colors.disabled, texto: colors.textMuted },
};

/**
 * Campo do protótipo: caixa colorida arredondada com rótulo pequeno
 * colorido, ícone à esquerda e texto forte.
 */
export function Campo({ rotulo, variante = 'neutro', icone, mascara, ...props }: Props) {
  const tema = temaPorVariante[variante];

  return (
    <View style={[estilos.campo, { backgroundColor: tema.fundo }]}>
      {icone ? <View style={estilos.icone}>{icone}</View> : null}

      <View style={estilos.conteudo}>
        <Text style={[estilos.rotulo, { color: tema.texto }]}>{rotulo}</Text>
        <TextInput
          // O leitor de tela anuncia o rótulo (sem isso, só o placeholder).
          accessibilityLabel={rotulo}
          placeholderTextColor={colors.textMuted}
          style={[estilos.texto, { color: colors.text }]}
          {...(mascara
            ? { keyboardType: mascara === 'telefone' ? 'phone-pad' : 'number-pad', maxLength: TAMANHO_MASCARA[mascara] }
            : null)}
          {...props}
          onChangeText={mascara ? (texto) => props.onChangeText?.(aplicarMascara(mascara, texto)) : props.onChangeText}
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
