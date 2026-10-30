import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { CrownSimple } from 'phosphor-react-native/src/icons/CrownSimple';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { BotaoRedondo } from '../src/components/Layout';
import { useEstadoPlano } from '../src/lib/plano';
import { colors } from '../src/theme/colors';
import { shadow } from '../src/theme/tokens';
import { fontFamily } from '../src/theme/typography';

/** Premium na versão 2 do protótipo: cartão escuro com o plano atual e os recursos em cartões. */
export default function Premium() {
  const plano = useEstadoPlano();
  const insets = useSafeAreaInsets();
  const premium = plano.plano === 'premium';
  return <ScrollView style={s.tela} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
    <BotaoRedondo acessibilidade="Voltar" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/perfil')}>
      <ArrowLeft size={22} color={colors.black} />
    </BotaoRedondo>
    <View>
      <Text style={s.sobre}>Plano</Text>
      <Text accessibilityRole="header" style={s.titulo}>Premium PetLive</Text>
    </View>
    <View style={s.cartaoEscuro}>
      <View style={s.coroa}><CrownSimple size={22} color="#F2C14E" weight="fill" /></View>
      {plano.carregando ? <ActivityIndicator color={colors.white} accessibilityLabel="Consultando seu plano" /> : plano.erro ? <>
        <Text accessibilityRole="alert" style={s.textoClaro}>Não foi possível consultar seu plano. Confira sua conexão e tente novamente.</Text>
        <Pressable accessibilityRole="button" onPress={plano.recarregar}><Text style={s.linkClaro}>Consultar novamente</Text></Pressable>
      </> : <>
        <Text style={s.planoTitulo}>{premium ? 'Seu plano é Premium' : 'Seu plano é Grátis'}</Text>
        <Text style={s.textoClaro}>{premium ? 'Os recursos Premium estão liberados para sua conta.' : 'Continue cuidando do seu pet com os recursos do plano grátis.'}</Text>
      </>}
    </View>
    <View style={s.cartao}>
      <Text style={s.subtitulo}>Cuidados do dia a dia</Text>
      <Text style={s.texto}>No plano grátis: cadastro de um pet, registros de saúde, lembretes e mapa de lugares. O QR básico da coleira também está disponível.</Text>
    </View>
    <View style={s.cartao}>
      <Text style={s.subtitulo}>Recursos Premium</Text>
      <Text style={s.texto}>Mais pets na mesma conta, carteirinha em PDF e histórico completo de despesas.</Text>
    </View>
    <View style={[s.cartao, s.aviso]}>
      <Text style={s.subtitulo}>Assinaturas em breve</Text>
      <Text style={[s.texto, { color: colors.warningText }]}>A compra e a restauração de assinaturas ainda não estão disponíveis nesta versão. Quando liberadas, serão feitas pela loja de apps do seu aparelho.</Text>
    </View>
    <Text style={s.nota}>Esta tela não realiza cobranças nem altera sua assinatura.</Text>
    <BotaoPrimario titulo="Minha assinatura" onPress={() => router.push('/premium/assinatura')} />
  </ScrollView>;
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  sobre: { fontFamily: fontFamily.semiBold, color: colors.textMuted, fontSize: 13, marginTop: 4 },
  titulo: { fontFamily: fontFamily.bold, color: colors.black, fontSize: 32, lineHeight: 38, letterSpacing: -1.1 },
  cartaoEscuro: { padding: 20, backgroundColor: colors.black, borderRadius: 24, gap: 8 },
  coroa: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  planoTitulo: { fontFamily: fontFamily.bold, color: colors.white, fontSize: 22, letterSpacing: -0.4 },
  textoClaro: { fontFamily: fontFamily.regular, color: '#C9D0DB', fontSize: 15, lineHeight: 22 },
  linkClaro: { fontFamily: fontFamily.bold, color: colors.primary, fontSize: 15, paddingVertical: 8 },
  cartao: { padding: 18, backgroundColor: colors.surface, borderRadius: 24, gap: 6, ...shadow.card },
  aviso: { backgroundColor: colors.warningSurface, shadowOpacity: 0, elevation: 0 },
  subtitulo: { fontFamily: fontFamily.bold, color: colors.black, fontSize: 17 },
  texto: { fontFamily: fontFamily.regular, color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  nota: { fontFamily: fontFamily.regular, color: colors.textMuted, fontSize: 12, lineHeight: 18, marginHorizontal: 4 },
});
