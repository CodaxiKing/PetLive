import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { LembretesProvider } from '../src/lembretes/LembretesProvider';
import { PetsProvider } from '../src/pets/PetsProvider';
import { VacinasProvider } from '../src/saude/VacinasProvider';
import { colors } from '../src/theme/colors';

/** Decide para onde a rota raiz aponta, conforme a sessão. */
function RaizProtegida() {
  const { session, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </View>
    );
  }

  return (
    <PetsProvider>
      <VacinasProvider>
        <LembretesProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Protected guard={Boolean(session)}>
              <Stack.Screen name="(app)" />
              <Stack.Screen name="pet/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="pet/[id]/index" />
              <Stack.Screen name="pet/[id]/editar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="pet/[id]/vacina/nova" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="lembretes/index" />
              <Stack.Screen name="lembretes/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack.Protected>
            <Stack.Protected guard={!session}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
        </LembretesProvider>
      </VacinasProvider>
    </PetsProvider>
  );
}

export default function RootLayout() {
  const [carregandoFontes] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Espera as fontes: sem isso as telas piscam com a fonte do sistema.
  if (carregandoFontes) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RaizProtegida />
    </AuthProvider>
  );
}

const estilos = StyleSheet.create({
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
