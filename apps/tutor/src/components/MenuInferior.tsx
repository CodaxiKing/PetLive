import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

type Ícone = 'inicio' | 'pets' | 'mapa' | 'perfil' | 'avisos';

function desenhoÍcone(nome: Ícone) {
  switch (nome) {
    case 'inicio':
      return (
        <Path
          d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'pets':
      return (
        <>
          <Circle cx={6} cy={10} r={1.8} stroke="currentColor" strokeWidth={1.8} fill="none" />
          <Circle cx={10} cy={6} r={1.8} stroke="currentColor" strokeWidth={1.8} fill="none" />
          <Circle cx={14} cy={6} r={1.8} stroke="currentColor" strokeWidth={1.8} fill="none" />
          <Circle cx={18} cy={10} r={1.8} stroke="currentColor" strokeWidth={1.8} fill="none" />
          <Path
            d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'mapa':
      return (
        <>
          <Path
            d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Circle cx={12} cy={11} r={2} stroke="currentColor" strokeWidth={1.8} fill="none" />
        </>
      );
    case 'avisos':
      return (
        <>
          <Path
            d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M10 21h4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" fill="none" />
        </>
      );
    case 'perfil':
    default:
      return (
        <>
          <Circle cx={12} cy={8} r={4} stroke="currentColor" strokeWidth={1.8} fill="none" />
          <Path
            d="M4 20c1-4 4-6 8-6s7 2 8 6"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
  }
}

const RÓTULOS: Record<string, string> = {
  inicio: 'Início',
  pets: 'Pets',
  mapa: 'Mapa',
  perfil: 'Perfil',
  avisos: 'Avisos',
};

/**
 * Menu inferior flutuante: pílula preta suspensa com o item ativo em
 * círculo azul, como no protótipo (Inicio.dc.html <nav>).
 *
 * Segue o contrato do Expo Router 58: `emitter.emit` antes de navegar e
 * `navigateToTab` com a *chave* da rota (não o nome).
 */
export function MenuInferior({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const base = Math.max(insets.bottom, 20);

  return (
    <View style={[estilos.envoltorio, { bottom: base }]} pointerEvents="box-none">
      <View style={estilos.menu} role="tablist">
        {state.routes.map((rota, indice) => {
          const focada = indice === state.index;
          const opcoes = descriptors[rota.key]?.options;

          function aoPressionar() {
            const evento = emitter.emit({ type: 'tabPress', target: rota.key, canPreventDefault: true });
            if (!focada && !evento.defaultPrevented) {
              navigateToTab(rota.key);
            }
          }

          function aoPressionarLongo() {
            emitter.emit({ type: 'tabLongPress', target: rota.key });
          }

          const rotulo =
            (typeof opcoes?.tabBarLabel === 'string' && opcoes.tabBarLabel) ||
            opcoes?.title ||
            RÓTULOS[rota.name] ||
            rota.name;

          return (
            <Pressable
              key={rota.key}
              role="tab"
              accessibilityLabel={rotulo}
              accessibilityState={{ selected: focada }}
              onPress={aoPressionar}
              onLongPress={aoPressionarLongo}
              style={[estilos.item, focada && estilos.itemAtivo]}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" color={focada ? colors.black : colors.white}>
                {desenhoÍcone(rota.name as Ícone)}
              </Svg>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  envoltorio: {
    position: 'absolute',
    left: 24,
    right: 24,
  },
  menu: {
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  item: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAtivo: {
    backgroundColor: colors.primary,
  },
});
