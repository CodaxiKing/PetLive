import { router } from 'expo-router';
import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useMovimentoReduzido } from './Animacoes';

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
 * círculo azul e, no meio, o SOS vermelho (versão 2 do protótipo). O SOS
 * não é uma aba: abre a tela de emergência por cima.
 *
 * A bolha azul desliza (spring) até a aba escolhida.
 *
 * Segue o contrato do Expo Router 58: `emitter.emit` antes de navegar e
 * `navigateToTab` com a *chave* da rota (não o nome).
 */
export function MenuInferior({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const base = Math.max(insets.bottom, 20);
  const reduzido = useMovimentoReduzido();
  const [largura, setLargura] = useState(0);
  const posicao = useState(() => new Animated.Value(state.index < Math.ceil(state.routes.length / 2) ? state.index : state.index + 1))[0];
  // Posições na pílula: as abas e o SOS no meio (depois da metade das abas).
  const meio = Math.ceil(state.routes.length / 2);
  const total = state.routes.length + 1;
  const vaga = (indice: number) => (indice < meio ? indice : indice + 1);
  // Itens de 54 px distribuídos com space-between e 8 px de respiro nas pontas.
  const passo = total > 1 && largura > 0 ? (largura - 16 - ITEM) / (total - 1) : 0;

  useEffect(() => {
    if (reduzido) {
      posicao.setValue(vaga(state.index));
      return;
    }
    const animacao = Animated.spring(posicao, {
      toValue: vaga(state.index),
      useNativeDriver: true,
      speed: 16,
      bounciness: 7,
    });
    animacao.start();
    return () => animacao.stop();
    // vaga depende só de `meio`, que muda junto com as rotas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, reduzido, posicao, meio]);

  return (
    <View style={[estilos.envoltorio, { bottom: base }]} pointerEvents="box-none">
      <View
        style={estilos.menu}
        role="tablist"
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
      >
        {largura > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              estilos.bolha,
              {
                transform: [
                  {
                    translateX: posicao.interpolate({
                      inputRange: [0, Math.max(total - 1, 1)],
                      outputRange: [8, 8 + passo * Math.max(total - 1, 1)],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
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

          const aba = (
            <Pressable
              key={rota.key}
              role="tab"
              accessibilityLabel={rotulo}
              accessibilityState={{ selected: focada }}
              onPress={aoPressionar}
              onLongPress={aoPressionarLongo}
              style={[estilos.item, focada && largura === 0 && estilos.itemAtivo]}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" color={focada ? colors.black : colors.textMuted}>
                {desenhoÍcone(rota.name as Ícone)}
              </Svg>
            </Pressable>
          );
          if (indice !== meio - 1) return aba;
          return [
            aba,
            <Pressable
              key="sos"
              accessibilityRole="button"
              accessibilityLabel="SOS, emergência"
              onPress={() => router.push('/sos')}
              style={({ pressed }) => [estilos.item, estilos.sos, pressed && { opacity: 0.85 }]}
            >
              <Text style={estilos.sosTexto}>SOS</Text>
            </Pressable>,
          ];
        })}
      </View>
    </View>
  );
}

const ITEM = 54;

const estilos = StyleSheet.create({
  envoltorio: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  menu: {
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.black,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  item: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAtivo: {
    backgroundColor: colors.primary,
  },
  sos: {
    backgroundColor: colors.emergency,
  },
  sosTexto: {
    fontFamily: fontFamily.extraBold,
    fontSize: 13,
    letterSpacing: 0.3,
    color: colors.white,
  },
  bolha: {
    position: 'absolute',
    left: 0,
    top: 7,
    width: ITEM,
    height: ITEM,
    borderRadius: ITEM / 2,
    backgroundColor: colors.primary,
  },
});
