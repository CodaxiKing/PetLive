import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEstadoPlano } from '../src/lib/plano';
import { colors } from '../src/theme/colors';
import { fontFamily } from '../src/theme/typography';

export default function Premium() {
  const plano = useEstadoPlano();
  const insets = useSafeAreaInsets();
  return <ScrollView style={s.tela} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 20 }}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/perfil')}><Text style={s.link}>Voltar</Text></Pressable>
    <Text accessibilityRole="header" style={s.titulo}>Premium PetLive</Text>
    <View style={s.card}>
      {plano.carregando ? <ActivityIndicator accessibilityLabel="Consultando seu plano" /> : plano.erro ? <>
        <Text accessibilityRole="alert" style={s.texto}>Não foi possível consultar seu plano. Confira sua conexão e tente novamente.</Text>
        <Pressable accessibilityRole="button" onPress={plano.recarregar}><Text style={s.link}>Consultar novamente</Text></Pressable>
      </> : <><Text style={s.subtitulo}>{plano.plano === 'premium' ? 'Seu plano é Premium' : 'Seu plano é Grátis'}</Text><Text style={s.texto}>{plano.plano === 'premium' ? 'Os recursos Premium estão liberados para sua conta.' : 'Continue cuidando do seu pet com os recursos do plano grátis.'}</Text></>}
    </View>
    <Text style={s.subtitulo}>Cuidados do dia a dia</Text>
    <Text style={s.texto}>No plano grátis: cadastro de um pet, registros de saúde, lembretes e mapa de lugares. O QR básico da coleira também está disponível.</Text>
    <Text style={s.subtitulo}>Recursos Premium</Text>
    <Text style={s.texto}>Mais pets na mesma conta, carteirinha em PDF e histórico completo de despesas.</Text>
    <View style={s.card}><Text style={s.subtitulo}>Assinaturas em breve</Text><Text style={s.texto}>A compra e a restauração de assinaturas ainda não estão disponíveis nesta versão. Quando liberadas, serão feitas pela loja de apps do seu aparelho.</Text></View>
    <Text style={s.texto}>Esta tela não realiza cobranças nem altera sua assinatura.</Text>
  </ScrollView>;
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface }, titulo: { fontFamily: fontFamily.bold, color: colors.black, fontSize: 28 },
  subtitulo: { fontFamily: fontFamily.bold, color: colors.black, fontSize: 19 },
  texto: { fontFamily: fontFamily.regular, color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  card: { padding: 20, backgroundColor: colors.premiumSurface, borderRadius: 24, gap: 12 },
  link: { fontFamily: fontFamily.bold, color: colors.primaryDeep, fontSize: 16, paddingVertical: 12 },
});
