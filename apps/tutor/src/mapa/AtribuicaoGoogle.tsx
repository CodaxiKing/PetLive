import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

/**
 * Atribuição exigida pelo Google quando dados do Places aparecem sem o mapa
 * do Google (políticas do Places API): o texto "Google Maps", sem tradução,
 * numa linha, fonte do sistema (Roboto no Android) peso 400, 12 a 16 sp, em
 * #5E5E5E ou #1F1F1F (ou branco sobre foto).
 */
export function AtribuicaoGoogle({ sobreFoto = false, style }: { sobreFoto?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Text
      style={[estilos.texto, sobreFoto && estilos.sobreFoto, style]}
      numberOfLines={1}
      allowFontScaling={false}
      accessibilityLabel="Dados do Google Maps"
    >
      Google Maps
    </Text>
  );
}

const estilos = StyleSheet.create({
  // Sem fontFamily: usa a fonte do sistema, como pede o Google.
  texto: { fontSize: 12, fontWeight: '400', color: '#5E5E5E' },
  sobreFoto: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
