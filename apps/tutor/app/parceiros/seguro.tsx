import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Tocavel } from '../../src/components/Animacoes';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { mensagemDeErro } from '../../src/lib/cacheOffline';
import { carregarParceiros, cotar, type Parceiro } from '../../src/parceiros/parceiros';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

/** Plano e seguro pet (protótipo Seguro, tela 61; BUSINESS.md 5.30). */
export default function Seguro() {
  const [parceiros, setParceiros] = useState<Parceiro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      carregarParceiros().then(setParceiros, (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))));
    }, []),
  );

  async function abrir(p: Parceiro) {
    setAbrindo(p.id);
    try {
      await Linking.openURL(await cotar(p));
    } catch (e) {
      Alert.alert('Não deu para abrir', mensagemDeErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setAbrindo(null);
    }
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Parceiros" titulo="Plano e seguro pet" altura={180} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {!parceiros ? (
          erro ? <Text style={estilos.vazio}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
        ) : parceiros.length === 0 ? (
          <Text style={estilos.vazio}>Ainda não há parceiros por aqui. Assim que tivermos, eles aparecem nesta tela.</Text>
        ) : (
          parceiros.map((p) => (
            <View key={p.id} style={estilos.cartao}>
              <View style={estilos.topo}>
                <View style={estilos.icone}>
                  <Icone nome={p.tipo === 'seguro' ? 'escudo' : 'coracao'} size={20} cor={colors.primaryDeep} espessura={2} />
                </View>
                <View style={estilos.flex}>
                  <Text style={estilos.nome}>{p.nome}</Text>
                  <Text style={estilos.tipo}>{p.tipo === 'seguro' ? 'Seguro' : 'Plano de saúde'} · parceiro</Text>
                </View>
              </View>
              <Text style={estilos.beneficios}>{p.beneficios}</Text>
              <View style={estilos.rodapeCartao}>
                <Text style={estilos.preco}>{p.preco_texto ?? 'Preço no site do parceiro'}</Text>
                <Tocavel accessibilityRole="link" accessibilityLabel={`Cotar com ${p.nome}`} disabled={abrindo === p.id} onPress={() => abrir(p)} style={estilos.cotar}>
                  {abrindo === p.id ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={estilos.cotarTexto}>Cotar</Text>}
                </Tocavel>
              </View>
            </View>
          ))
        )}
        <Text style={estilos.nota}>A contratação é feita pelo parceiro. O PetLive não vende, não garante nem corrige o plano.</Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  carregando: { marginTop: 24 },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, backgroundColor: colors.background, borderRadius: 22, padding: 16 },
  cartao: { backgroundColor: colors.background, borderRadius: 24, padding: 16, gap: 10 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  nome: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  tipo: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  beneficios: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.black },
  rodapeCartao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  preco: { flex: 1, fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.primaryDeep },
  cotar: { height: 40, minWidth: 92, paddingHorizontal: 18, borderRadius: 20, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  cotarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.white },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 4, marginTop: 4 },
});
