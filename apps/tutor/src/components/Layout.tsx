import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { User } from 'phosphor-react-native/src/icons/User';
import { colors } from '../../src/theme/colors';
import { fontFamily, typography } from '../../src/theme/typography';

/** Botão redondo branco do cabeçalho, com ícone. Sem onPress é só um selo. */
export function BotaoRedondo({
  children,
  acessibilidade,
  onPress,
}: {
  children: React.ReactNode;
  acessibilidade: string;
  onPress?: () => void;
}) {
  if (!onPress) {
    return (
      <View accessibilityLabel={acessibilidade} style={estilos.botaoRedondo}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={acessibilidade}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [estilos.botaoRedondo, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

/** Ícone de sino (avisos). */
export function IconeSino({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return <Bell size={size} color={cor} />;
}

/** Ícone de perfil. */
export function IconePerfil({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return <User size={size} color={cor} />;
}

/** Ícone de localização. */
export function IconeLocal({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return <MapPin size={size} color={cor} />;
}

/** Ícone de busca. */
export function IconeBusca({ size = 20, cor = colors.black }: { size?: number; cor?: string }) {
  return <MagnifyingGlass size={size} color={cor} />;
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
    shadowColor: '#0E1726',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
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
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.black,
  },
  secaoAcao: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
});
