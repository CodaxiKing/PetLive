import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { IconePerfil } from '../../src/components/Layout';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

/**
 * Perfil do tutor (board: [APP-CLIENTE] "Perfil do tutor e sair da conta",
 * P1). Sair já está funcionando; editar perfil vem na mesma task.
 */
export default function Perfil() {
  const router = useRouter();
  const { user } = useAuth();

  async function sair() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Não foi possível sair', error.message);
      return;
    }
    // Sem sessão o layout raiz volta para as boas-vindas.
    router.replace('/welcome');
  }

  return (
    <View style={estilos.tela}>
      <Text style={estilos.titulo}>Perfil</Text>

      <View style={estilos.cartao}>
        <View style={estilos.avatar}>
          <IconePerfil size={26} />
        </View>
        <View style={estilos.identidade}>
          <Text style={estilos.nome} numberOfLines={1}>
            {user?.user_metadata?.full_name ?? user?.email ?? 'Tutor PetLive'}
          </Text>
          <Text style={estilos.email} numberOfLines={1}>
            {user?.email ?? 'sem e-mail'}
          </Text>
        </View>
        <View style={estilos.plano}>
          <Text style={estilos.planoTexto}>Grátis</Text>
        </View>
      </View>

      <View style={estilos.opcoes}>
        {['Meus dados', 'Exportar meus dados', 'Termos de uso e LGPD', 'Avisos'].map((opcao) => (
          <Pressable key={opcao} style={estilos.opcao} onPress={() => {}}>
            <Text style={estilos.opcaoTexto}>{opcao}</Text>
            <Text style={estilos.opcaoSeta}>›</Text>
          </Pressable>
        ))}
      </View>

      <View style={estilos.avisos}>
        <Text style={estilos.avisoSaude}>
          O PetLive organiza informações e não substitui o atendimento veterinário.
        </Text>
      </View>

      <Pressable accessibilityRole="button" onPress={sair} style={({ pressed }) => [estilos.sair, pressed && { opacity: 0.7 }]}>
        <Text style={estilos.sairTexto}>Sair da conta</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 54,
    gap: spacing.xl,
  },
  titulo: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
  },
  cartao: {
    backgroundColor: colors.primarySurface,
    borderRadius: 24,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identidade: {
    flex: 1,
    minWidth: 0,
  },
  nome: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.black,
  },
  email: {
    ...typography.small,
    color: colors.primaryDeep,
  },
  plano: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  planoTexto: {
    ...typography.label,
    fontSize: 12,
    color: colors.primaryDeep,
  },
  opcoes: {
    gap: spacing.sm,
  },
  opcao: {
    backgroundColor: colors.background,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  opcaoTexto: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  opcaoSeta: {
    fontSize: 22,
    color: colors.textMuted,
  },
  avisos: {
    marginTop: 'auto',
  },
  avisoSaude: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    backgroundColor: colors.warningSurface,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sair: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 100,
  },
  sairTexto: {
    ...typography.button,
    color: colors.danger,
  },
});
