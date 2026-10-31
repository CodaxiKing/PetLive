import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { CrownSimple } from 'phosphor-react-native/src/icons/CrownSimple';
import { useAuth } from '../src/auth/AuthProvider';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { BotaoRedondo } from '../src/components/Layout';
import { textoDeErro } from '../src/lib/erros';
import { useEstadoPlano } from '../src/lib/plano';
import { comprarNaLoja, lojaDisponivel, NOME_LOJA, ofertaDaLoja, restaurarNaLoja, type OfertaLoja } from '../src/premium/loja';
import { planosPremium, precoTexto, type PlanoPremium } from '../src/premium/oferta';
import { colors } from '../src/theme/colors';
import { shadow } from '../src/theme/tokens';
import { fontFamily } from '../src/theme/typography';

const RECURSOS = [
  'Vários pets na mesma conta',
  'Guarda compartilhada com a família (até 4 pessoas por pet)',
  'Ler o cartão de vacina por foto',
  'Carteirinha em PDF e anexos de exames',
  'Histórico completo de passeios e despesas',
  'Todos os temas do cartão do pet',
];

/**
 * Premium (versão 2 do protótipo): plano atual, o que vem no Premium e a
 * assinatura pela loja de apps, com o teste grátis da loja. A compra é só pela
 * Google Play ou App Store; cancelar também é lá, a qualquer momento.
 */
export default function Premium() {
  const { user } = useAuth();
  const plano = useEstadoPlano();
  const insets = useSafeAreaInsets();
  const premium = plano.plano === 'premium';
  const [painel, setPainel] = useState<PlanoPremium | null>(null);
  const [loja, setLoja] = useState<OfertaLoja | null>(null);
  const [comprando, setComprando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const disponivel = lojaDisponivel();

  useFocusEffect(
    useCallback(() => {
      planosPremium().then((l) => setPainel(l.find((p) => p.ciclo === 'mensal') ?? null), () => setPainel(null));
      if (user && lojaDisponivel()) ofertaDaLoja(user.id).then(setLoja, () => setLoja(null));
    }, [user]),
  );

  const preco = loja?.preco ?? (painel ? precoTexto(painel.preco_centavos) : null);
  const dias = painel?.dias_teste ?? 7;
  const temTeste = loja ? loja.temTeste : Boolean(painel?.dias_teste);

  // O webhook da loja libera o Premium no servidor em segundos: confere de novo depois.
  function aguardarServidor() {
    plano.recarregar();
    setTimeout(plano.recarregar, 4000);
  }

  async function assinar() {
    if (!user || !loja) return;
    setComprando(true);
    try {
      const r = await comprarNaLoja(user.id, loja);
      if (r === 'cancelado') return;
      aguardarServidor();
      Alert.alert(
        r === 'premium' ? 'Premium liberado' : 'Compra em análise',
        r === 'premium'
          ? temTeste ? `Seus ${dias} dias grátis começaram. Cancele quando quiser na ${NOME_LOJA}.` : 'Obrigado por assinar o PetLive Premium.'
          : `A ${NOME_LOJA} ainda está confirmando o pagamento. O Premium libera sozinho assim que ela aprovar.`,
      );
    } catch (e) {
      Alert.alert('Não deu para assinar', textoDeErro(e));
    } finally {
      setComprando(false);
    }
  }

  async function restaurar() {
    if (!user) return;
    setRestaurando(true);
    try {
      const ok = await restaurarNaLoja(user.id);
      if (ok) aguardarServidor();
      Alert.alert(ok ? 'Assinatura restaurada' : 'Nenhuma assinatura encontrada', ok ? 'O Premium volta a valer nesta conta.' : `Não achamos assinatura ativa na sua conta da ${NOME_LOJA}.`);
    } catch (e) {
      Alert.alert('Não deu para restaurar', textoDeErro(e));
    } finally {
      setRestaurando(false);
    }
  }

  return <ScrollView style={s.tela} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 14 }}>
    <View style={s.linhaTopo}>
      <BotaoRedondo acessibilidade="Voltar" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/perfil')}>
        <ArrowLeft size={22} color={colors.black} />
      </BotaoRedondo>
      <Text accessibilityRole="header" style={s.tituloTopo}>Premium PetLive</Text>
    </View>
    <View style={s.cartaoEscuro}>
      <View style={s.coroa}><CrownSimple size={22} color="#F2C14E" weight="fill" /></View>
      {plano.carregando ? <ActivityIndicator color={colors.white} accessibilityLabel="Consultando seu plano" /> : plano.erro ? <>
        <Text accessibilityRole="alert" style={s.textoClaro}>Não foi possível consultar seu plano. Confira sua conexão e tente novamente.</Text>
        <Pressable accessibilityRole="button" onPress={plano.recarregar}><Text style={s.linkClaro}>Consultar novamente</Text></Pressable>
      </> : premium ? <>
        <Text style={s.planoTitulo}>Seu plano é Premium</Text>
        <Text style={s.textoClaro}>Os recursos Premium estão liberados. O período e a renovação ficam em Minha assinatura.</Text>
      </> : <>
        {preco ? <Text style={s.preco}>{preco}<Text style={s.precoMes}>/mês</Text></Text> : <Text style={s.planoTitulo}>Premium</Text>}
        <Text style={s.textoClaro}>
          {temTeste ? `${dias} dias grátis para testar. Cancele quando quiser.` : 'Cancele quando quiser.'}
        </Text>
      </>}
    </View>

    <View style={s.cartao}>
      <Text style={s.subtitulo}>O que vem no Premium</Text>
      {RECURSOS.map((r) => (
        <View key={r} style={s.recurso}>
          <View style={s.check}><Check size={14} color={colors.successText} weight="bold" /></View>
          <Text style={s.recursoTexto}>{r}</Text>
        </View>
      ))}
    </View>
    <View style={s.cartao}>
      <Text style={s.subtitulo}>Continua grátis, sempre</Text>
      <Text style={s.texto}>Vacinas, remédios, lembretes, SOS, primeiros socorros, mapa e o QR básico da coleira. O que protege o pet nunca fica atrás de assinatura.</Text>
    </View>

    {!premium && !plano.carregando ? (disponivel && loja ? <>
      <BotaoPrimario titulo={temTeste ? `Começar ${dias} dias grátis` : `Assinar por ${loja.preco}/mês`} carregando={comprando} onPress={assinar} />
      <Text style={s.nota}>
        {temTeste
          ? `Depois do teste, ${loja.preco} por mês na sua conta da ${NOME_LOJA}. Cancele a qualquer momento nas assinaturas da ${NOME_LOJA}, sem custo no teste.`
          : `Cobrado na sua conta da ${NOME_LOJA} todo mês. Cancele a qualquer momento nas assinaturas da ${NOME_LOJA}.`}
      </Text>
    </> : disponivel ? (
      <ActivityIndicator color={colors.primaryDeep} accessibilityLabel="Consultando a loja" />
    ) : (
      <View style={[s.cartao, s.aviso]}>
        <Text style={s.subtitulo}>Assinatura pela loja</Text>
        <Text style={[s.texto, { color: colors.warningText }]}>A assinatura é feita pela {NOME_LOJA} e chega com a próxima versão do app. Atualize o PetLive na loja para assinar.</Text>
      </View>
    )) : null}
    {disponivel ? (
      <Pressable accessibilityRole="button" onPress={restaurar} disabled={restaurando} style={s.restaurar} hitSlop={8}>
        <Text style={s.restaurarTexto}>{restaurando ? 'Restaurando…' : 'Já assinei: restaurar compra'}</Text>
      </Pressable>
    ) : null}
    <BotaoPrimario titulo="Minha assinatura" claro onPress={() => router.push('/premium/assinatura')} />
  </ScrollView>;
}
const s = StyleSheet.create({
  // Versão 2: voltar e título na mesma linha.
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tituloTopo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.8, color: colors.black },
  tela: { flex: 1, backgroundColor: colors.background },
  cartaoEscuro: { padding: 20, backgroundColor: colors.black, borderRadius: 24, gap: 8 },
  coroa: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  planoTitulo: { fontFamily: fontFamily.bold, color: colors.white, fontSize: 22, letterSpacing: -0.4 },
  preco: { fontFamily: fontFamily.bold, color: colors.white, fontSize: 36, letterSpacing: -1.2 },
  precoMes: { fontFamily: fontFamily.semiBold, fontSize: 16, letterSpacing: 0, color: '#C9D0DB' },
  textoClaro: { fontFamily: fontFamily.regular, color: '#C9D0DB', fontSize: 15, lineHeight: 22 },
  linkClaro: { fontFamily: fontFamily.bold, color: colors.primary, fontSize: 15, paddingVertical: 8 },
  cartao: { padding: 18, backgroundColor: colors.surface, borderRadius: 24, gap: 10, ...shadow.card },
  aviso: { backgroundColor: colors.warningSurface, shadowOpacity: 0, elevation: 0 },
  subtitulo: { fontFamily: fontFamily.bold, color: colors.black, fontSize: 17 },
  recurso: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center' },
  recursoTexto: { flex: 1, fontFamily: fontFamily.medium, color: colors.text, fontSize: 15, lineHeight: 21 },
  texto: { fontFamily: fontFamily.regular, color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  nota: { fontFamily: fontFamily.regular, color: colors.textMuted, fontSize: 12, lineHeight: 18, marginHorizontal: 4, textAlign: 'center' },
  restaurar: { alignSelf: 'center', paddingVertical: 4 },
  restaurarTexto: { fontFamily: fontFamily.bold, color: colors.primaryDeep, fontSize: 14, textDecorationLine: 'underline' },
});
