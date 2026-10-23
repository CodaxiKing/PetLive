import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

/**
 * Marcador da localização do tutor logado no mapa (board: P-CKbvE).
 * É visualmente distinguível dos pins de lugar: bolinha azul da marca com
 * borda branca e o rótulo "Você" em cima, para ficar claro que se trata
 * da posição do próprio tutor e não de um estabelecimento.
 */
export function PinTutor() {
  return (
    <View style={estilos.container} accessible accessibilityLabel="Sua localização">
      <View style={estilos.pin} />
      <Text style={estilos.rotulo} importantForAccessibility="no-hide-descendants">
        Você
      </Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { alignItems: 'center' },
  pin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primaryDeep,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 5,
  },
  rotulo: {
    marginTop: 4,
    ...typography.captionMedium,
    color: colors.primaryDeep,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
