import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useAnimacaoDestaque } from './useDestaques';

export function CoroaDestaque({ animar = false, tamanho = 28 }: { animar?: boolean; tamanho?: number }) {
  const [giro] = useState(() => new Animated.Value(0));
  useEffect(() => {
    giro.setValue(0);
    if (!animar) return;
    const ciclo = Animated.loop(Animated.timing(giro, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
    ciclo.start(); return () => ciclo.stop();
  }, [animar, giro]);
  return <View pointerEvents="none" accessible accessibilityLabel="Destaque pago" style={{ width: tamanho + 8, height: tamanho + 6, alignItems: 'center', justifyContent: 'center' }}>
    <Animated.View style={{ transform: [{ perspective: 500 }, { rotateY: giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
      <Svg width={tamanho} height={tamanho} viewBox="0 0 32 32" accessible={false}>
        <Path d="M5 11l5 5 6-10 6 10 5-5-3 14H8z" fill="#F4C542" stroke="#795313" strokeWidth={1.6} strokeLinejoin="round" />
        <Path d="M9 28h14" stroke="#795313" strokeWidth={2} strokeLinecap="round" />
        <Circle cx={5} cy={9} r={2} fill="#F4C542" /><Circle cx={16} cy={4} r={2} fill="#F4C542" /><Circle cx={27} cy={9} r={2} fill="#F4C542" />
      </Svg>
    </Animated.View>
  </View>;
}
export function SeloDestaquePago() {
  const animar = useAnimacaoDestaque();
  return <View style={s.selo}><CoroaDestaque animar={animar} tamanho={32} /><Text style={s.texto}>Destaque pago</Text></View>;
}
const s = StyleSheet.create({ selo: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 6 }, texto: { ...typography.body, color: colors.black, fontWeight: '700' } });
