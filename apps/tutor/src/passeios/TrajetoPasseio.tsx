import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { PontoPasseio } from './passeio';
import { desenhoTrajeto } from './trajeto';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export function TrajetoPasseio({ pontos }: { pontos: PontoPasseio[] }) {
  const desenho = desenhoTrajeto(pontos);
  if (!desenho.inicio || !desenho.fim) return null;
  return <View>
    <Text style={{ ...typography.bodyMedium, color: colors.black }}>Trajeto salvo</Text>
    <Svg width="100%" height={180} viewBox="0 0 320 180" accessibilityLabel={`Trajeto com ${pontos.length} pontos; pausas são separadas no desenho.`}>
      <Path d={desenho.caminho} stroke={colors.primaryDeep} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={desenho.inicio.x} cy={desenho.inicio.y} r={5} fill={colors.primaryDeep} />
      <Circle cx={desenho.fim.x} cy={desenho.fim.y} r={5} fill={colors.white} stroke={colors.primaryDeep} strokeWidth={2} />
    </Svg>
    <Text style={{ ...typography.caption, color: colors.textMuted }}>Desenho do trajeto, sem mapa de ruas. Os trechos ficam separados durante pausas e falhas de sinal.</Text>
  </View>;
}
