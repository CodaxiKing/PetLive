import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Deslizar } from '../components/Animacoes';
import { Icone, type NomeIcone } from '../components/Icone';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { shadow } from '../theme/tokens';

/**
 * Cartão dos estados do mapa (protótipos MapaSemPermissao, MapaSemInternet
 * e MapaSemResultados): ícone, título, linha de apoio, explicação e ações.
 */
export function CartaoEstadoMapa({
  icone,
  fundoIcone,
  titulo,
  sub,
  texto,
  children,
  topoMinimo = 200,
}: {
  icone: NomeIcone;
  fundoIcone: string;
  titulo: string;
  sub: string;
  texto: string;
  children: ReactNode;
  topoMinimo?: number;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 20) + 64 + 12;
  return (
    <Deslizar style={[estilos.cartao, { bottom, maxHeight: Math.max(80, height - bottom - topoMinimo) }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      <View style={estilos.topo}>
        <View style={[estilos.icone, { backgroundColor: fundoIcone }]}>
          <Icone nome={icone} size={22} espessura={2} />
        </View>
        <View style={estilos.flex}>
          <Text style={estilos.titulo} accessibilityRole="header">
            {titulo}
          </Text>
          <Text style={estilos.sub}>{sub}</Text>
        </View>
      </View>
      <Text style={estilos.texto}>{texto}</Text>
      {children}
      </ScrollView>
    </Deslizar>
  );
}

/** Ação do cartão: preta (principal), contornada (secundária) ou link. */
export function AcaoEstado({
  rotulo,
  onPress,
  tipo = 'principal',
  cor,
}: {
  rotulo: string;
  onPress: () => void;
  tipo?: 'principal' | 'secundaria' | 'link';
  cor?: string;
}) {
  return (
    <Pressable
      accessibilityRole={tipo === 'link' ? 'link' : 'button'}
      onPress={onPress}
      hitSlop={tipo === 'link' ? 8 : 0}
      style={({ pressed }) => [
        tipo === 'principal' && estilos.principal,
        tipo === 'secundaria' && estilos.secundaria,
        tipo === 'link' && estilos.link,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          estilos.acaoTexto,
          tipo === 'principal' && { color: colors.white },
          tipo === 'link' && { color: cor ?? colors.primaryDeep, fontSize: 14, fontFamily: fontFamily.semiBold },
        ]}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 100,
    backgroundColor: colors.white,
    borderRadius: 32,
    padding: 20,
    gap: 12,
    ...shadow.card,
  },
  flex: { flex: 1, minWidth: 0 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fontFamily.bold, fontSize: 20, letterSpacing: -0.3, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  principal: { height: 52, borderRadius: 26, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  secundaria: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: { alignSelf: 'center', paddingVertical: 4 },
  acaoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
});
