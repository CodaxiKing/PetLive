import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { GlifoLugar } from './GlifoLugar';
import { COR_CATEGORIA, type CategoriaLugar } from './lugares';

type Props = {
  categoria: CategoriaLugar;
  /** Pin maior e azul quando é o lugar selecionado (protótipo Mapa). */
  selecionado?: boolean;
};

/**
 * Pin do mapa: círculo com borda branca e o glifo da categoria —
 * clínica azul, banho e tosa verde, petshop roxo; selecionado vira azul marca.
 */
export function PinLugar({ categoria, selecionado = false }: Props) {
  const tamanho = selecionado ? 46 : 34;
  return (
    <View
      style={[
        estilos.pin,
        {
          width: tamanho,
          height: tamanho,
          borderRadius: tamanho / 2,
          backgroundColor: selecionado ? colors.primary : COR_CATEGORIA[categoria],
        },
      ]}
    >
      <GlifoLugar categoria={categoria} tamanho={selecionado ? 21 : 17} />
    </View>
  );
}

const estilos = StyleSheet.create({
  pin: {
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A211C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
});
