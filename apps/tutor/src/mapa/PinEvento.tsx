import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

export function PinEvento() {
  return <View style={{ width: 42, height: 54 }}>
    <Svg width={42} height={54} viewBox="0 0 42 54">
      <Path d="M21 52C17 44 2 31 2 21a19 19 0 0 1 38 0c0 10-15 23-19 31Z" fill={colors.primaryDeep} stroke="white" strokeWidth={2} />
      <Rect x={11} y={12} width={20} height={20} rx={3} fill="white" />
      <Path d="M11 18h20M16 9v7M26 9v7M16 23h3M23 23h3M16 27h3" stroke={colors.primaryDeep} strokeWidth={2} />
    </Svg>
  </View>;
}
