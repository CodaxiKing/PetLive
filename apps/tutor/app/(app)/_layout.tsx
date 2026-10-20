import { Tabs } from 'expo-router/js-tabs';
import { MenuInferior } from '../../src/components/MenuInferior';
import { colors } from '../../src/theme/colors';

/**
 * Áreas logadas: Início, Pets, Mapa e Perfil, com o menu inferior
 * flutuante preto. A tela do grupo esconde o cabeçalho padrão.
 */
export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <MenuInferior {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="inicio" options={{ title: 'Início' }} />
      <Tabs.Screen name="pets" options={{ title: 'Pets' }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
