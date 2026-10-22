import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/auth/AuthProvider'
import { CabecalhoTela } from '../../src/components/CabecalhoTela'
import { recarregarPlano } from '../../src/lib/plano'
import { supabase } from '../../src/lib/supabase'
import { abrirAssinaturasDaLoja } from '../../src/premium/loja'
import { NOME_LOJA, dataCurta, situacao, type Assinatura } from '../../src/premium/planos'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

type Dados = { plano: 'gratis' | 'premium'; assinatura: Assinatura | null }

/**
 * Minha assinatura (tela 100, BUSINESS.md 5.13): plano, renovação e origem.
 * Cancelar e mudar de plano acontecem na tela de assinaturas da própria loja.
 */
export default function MinhaAssinatura() {
  const { user } = useAuth()
  const [dados, setDados] = useState<Dados | null>(null)

  // Recarrega ao voltar da loja (o aviso de cancelamento chega pelo servidor).
  useFocusEffect(
    useCallback(() => {
      if (!user) return
      void recarregarPlano(user.id)
      supabase.rpc('minha_assinatura').then(({ data }) => setDados((data as Dados | null) ?? { plano: 'gratis', assinatura: null }))
    }, [user]),
  )

  if (!dados) {
    return (
      <View style={estilos.tela}>
        <CabecalhoTela titulo="Minha assinatura" />
        <ActivityIndicator color={colors.premiumText} style={estilos.carregando} />
      </View>
    )
  }

  const a = dados.assinatura
  const lojaDoAparelho = Platform.OS === 'ios' ? 'app_store' : 'google_play'
  const outraLoja = a && a.loja !== lojaDoAparelho

  async function abrirLoja() {
    if (outraLoja && a) {
      Alert.alert('Assinatura da ' + NOME_LOJA[a.loja], `Você assinou pela ${NOME_LOJA[a.loja]}. Gerencie a assinatura no aparelho em que assinou.`)
      return
    }
    try {
      await abrirAssinaturasDaLoja(a?.produto)
    } catch {
      Alert.alert('Não foi possível abrir a loja', 'Abra as assinaturas pela própria loja de apps do aparelho.')
    }
  }

  return (
    <View style={estilos.tela}>
      <CabecalhoTela titulo="Minha assinatura" />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={estilos.cartao}>
          <Text style={estilos.selo}>{dados.plano === 'premium' ? 'Premium' : 'Plano Grátis'}</Text>
          {a ? (
            <>
              <Text style={estilos.titulo}>Premium {a.periodo === 'anual' ? 'Anual' : 'Mensal'}</Text>
              <Text style={estilos.texto}>{situacao(a)}</Text>
              <Text style={estilos.apoio}>Pagamento pela {NOME_LOJA[a.loja]}</Text>
            </>
          ) : dados.plano === 'premium' ? (
            <Text style={estilos.texto}>Premium concedido pelo PetLive, sem cobrança.</Text>
          ) : (
            <Text style={estilos.texto}>Você não tem uma assinatura ativa.</Text>
          )}
        </View>

        {a?.vale ? (
          <>
            <Pressable accessibilityRole="button" onPress={abrirLoja} style={estilos.linha}>
              <Text style={estilos.linhaTexto}>Mudar plano</Text>
            </Pressable>
            {a.status === 'pagamento_falhou' ? (
              <Pressable accessibilityRole="button" onPress={abrirLoja} style={estilos.linha}>
                <Text style={estilos.linhaTexto}>Atualizar pagamento</Text>
              </Pressable>
            ) : null}
            {a.status !== 'cancelando' ? (
              <Pressable accessibilityRole="button" onPress={abrirLoja} style={estilos.linha}>
                <Text style={[estilos.linhaTexto, estilos.perigo]}>Cancelar</Text>
              </Pressable>
            ) : null}
            <Text style={estilos.nota}>
              Ao cancelar, o Premium vale até {a.renews_at ? dataCurta(a.renews_at) : 'o fim do período pago'}. Depois a conta
              volta ao Grátis: os pets além do primeiro ficam só para consulta, sem nada ser apagado.
            </Text>
          </>
        ) : dados.plano !== 'premium' ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace('/premium')} style={estilos.linha}>
            <Text style={estilos.linhaTexto}>Conhecer o Premium</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  carregando: { marginTop: 40 },
  conteudo: { padding: 20, gap: 12 },
  cartao: { backgroundColor: colors.premiumSurface, borderRadius: 24, padding: 20, gap: 6 },
  selo: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.premiumText, textTransform: 'uppercase' },
  titulo: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.black },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  apoio: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.premiumText },
  linha: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 18, height: 56, justifyContent: 'center' },
  linhaTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  perigo: { color: colors.danger },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4 },
})
