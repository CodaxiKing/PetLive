import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { estaOffline, ouvirOffline } from '../lib/cacheOffline';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

/** Faixa "sem internet" enquanto a saúde do pet vem da cópia do aparelho. */
export function AvisoOffline() {
  const offline = useSyncExternalStore(ouvirOffline, estaOffline, () => false);
  if (!offline) return null;
  return (
    <View style={estilos.faixa} accessibilityRole="alert">
      <Text style={estilos.texto}>Sem internet: mostrando o que estava salvo no celular.</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: {
    backgroundColor: colors.warningSurface,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  texto: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.warningText },
});
