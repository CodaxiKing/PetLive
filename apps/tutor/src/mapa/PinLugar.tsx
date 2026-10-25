import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { IlustracaoLugar } from './IlustracaoLugar';
import type { CategoriaLugar } from './lugares';
import { CoroaDestaque } from './CoroaDestaque';

type Props = {
  categoria: CategoriaLugar;
  /** Pin maior com anel azul quando é o lugar selecionado (protótipo Mapa). */
  selecionado?: boolean;
  destaquePago?: boolean;
  animarCoroa?: boolean;
};

/**
 * Pin do mapa (protótipo Mapa): círculo branco com sombra, a ilustração do
 * lugar dentro e a pontinha embaixo, que marca o ponto (âncora "bottom").
 */
export function PinLugar({ categoria, selecionado = false, destaquePago = false, animarCoroa = false }: Props) {
  const tamanho = selecionado ? 64 : 49;
  const borda = selecionado ? 5 : 3.5;
  const miolo = tamanho - borda * 2;
  return (
    <View style={estilos.pin}>
      {destaquePago ? <CoroaDestaque animar={animarCoroa} /> : null}
      <View
        style={[
          estilos.circulo,
          {
            width: tamanho,
            height: tamanho,
            borderRadius: tamanho / 2,
            padding: borda,
            backgroundColor: selecionado ? colors.primary : colors.white,
          },
        ]}
      >
        <View style={{ width: miolo, height: miolo, borderRadius: miolo / 2, overflow: 'hidden' }}>
          <IlustracaoLugar categoria={categoria} tamanho={miolo} />
        </View>
      </View>
      <View style={[estilos.ponta, { borderTopColor: selecionado ? colors.primary : colors.white }]} />
    </View>
  );
}

const estilos = StyleSheet.create({
  pin: { alignItems: 'center' },
  circulo: {
    shadowColor: '#111111',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  ponta: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
