import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useMovimentoReduzido } from '../components/Animacoes';

const AZUL = '#1A73E8';

/**
 * Ponto azul de "você está aqui": bolinha com borda branca e uma onda que
 * pulsa em volta (parada com o movimento reduzido do sistema).
 */
export function PontoUsuario() {
  const reduzido = useMovimentoReduzido();
  const onda = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduzido) return;
    const laco = Animated.loop(
      Animated.timing(onda, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    laco.start();
    return () => laco.stop();
  }, [onda, reduzido]);

  return (
    <View style={estilos.area} accessible accessibilityLabel="Você está aqui" pointerEvents="none">
      <Animated.View
        style={[
          estilos.onda,
          reduzido
            ? estilos.ondaParada
            : {
                opacity: onda.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: onda.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
              },
        ]}
      />
      <View style={estilos.ponto} />
    </View>
  );
}

const estilos = StyleSheet.create({
  area: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  onda: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: AZUL },
  ondaParada: { opacity: 0.18, transform: [{ scale: 0.7 }] },
  ponto: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: AZUL,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});
