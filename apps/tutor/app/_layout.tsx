import { useEffect, useState } from 'react';
import '../src/passeios/segundoPlano';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
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
import { useConfigApp } from '../src/lib/configApp';
import { registrarAberturaDiaria } from '../src/lib/eventos';
import { TelaAtualizar } from '../src/components/TelaAtualizar';
import { verificarEAplicarAtualizacao } from '../src/lib/atualizacao';
import { RetomarAtalho } from '../src/atalhos/RetomarAtalho';
import { ObservadorNotificacoes } from '../src/notificacoes/ObservadorNotificacoes';
import { renovarRegiaoPerdidosSeLigada } from '../src/perdido/perdido';

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

/** Decide para onde a rota raiz aponta, conforme a sessão. */
function RaizProtegida() {
  const { session, carregando } = useAuth();
  const { precisaAtualizar } = useConfigApp();
  const logado = Boolean(session);

  // Tutores ativos (métrica da Fase 1): uma abertura por dia, também ao voltar ao app.
  useEffect(() => {
    if (!logado) return;
    registrarAberturaDiaria();
    // Região dos alertas de pet perdido: renova ao abrir, sem pedir permissão (BUSINESS.md 5.29).
    renovarRegiaoPerdidosSeLigada().catch(() => undefined);
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
    <PetsProvider key={session?.user.id ?? 'sem-conta'}>
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
                <Stack.Screen name="adocao/index" />
                <Stack.Screen name="adocao/[id]" />
                <Stack.Screen name="ong/index" />
                <Stack.Screen name="ong/pet" />
                <Stack.Screen name="ong/cadastros" />
                <Stack.Screen name="ong/cadastro" />
                <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
                <Stack.Screen name="pet/novo" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/index" />
                <Stack.Screen name="pet/[id]/carteirinha" />
                <Stack.Screen name="pet/[id]/compartilhar" />
                <Stack.Screen name="pet/[id]/atualizacoes" />
                <Stack.Screen name="pet/[id]/revisar-vacinas" />
                <Stack.Screen name="pet/[id]/achado" />
                <Stack.Screen name="pet-perdido/index" />
                <Stack.Screen name="parceiros/seguro" />
                <Stack.Screen name="pet-perdido/[id]" />
                <Stack.Screen name="alerta/[id]/index" />
                <Stack.Screen name="alerta/[id]/visto" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="guarda/index" />
                <Stack.Screen name="guarda/convidar" />
                <Stack.Screen name="guarda/convite/[id]" />
                <Stack.Screen name="pet/[id]/ficha" />
                <Stack.Screen name="pet/[id]/cuidador" />
                <Stack.Screen name="pet/[id]/linha-do-tempo" />
                <Stack.Screen name="pet/[id]/album" />
                <Stack.Screen name="pet/[id]/marco" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="pet/[id]/partida" />
                <Stack.Screen name="pet/[id]/memorial" options={{ animation: 'fade' }} />
                <Stack.Screen name="pet/[id]/reativar" />
                <Stack.Screen name="apoio-luto" />
                <Stack.Screen name="pet/[id]/senior" />
                <Stack.Screen name="pet/[id]/qualidade-de-vida" />
                <Stack.Screen name="cuidados/fogos" />
                <Stack.Screen name="pet/[id]/viagem" />
                <Stack.Screen name="pet/[id]/selos" />
                <Stack.Screen name="meus-dados" />
                <Stack.Screen name="alterar-senha" />
                <Stack.Screen name="alterar-email" />
                <Stack.Screen name="premium/assinatura" />
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
              <Stack.Screen name="acao-rapida" />
            </Stack>
          </RemediosProvider>
        </LembretesProvider>
      </VacinasProvider>
    </PetsProvider>
  );
}

function RootLayout() {
  // useFonts devolve [carregadas, erro]: true quando as fontes estão prontas.
  const [fontesCarregadas, erroFontes] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // Atualização OTA na inicialização: busca e aplica a nova versão, se houver.
  const [atualizacaoVerificada, setAtualizacaoVerificada] = useState(false);
  useEffect(() => {
    void verificarEAplicarAtualizacao().finally(() => setAtualizacaoVerificada(true));
  }, []);

  // Espera as fontes e a verificação de atualização: sem isso as telas
  // piscam com a fonte do sistema ou com uma versão antiga. Se as fontes
  // falharem, segue com a fonte do sistema em vez de travar.
  if ((!fontesCarregadas && !erroFontes) || !atualizacaoVerificada) {
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
      <RetomarAtalho />
      <ObservadorNotificacoes />
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
