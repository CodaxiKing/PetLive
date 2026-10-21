import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { enderecoDaFoto, type FotoLugar } from './lugares';

/**
 * Fotos do Google na ficha do lugar (BUSINESS.md 5.15 e protótipo Lugar):
 * até 5, em carrossel, cada uma buscada só quando aparece, com o selo
 * "Fotos do Google · 1 de N" e o autor, como o Google exige.
 */
export function GaleriaFotos({ fotos, altura }: { fotos: FotoLugar[]; altura: number }) {
  const { width } = useWindowDimensions();
  const [atual, setAtual] = useState(0);
  const [enderecos, setEnderecos] = useState<Record<number, string>>({});
  const pedidas = useRef(new Set<number>());

  // A visível e a próxima: o resto só quando o tutor deslizar.
  useEffect(() => {
    for (const i of [atual, atual + 1]) {
      const foto = fotos[i];
      if (!foto || pedidas.current.has(i)) continue;
      pedidas.current.add(i);
      enderecoDaFoto(foto.nome, Math.round(width * 2)).then(
        (uri) => setEnderecos((e) => ({ ...e, [i]: uri })),
        () => undefined,
      );
    }
  }, [atual, fotos, width]);

  function aoRolar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setAtual(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  const autor = fotos[atual]?.autores[0];

  return (
    <View style={{ height: altura }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={aoRolar}>
        {fotos.map((foto, i) => (
          <View key={foto.nome} style={[estilos.quadro, { width, height: altura }]}>
            {enderecos[i] ? (
              <Image
                source={{ uri: enderecos[i] }}
                style={{ width, height: altura }}
                resizeMode="cover"
                accessibilityLabel={`Foto ${i + 1} de ${fotos.length}`}
              />
            ) : (
              <ActivityIndicator color={colors.white} />
            )}
          </View>
        ))}
      </ScrollView>

      <View style={estilos.rodape} pointerEvents="box-none">
        <Text style={estilos.selo}>
          Fotos do Google · {atual + 1} de {fotos.length}
        </Text>
        {autor?.nome ? (
          <Text
            style={estilos.autor}
            onPress={autor.uri ? () => Linking.openURL(autor.uri as string).catch(() => undefined) : undefined}
            accessibilityRole={autor.uri ? 'link' : undefined}
          >
            Foto: {autor.nome}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  quadro: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  rodape: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selo: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: colors.white,
    backgroundColor: 'rgba(17,17,17,0.72)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  autor: {
    flexShrink: 1,
    fontSize: 11,
    fontFamily: fontFamily.medium,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
