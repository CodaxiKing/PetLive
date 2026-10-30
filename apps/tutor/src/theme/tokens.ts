import { TextStyle, ViewStyle } from 'react-native';
import { colors } from './colors';
import { typography } from './typography';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 24,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

/** Elevação leve dos cards do protótipo. */
export const shadow = {
  // Versão 2: sombra baixa e espalhada, sem borda no card.
  card: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
  },
  floating: {
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;

export const components = {
  /** Card branco arredondado, o bloco base das telas. */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  } satisfies ViewStyle,

  /** Campo de texto e busca. */
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
  } satisfies TextStyle,

  /** Pílula de filtro, categoria ou etiqueta. */
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  } satisfies ViewStyle,

  /** Botão principal preenchido: pílula escura. */
  buttonPrimary: {
    backgroundColor: colors.black,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...typography.button,
    color: colors.white,
  } satisfies ViewStyle & TextStyle,

  /** Botão secundário, com borda. */
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...typography.button,
    color: colors.text,
  } satisfies ViewStyle & TextStyle,
} as const;
