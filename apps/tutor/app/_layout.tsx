import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
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
import { registrarCategoriaDose, tratarRespostaDose } from '../src/notificacoes/doses';
import { registrarTarefaDose } from '../src/notificacoes/tarefaDose';
import { atualizarPacoteEmergencia } from '../src/sos/pacote';
import { colors } from '../src/theme/colors';
import { useConfigApp } from '../src/lib/configApp';
import { registrarAberturaDiaria } from '../src/lib/eventos';
import { marcarLido } from '../src/notificacoes/caixa';
import { TelaAtualizar } from '../src/components/TelaAtualizar';

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
    // Botões Feito e Adiar da notificação da dose (com o app fechado, quem
    // trata é a tarefa de segundo plano em src/notificacoes/tarefaDose.ts).
    registrarCategoriaDose().catch(() => undefined);
    registrarTarefaDose().catch(() => undefined);
    // Conteúdo de emergência: baixa versão nova em segundo plano, se houver.
    atualizarPacoteEmergencia().catch(() => undefined);

    async function tratar(resposta: Notifications.NotificationResponse) {
      Notifications.clearLastNotificationResponse();
      const eraBotaoDose = await tratarRespostaDose(resposta).catch(() => true);
      if (eraBotaoDose) return;
      const dados = resposta.notification.request.content.data;
      // Abriu pela notificação: conta como lida (taxa de abertura das campanhas).
      if (typeof dados?.aviso_id === 'string') marcarLido(dados.aviso_id).catch(() => undefined);
      const url = dados?.url;
      if (typeof url === 'string') router.push(url as never);
    }

    // App aberto a partir de uma notificação já encaminhada.
    const respostaInicial = Notifications.getLastNotificationResponse();
    if (respostaInicial?.notification) tratar(respostaInicial);

    const subscricao = Notifications.addNotificationResponseReceivedListener(tratar);

    return () => subscricao.remove();
  }, []);
}

/** Decide para onde a rota raiz aponta, conforme a sessão. */
function RaizProtegida() {
  const { session, carregando } = useAuth();
  const { precisaAtualizar } = useConfigApp();
  const logado = Boolean(session);

  // Tutores ativos (métrica da Fase 1): uma abertura por dia, também ao voltar ao app.
  useEffect(() => {
    if (!logado) return;
    registrarAberturaDiaria();
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') registrarAberturaDiaria();
    });
    return () => assinatura.remove();
  }, [logado]);

  // Versão abaixo da mínima do painel (área Sistema): só a tela de atualizar.
  if (precisaAtualizar) return <TelaAtualizar />;

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
                // Desliza com leve parallax (como no iOS) nas duas plataformas.
                animation: 'ios_from_right',
                animationDuration: 320,
                gestureEnabled: true,
              }}
            >
              <Stack.Protected guard={Boolean(session)}>
                <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
                <Stack.Screen name="pet/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/index" />
                <Stack.Screen name="pet/[id]/carteirinha" />
                <Stack.Screen name="pet/[id]/compartilhar" />
                <Stack.Screen name="pet/[id]/ficha" />
                <Stack.Screen name="pet/[id]/cuidador" />
                <Stack.Screen name="pet/[id]/linha-do-tempo" />
                <Stack.Screen name="pet/[id]/marco" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/partida" />
                <Stack.Screen name="pet/[id]/memorial" options={{ animation: 'fade' }} />
                <Stack.Screen name="pet/[id]/reativar" />
                <Stack.Screen name="apoio-luto" />
                <Stack.Screen name="despesas/index" />
                <Stack.Screen name="despesas/nova" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="ficha/enviar" />
                <Stack.Screen name="mapa/pet-friendly" />
                <Stack.Screen name="atalhos" />
                <Stack.Screen name="mapa/indicar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/editar" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/vacina/nova" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/remedio/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="lembretes/index" />
                <Stack.Screen name="lembretes/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="lembretes/rotina" />
                <Stack.Screen name="avisos" />
                <Stack.Screen name="avisos/caixa" />
                <Stack.Screen name="termos" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="permissoes" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="privacidade" />
                <Stack.Screen name="sos/index" options={{ animation: 'fade_from_bottom' }} />
                <Stack.Screen name="sos/primeiros-socorros" />
                <Stack.Screen name="sos/intoxicacao" />
                <Stack.Screen name="ferramentas/calculadoras" />
              </Stack.Protected>
              <Stack.Protected guard={!session}>
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
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

  // useFonts devolve [carregadas, erro]: true quando as fontes estão prontas.
  const [fontesCarregadas, erroFontes] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Espera as fontes: sem isso as telas piscam com a fonte do sistema.
  // Se falharem, segue com a fonte do sistema em vez de travar.
  if (!fontesCarregadas && !erroFontes) {
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
