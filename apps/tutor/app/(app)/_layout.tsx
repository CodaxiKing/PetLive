import { useEffect } from 'react';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePets } from '../../src/pets/PetsProvider';
import { precisaAceitarTermos } from '../../src/privacidade/consentimentos';
import { MenuInferior } from '../../src/components/MenuInferior';
import { colors } from '../../src/theme/colors';

/**
 * Áreas logadas: Início, Pets, Mapa e Perfil, com o menu inferior
 * flutuante preto. A tela do grupo esconde o cabeçalho padrão.
 */
/** Tutores já conferidos nesta execução do app (evita repetir a consulta). */
const termosConferidos = new Set<string>();

/** Conta criada há menos de um dia: ainda é o primeiro acesso. */
function contaNova(criadaEm: string | undefined): boolean {
  const quando = criadaEm ? Date.parse(criadaEm) : NaN;
  return Number.isFinite(quando) && Date.now() - quando < 24 * 60 * 60 * 1000;
}

/**
 * Primeiro acesso (BUSINESS.md 19.1): sem o aceite dos termos e da política
 * na versão vigente, abre Termos e depois Permissões (que leva ao cadastro
 * do pet). Quem aceitou os termos já ao criar a conta pula esse caminho, então
 * a conta nova sem pet vai direto para "Conheça seu pet". Sem rede, não trava.
 */
function useConferirTermos() {
  const { user } = useAuth();
  const { pets, carregando } = usePets();
  const semPet = pets.length === 0;
  useEffect(() => {
    if (!user || carregando || termosConferidos.has(user.id)) return;
    precisaAceitarTermos().then(
      (precisa) => {
        termosConferidos.add(user.id);
        if (precisa) router.push('/termos?primeiroAcesso=1');
        else if (semPet && contaNova(user.created_at)) router.push('/pet/novo?primeiroAcesso=1');
      },
      () => undefined,
    );
  }, [user, carregando, semPet]);
}

export default function AppLayout() {
  useConferirTermos();

  return (
    <Tabs
      tabBar={(props) => <MenuInferior {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
        // Troca de aba: a tela nova aparece e desliza um pouco no sentido da aba.
        animation: 'shift',
        transitionSpec: { animation: 'timing', config: { duration: 260 } },
        sceneStyleInterpolator: ({ current }) => ({
          sceneStyle: {
            opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
            transform: [
              {
                translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-28, 0, 28] }),
              },
            ],
          },
        }),
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Início' }} />
      <Tabs.Screen name="pets" options={{ title: 'Pets' }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
