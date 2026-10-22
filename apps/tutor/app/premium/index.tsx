import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '../../src/auth/AuthProvider'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone } from '../../src/components/Icone'
import { supabase } from '../../src/lib/supabase'
import { usePlano } from '../../src/lib/plano'
import { usePets } from '../../src/pets/PetsProvider'
import { buscarPlanos, comprar, restaurar } from '../../src/premium/loja'
import {
  BENEFICIOS,
  TEXTO_MOTIVO,
  dataCurta,
  economiaAnual,
  ehMotivo,
  mostraTeste,
  primeiraCobranca,
  type Periodo,
  type PlanoLoja,
} from '../../src/premium/planos'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://petlive.app.br').replace(/\/$/, '')
const LOJA = Platform.OS === 'ios' ? 'App Store' : 'Google Play'

/**
 * Tela Premium (BUSINESS.md 5.13 e 10; protótipo Premium). Abre pelo Perfil
 * e pelos convites dos recursos bloqueados. Os preços vêm da loja de apps e a
 * compra acontece na folha nativa; o Premium só é liberado depois que o
 * servidor confirma a compra com a loja.
 */
export default function TelaPremium() {
  const { motivo, pet: petId } = useLocalSearchParams<{ motivo?: string; pet?: string }>()
  const { user } = useAuth()
  const plano = usePlano()
  const { pets, recarregar } = usePets()
  const pet = pets.find((p) => p.id === petId) ?? null

  const [planos, setPlanos] = useState<PlanoLoja[] | null>(null)
  const [erroLoja, setErroLoja] = useState(false)
  const [escolhido, setEscolhido] = useState<Periodo>('anual')
  const [jaAssinou, setJaAssinou] = useState<boolean | null>(null)
  const [comprando, setComprando] = useState(false)
  const [restaurando, setRestaurando] = useState(false)

  // Quem já é assinante vai para Minha assinatura (não assina de novo).
  useEffect(() => {
    if (plano === 'premium') router.replace('/premium/assinatura')
  }, [plano])

  const [tentativa, setTentativa] = useState(0)

  // Preços sempre da loja; sem resposta, a tela mostra o erro e o "Tentar de novo".
  useEffect(() => {
    if (!user) return
    let vivo = true
    buscarPlanos(user.id).then(
      (p) => vivo && setPlanos(p),
      () => vivo && setErroLoja(true),
    )
    supabase.rpc('minha_assinatura').then(({ data }) => vivo && setJaAssinou(Boolean(data?.ja_assinou)))
    return () => {
      vivo = false
    }
  }, [user, tentativa])

  const tentarDeNovo = useCallback(() => {
    setErroLoja(false)
    setPlanos(null)
    setTentativa((t) => t + 1)
  }, [])

  const atual = planos?.find((p) => p.periodo === escolhido) ?? planos?.[0] ?? null
  // Sem saber se já assinou, não promete o teste.
  const teste = jaAssinou === false && mostraTeste(atual, false)
  const economia = economiaAnual(planos?.find((p) => p.periodo === 'mensal'), planos?.find((p) => p.periodo === 'anual'))

  const textoMotivo = ehMotivo(motivo) ? TEXTO_MOTIVO[motivo] : null
  const titulo =
    motivo === 'somente_leitura' && pet ? `${pet.nome} está só para consulta` : (textoMotivo?.titulo ?? 'PetLive Premium')

  async function assinar() {
    if (!user || !atual || comprando) return
    setComprando(true)
    const r = await comprar(atual, user.id, teste)
    setComprando(false)
    if (r.tipo === 'ok') {
      // Pets só para consulta voltam a ser editáveis na hora.
      await recarregar()
      if (r.plano === 'premium') {
        Alert.alert('Bem-vindo ao Premium', 'Sua assinatura está ativa. Aproveite!')
        router.replace('/premium/assinatura')
      } else {
        Alert.alert('Compra recebida', 'A loja ainda está processando a assinatura. Ela aparece aqui assim que for confirmada.')
      }
    } else if (r.tipo === 'pendente') {
      Alert.alert('Compra aguardando aprovação', 'O Premium é liberado assim que a loja aprovar o pagamento.')
    } else if (r.tipo === 'erro') {
      Alert.alert('Não foi possível assinar', r.mensagem)
    }
    // Desistiu na folha da loja: volta para a tela, sem mensagem.
  }

  async function restaurarCompras() {
    if (!user || restaurando) return
    setRestaurando(true)
    try {
      const r = await restaurar(user.id)
      if (r === 'premium') {
        await recarregar()
        Alert.alert('Assinatura restaurada', 'Seu Premium está ativo de novo neste aparelho.')
      } else {
        Alert.alert('Nenhuma assinatura ativa', `Não encontramos uma assinatura ativa do PetLive nesta conta da ${LOJA}.`)
      }
    } catch (e) {
      Alert.alert('Não foi possível restaurar', e instanceof Error ? e.message : 'Tente de novo em instantes.')
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda fundo={colors.premiumSurface} subtitulo="Plano Grátis" titulo={titulo} altura={190} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {textoMotivo ? <Text style={estilos.intro}>{textoMotivo.texto}</Text> : null}

        <Text style={estilos.secao}>No Premium</Text>
        {BENEFICIOS.map((t) => (
          <View key={t} style={estilos.item}>
            <View style={estilos.check}>
              <Icone nome="check" size={16} cor={colors.primary} espessura={2.4} />
            </View>
            <Text style={estilos.itemTexto}>{t}</Text>
          </View>
        ))}
        <Text style={estilos.nota}>Saúde, lembretes, mapa, SOS e tudo que protege o pet continuam grátis.</Text>

        <Text style={estilos.secao}>Escolha o plano</Text>
        {erroLoja ? (
          <View style={estilos.erro}>
            <Text style={estilos.erroTexto}>Não conseguimos carregar os preços da {LOJA}. Confira a internet e tente de novo.</Text>
            <Pressable accessibilityRole="button" onPress={tentarDeNovo} style={estilos.tentar}>
              <Text style={estilos.tentarTexto}>Tentar de novo</Text>
            </Pressable>
          </View>
        ) : !planos ? (
          <ActivityIndicator color={colors.premiumText} style={estilos.carregando} />
        ) : (
          planos.map((p) => {
            const ativo = p.periodo === atual?.periodo
            return (
              <Pressable
                key={p.periodo}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativo }}
                onPress={() => setEscolhido(p.periodo)}
                style={[estilos.plano, ativo && estilos.planoAtivo]}
              >
                <View style={[estilos.radio, ativo && estilos.radioAtivo]} />
                <View style={estilos.flex}>
                  <Text style={estilos.planoNome}>{p.periodo === 'anual' ? 'Anual' : 'Mensal'}</Text>
                  {p.periodo === 'anual' && economia ? <Text style={estilos.planoApoio}>Economize {economia}%</Text> : null}
                </View>
                <Text style={estilos.planoPreco}>
                  {p.preco}
                  <Text style={estilos.planoApoio}>{p.periodo === 'anual' ? '/ano' : '/mês'}</Text>
                </Text>
              </Pressable>
            )
          })
        )}
        {teste && atual ? (
          <View style={estilos.teste}>
            <Text style={estilos.testeTitulo}>{atual.diasTeste} dias grátis</Text>
            <Text style={estilos.testeTexto}>
              Primeira cobrança de {atual.preco} em {dataCurta(primeiraCobranca(atual.diasTeste))}. Cancele antes e não paga nada.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={teste && atual ? `Começar ${atual.diasTeste} dias grátis` : 'Assinar o Premium'}
          onPress={assinar}
          carregando={comprando}
          desabilitado={!atual || erroLoja || restaurando}
        />
        <Text style={estilos.legal}>
          A assinatura renova automaticamente pelo mesmo período e preço, cobrada na sua conta da {LOJA}, até você
          cancelar. Cancele quando quiser, até 24 horas antes da renovação, nas assinaturas da {LOJA}.{' '}
          <Text style={estilos.link} onPress={() => WebBrowser.openBrowserAsync(`${SITE}/termos`)}>
            Termos de uso
          </Text>{' '}
          e{' '}
          <Text style={estilos.link} onPress={() => WebBrowser.openBrowserAsync(`${SITE}/privacidade`)}>
            Política de Privacidade
          </Text>
          .
        </Text>
        <View style={estilos.linhaAcoes}>
          <Pressable accessibilityRole="button" onPress={restaurarCompras} disabled={restaurando} hitSlop={8}>
            <Text style={estilos.acaoTexto}>{restaurando ? 'Restaurando…' : 'Restaurar compras'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Text style={estilos.acaoTexto}>Agora não</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  intro: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, color: colors.textMuted },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  check: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.black },
  nota: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.premiumText, marginTop: 2 },
  carregando: { marginVertical: 20 },
  erro: { backgroundColor: colors.dangerSurface, borderRadius: 18, padding: 16, gap: 12 },
  erroTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
  tentar: { alignSelf: 'flex-start', paddingHorizontal: 18, height: 40, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center' },
  tentarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  plano: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.border, borderRadius: 20, padding: 16 },
  planoAtivo: { borderColor: colors.premiumText, backgroundColor: colors.premiumSurface },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.borderStrong },
  radioAtivo: { borderWidth: 6, borderColor: colors.premiumText },
  planoNome: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  planoPreco: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  planoApoio: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.premiumText },
  teste: { backgroundColor: colors.successSurface, borderRadius: 18, padding: 16, gap: 4 },
  testeTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.successText },
  testeTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.successText },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 10 },
  legal: { fontFamily: fontFamily.regular, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
  link: { fontFamily: fontFamily.bold, color: colors.primaryDeep, textDecorationLine: 'underline' },
  linhaAcoes: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  acaoTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
})
