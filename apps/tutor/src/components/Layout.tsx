import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

/** Botão redondo branco do cabeçalho, com ícone. */
export function BotaoRedondo({ children, acessibilidade }: { children: React.ReactNode; acessibilidade: string }) {
  return (
    <View accessibilityRole="button" accessibilityLabel={acessibilidade} style={estilos.botaoRedondo}>
      {children}
    </View>
  );
}

/** Onda branca do rodapé dos heróis azuis. */
export function OndaHeroi({ largura }: { largura: number }) {
  return (
    <Svg width={largura} height={46} viewBox="0 0 390 46" preserveAspectRatio="none" style={estilos.onda}>
      <Path
        d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
        fill="#fff"
      />
    </Svg>
  );
}

/** Ícone de sino (avisos). */
export function IconeSino({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
      <Path d="M10 21h4" />
    </Svg>
  );
}

/** Ícone de perfil. */
export function IconePerfil({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
    </Svg>
  );
}

/** Ícone de localização. */
export function IconeLocal({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z" />
      <Circle cx={12} cy={11} r={2} />
    </Svg>
  );
}

/** Ícone de busca. */
export function IconeBusca({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={1.8} strokeLinecap="round">
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4-4" />
    </Svg>
  );
}

/** Título de seção com link à direita ("Ver todos ›"). */
export function Secao({ titulo, acao, onAcao }: { titulo: string; acao?: string; onAcao?: () => void }) {
  return (
    <View style={estilos.secao}>
      <Text style={estilos.secaoTitulo}>{titulo}</Text>
      {acao ? (
        <Text style={estilos.secaoAcao} onPress={onAcao}>
          {acao}
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onda: {
    position: 'absolute',
    left: 0,
    bottom: -1,
  },
  secao: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
    marginBottom: 10,
  },
  secaoTitulo: {
    ...typography.h3,
    fontWeight: '700',
    fontSize: 16,
    color: colors.black,
  },
  secaoAcao: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
