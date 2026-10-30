import { router } from 'expo-router';
import { type BottomTabBarProps } from 'expo-router/js-tabs';
import { type ComponentType, useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconProps } from 'phosphor-react-native';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { House } from 'phosphor-react-native/src/icons/House';
import { MapTrifold } from 'phosphor-react-native/src/icons/MapTrifold';
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { User } from 'phosphor-react-native/src/icons/User';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { useMovimentoReduzido } from './Animacoes';

type Ícone = 'inicio' | 'pets' | 'mapa' | 'perfil' | 'avisos';

/** Ícones das abas (Phosphor), como na versão 2 do protótipo. */
const ÍCONES: Record<Ícone, ComponentType<IconProps>> = {
  inicio: House,
  pets: PawPrint,
  mapa: MapTrifold,
  perfil: User,
  avisos: Bell,
};

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
              {(() => {
                const Desenho = ÍCONES[rota.name as Ícone] ?? User;
                return <Desenho size={24} color={focada ? colors.black : '#9AA3B2'} weight={focada ? 'bold' : 'regular'} />;
              })()}
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
