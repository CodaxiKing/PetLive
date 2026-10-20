import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
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
import { RemediosProvider } from '../src/remedios/RemediosProvider';
import { VacinasProvider } from '../src/saude/VacinasProvider';
import { colors } from '../src/theme/colors';

/**
 * Sentry: só liga quando há DSN (sem conta/DSN o app segue normal,
 * apenas sem enviar erros). `sendDefaultPii` desligado por causa da LGPD:
 * nenhum dado pessoal automático junto com o erro.
 */
const dsnSentry = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (dsnSentry) {
  Sentry.init({
    dsn: dsnSentry,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
  });
}

/**
 * Ao tocar numa notificação, abre a rota indicada em `data.url`.
 * Segue o padrão da doc do SDK 58 (Expo Router + expo-notifications).
 */
function useObservadorNotificacoes() {
  useEffect(() => {
    function abrir(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') {
        router.push(url as never);
        Notifications.clearLastNotificationResponse();
      }
    }

    // App aberto a partir de uma notificação já encaminhada.
    const respostaInicial = Notifications.getLastNotificationResponse();
    if (respostaInicial?.notification) {
      abrir(respostaInicial.notification);
    }

    const subscricao = Notifications.addNotificationResponseReceivedListener((resposta) => {
      abrir(resposta.notification);
    });

    return () => subscricao.remove();
  }, []);
}

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
          <RemediosProvider>
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
                <Stack.Screen name="pet/[id]/remedio/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="lembretes/index" />
                <Stack.Screen name="lembretes/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="avisos" />
              </Stack.Protected>
              <Stack.Protected guard={!session}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
            </Stack>
          </RemediosProvider>
        </LembretesProvider>
      </VacinasProvider>
    </PetsProvider>
  );
}

function RootLayout() {
  // Hook incondicional (antes do early-return das fontes) para manter a
  // ordem de hooks estável e abrir a rota certa ao tocar na notificação.
  useObservadorNotificacoes();

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

/** Erros não capturados vão para o Sentry quando há DSN configurado. */
export default Sentry.wrap(RootLayout);

const estilos = StyleSheet.create({
  carregando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
