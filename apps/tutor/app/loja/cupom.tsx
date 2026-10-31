import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle'
import { Ticket } from 'phosphor-react-native/src/icons/Ticket'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { useCarrinho } from '../../src/loja/loja'
import { aplicarCupom, cuponsParaMim, escolherCupom, textoCupom, useCupom, type Cupom } from '../../src/pagamentos/pagamentos'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'
import { textoDeErro } from '../../src/lib/erros'

const ate = (iso: string | null) => (iso ? ` · até ${new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : '')

/** Cupom de desconto (protótipo Cupom): digitar o código ou usar um dos cupons do tutor. */
export default function TelaCupom() {
  const { subtotal: subtotalParam } = useLocalSearchParams<{ subtotal: string }>()
  const subtotal = Number(subtotalParam) || 0
  const { lojaId } = useCarrinho()
  const aplicado = useCupom(lojaId)
  const [codigo, setCodigo] = useState(aplicado?.code ?? '')
  const [disponiveis, setDisponiveis] = useState<Cupom[]>([])
  const [aplicando, setAplicando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (lojaId) cuponsParaMim(lojaId).then(setDisponiveis, () => undefined)
  }, [lojaId])

  async function aplicar(valor = codigo) {
    if (!lojaId || !valor.trim()) return
    setAplicando(true)
    setErro(null)
    try {
      const c = await aplicarCupom(lojaId, valor, subtotal)
      escolherCupom(lojaId, c)
      setCodigo(c.code)
    } catch (e) {
      setErro(textoDeErro(e))
    } finally {
      setAplicando(false)
    }
  }

  const desconto = aplicado ? Math.min(aplicado.desconto_cents, subtotal) : 0

  return (
    <View style={s.tela}>
      <HeroiOnda titulo="Cupom de desconto" />
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.campoLinha}>
          <TextInput
            value={codigo}
            onChangeText={(t) => {
              setCodigo(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              setErro(null)
            }}
            placeholder="Código do cupom"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={() => aplicar()}
            accessibilityLabel="Código do cupom"
            style={s.campo}
          />
          <Pressable
            accessibilityRole="button"
            disabled={aplicando || !codigo}
            onPress={() => aplicar()}
            style={({ pressed }) => [s.aplicar, (!codigo || aplicando) && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.aplicarTexto}>{aplicando ? 'Conferindo' : 'Aplicar'}</Text>
          </Pressable>
        </View>
        {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}

        {aplicado ? (
          <View style={s.aplicado}>
            <CheckCircle size={22} color="#1F8A70" weight="fill" />
            <View style={s.flex}>
              <Text style={s.aplicadoTitulo}>Cupom aplicado: {aplicado.code}</Text>
              <Text style={s.texto}>{textoCupom(aplicado)}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => lojaId && escolherCupom(lojaId, null)} hitSlop={8}>
              <Text style={s.tirar}>Tirar</Text>
            </Pressable>
          </View>
        ) : null}

        {disponiveis.length ? (
          <>
            <Text style={s.secao}>Cupons para você</Text>
            <View style={s.lista}>
              {disponiveis.map((c, i) => (
                <View key={c.code} style={[s.item, i > 0 && s.divisor]}>
                  <View style={s.icone}>
                    <Ticket size={20} color={colors.primaryDeep} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.itemCodigo}>{c.code}</Text>
                    <Text style={s.texto}>
                      {textoCupom(c)}
                      {ate(c.valido_ate)}
                    </Text>
                  </View>
                  {aplicado?.code === c.code ? (
                    <Text style={s.usando}>Usando</Text>
                  ) : (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Usar ${c.code}`} onPress={() => aplicar(c.code)} style={({ pressed }) => [s.usar, pressed && { opacity: 0.7 }]}>
                      <Text style={s.usarTexto}>Usar</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={s.totais}>
          <View style={s.linha}>
            <Text style={s.texto}>Subtotal</Text>
            <Text style={s.texto}>{reais(subtotal)}</Text>
          </View>
          {aplicado ? (
            <View style={s.linha}>
              <Text style={s.texto}>Desconto {aplicado.code}</Text>
              <Text style={[s.texto, s.desconto]}>− {reais(desconto)}</Text>
            </View>
          ) : null}
          <View style={s.linha}>
            <Text style={s.totalRotulo}>Total</Text>
            <Text style={s.total}>{reais(subtotal - desconto)}</Text>
          </View>
          <Text style={s.nota}>A entrega, quando houver, não entra no desconto.</Text>
        </View>
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrimario titulo="Voltar à solicitação" onPress={() => router.back()} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  campoLinha: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 26, paddingLeft: 18, paddingRight: 6, height: 56, ...shadow.card },
  campo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 16, letterSpacing: 1, color: colors.text, paddingVertical: 0 },
  aplicar: { backgroundColor: colors.black, borderRadius: 22, paddingHorizontal: 18, height: 44, justifyContent: 'center' },
  aplicarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.white },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },
  aplicado: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#DDF5EC', borderRadius: 22, padding: 14 },
  aplicadoTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: '#14614F' },
  tirar: { fontFamily: fontFamily.bold, fontSize: 14, color: '#14614F', textDecorationLine: 'underline' },
  secao: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text, marginTop: 4 },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icone: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  itemCodigo: { fontFamily: fontFamily.bold, fontSize: 15, letterSpacing: 0.5, color: colors.text },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  usar: { borderRadius: 999, borderWidth: 1.5, borderColor: colors.black, paddingHorizontal: 14, paddingVertical: 6 },
  usarTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.text },
  usando: { fontFamily: fontFamily.bold, fontSize: 13, color: '#1F8A70' },
  totais: { gap: 6, paddingHorizontal: 4, marginTop: 4 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  desconto: { color: '#1F8A70', fontFamily: fontFamily.semiBold },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  total: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
})
