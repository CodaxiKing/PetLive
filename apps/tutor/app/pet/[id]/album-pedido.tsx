import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BookOpen } from 'phosphor-react-native/src/icons/BookOpen'
import { PixLogo } from 'phosphor-react-native/src/icons/PixLogo'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { reais } from '../../../src/despesas/despesas'
import {
  cotarAlbum,
  enderecoPostalCompleto,
  enderecosPostais,
  linhaEndereco,
  mascararCep,
  pedirAlbum,
  salvarEnderecoPostal,
  type EnderecoPostal,
  type FormatoAlbum,
} from '../../../src/pets/albumPedido'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { shadow } from '../../../src/theme/tokens'
import { fontFamily } from '../../../src/theme/typography'

type Novo = { street: string; number: string; complement: string; neighborhood: string; city: string; cep: string }
const NOVO: Novo = { street: '', number: '', complement: '', neighborhood: '', city: '', cep: '' }

/** Pedido do álbum (protótipo AlbumPedido): formato, entrega, prazo, preço e Pix. */
export default function PedidoAlbum() {
  const { id, ano, itens: itensParam } = useLocalSearchParams<{ id: string; ano: string; itens: string }>()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null
  const itens: string[] = (() => {
    try {
      const lista = JSON.parse(itensParam ?? '[]')
      return Array.isArray(lista) ? lista.filter((i) => typeof i === 'string') : []
    } catch {
      return []
    }
  })()
  const [formatos, setFormatos] = useState<FormatoAlbum[] | null>(null)
  const [formato, setFormato] = useState<string | null>(null)
  const [enderecos, setEnderecos] = useState<EnderecoPostal[]>([])
  const [enderecoId, setEnderecoId] = useState<string | null>(null)
  const [novo, setNovo] = useState<Novo | null>(null)
  const [trocando, setTrocando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    cotarAlbum(itens.length).then((l) => {
      setFormatos(l)
      setFormato((f) => f ?? l[0]?.formato ?? null)
    }, (e: Error) => setErro(e.message))
    enderecosPostais().then((l) => {
      setEnderecos(l)
      const pronto = l.find(enderecoPostalCompleto)
      if (pronto) setEnderecoId(pronto.id)
      else setNovo(NOVO)
    }, () => setNovo(NOVO))
    // A seleção chega pela rota e não muda nesta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const escolhido = formatos?.find((f) => f.formato === formato) ?? null
  const endereco = enderecos.find((e) => e.id === enderecoId) ?? null
  const completos = enderecos.filter(enderecoPostalCompleto)

  async function guardarEndereco() {
    if (!novo) return
    setErro(null)
    try {
      const e = await salvarEnderecoPostal({ ...novo, cep: novo.cep })
      setEnderecos((l) => [e, ...l])
      setEnderecoId(e.id)
      setNovo(null)
      setTrocando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }

  async function pagar() {
    if (!pet || !escolhido || !endereco) return
    setEnviando(true)
    setErro(null)
    try {
      const r = await pedirAlbum(pet.id, Number(ano), escolhido.formato, itens, endereco.id)
      router.replace({ pathname: '/pagamento/pix', params: { album: r.id } })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  if (!pet || !itens.length) {
    return (
      <View style={s.tela}>
        <HeroiOnda titulo="Pedido do álbum" />
        <View style={s.centro}>
          <Text style={s.texto}>Monte o álbum e veja a prévia antes de pedir.</Text>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda titulo="Pedido do álbum" />
      <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.secao}>Resumo do pedido</Text>
        {formatos === null ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : (
          <View style={s.lista}>
            {formatos.map((f, i) => {
              const ativo = f.formato === formato
              return (
                <Pressable key={f.formato} accessibilityRole="radio" accessibilityState={{ selected: ativo }} onPress={() => setFormato(f.formato)} style={({ pressed }) => [s.item, i > 0 && s.divisor, pressed && { opacity: 0.7 }]}>
                  <View style={s.capa}>
                    <BookOpen size={22} color="#8A6414" />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.itemTitulo}>Álbum do ano {pet.especie === 'gato' ? 'da' : 'do'} {pet.nome}</Text>
                    <Text style={s.texto}>{f.paginas} páginas · {f.nome}</Text>
                  </View>
                  <View style={[s.radio, ativo && s.radioAtivo]}>{ativo ? <View style={s.radioMiolo} /> : null}</View>
                </Pressable>
              )
            })}
          </View>
        )}

        <View style={s.lista}>
          <View style={s.item}>
            <View style={s.flex}>
              <Text style={s.rotulo}>Entrega</Text>
              {endereco && !trocando ? <Text style={s.itemTitulo}>{linhaEndereco(endereco)}</Text> : <Text style={s.texto}>Informe onde entregar</Text>}
            </View>
            {endereco && !trocando ? (
              <Pressable accessibilityRole="button" onPress={() => setTrocando(true)} hitSlop={8}>
                <Text style={s.trocar}>Trocar</Text>
              </Pressable>
            ) : null}
          </View>
          {trocando ? (
            <View style={s.divisor}>
              {completos.map((e) => (
                <Pressable key={e.id} accessibilityRole="radio" accessibilityState={{ selected: e.id === enderecoId }} onPress={() => { setEnderecoId(e.id); setTrocando(false) }} style={s.opcaoEndereco}>
                  <Text style={[s.itemTitulo, e.id === enderecoId && s.selecionado]}>{linhaEndereco(e)}</Text>
                  <Text style={s.texto}>{mascararCep(e.cep ?? '')} · {e.city}</Text>
                </Pressable>
              ))}
              {!novo ? (
                <Pressable accessibilityRole="button" onPress={() => setNovo(NOVO)} style={s.opcaoEndereco}>
                  <Text style={s.trocar}>+ Novo endereço</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {novo ? (
            <View style={[s.novo, s.divisor]}>
              <TextInput value={novo.cep} onChangeText={(cep) => setNovo({ ...novo, cep: mascararCep(cep) })} placeholder="CEP" keyboardType="number-pad" maxLength={9} placeholderTextColor={colors.textMuted} style={s.campo} accessibilityLabel="CEP" />
              <TextInput value={novo.street} onChangeText={(street) => setNovo({ ...novo, street })} placeholder="Rua" placeholderTextColor={colors.textMuted} style={s.campo} accessibilityLabel="Rua" />
              <View style={s.linha}>
                <TextInput value={novo.number} onChangeText={(number) => setNovo({ ...novo, number })} placeholder="Número" placeholderTextColor={colors.textMuted} style={[s.campo, s.flex]} accessibilityLabel="Número" />
                <TextInput value={novo.complement} onChangeText={(complement) => setNovo({ ...novo, complement })} placeholder="Complemento" placeholderTextColor={colors.textMuted} style={[s.campo, s.flex]} accessibilityLabel="Complemento" />
              </View>
              <View style={s.linha}>
                <TextInput value={novo.neighborhood} onChangeText={(neighborhood) => setNovo({ ...novo, neighborhood })} placeholder="Bairro" placeholderTextColor={colors.textMuted} style={[s.campo, s.flex]} accessibilityLabel="Bairro" />
                <TextInput value={novo.city} onChangeText={(city) => setNovo({ ...novo, city })} placeholder="Cidade" placeholderTextColor={colors.textMuted} style={[s.campo, s.flex]} accessibilityLabel="Cidade" />
              </View>
              <BotaoPrimario titulo="Salvar endereço" claro onPress={guardarEndereco} />
            </View>
          ) : null}
          {escolhido ? (
            <View style={[s.item, s.divisor]}>
              <View style={s.flex}>
                <Text style={s.rotulo}>Prazo</Text>
                <Text style={s.itemTitulo}>Pronto em {escolhido.prazo_dias_uteis} dias úteis</Text>
              </View>
            </View>
          ) : null}
        </View>

        {escolhido ? (
          <View style={s.totais}>
            <View style={s.linhaTotal}>
              <Text style={s.texto}>Álbum</Text>
              <Text style={s.texto}>{reais(escolhido.preco_cents)}</Text>
            </View>
            <View style={s.linhaTotal}>
              <Text style={s.texto}>Frete</Text>
              <Text style={s.texto}>{escolhido.frete_cents ? reais(escolhido.frete_cents) : 'Grátis'}</Text>
            </View>
            <View style={s.linhaTotal}>
              <Text style={s.totalRotulo}>Total</Text>
              <Text style={s.total}>{reais(escolhido.total_cents)}</Text>
            </View>
          </View>
        ) : null}
        <Text style={s.nota}>Impresso e enviado por uma gráfica parceira. Você acompanha o pedido por aqui. {itens.length} lembranças, uma por página.</Text>
        {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrimario titulo="Pagar com Pix" icone={<PixLogo size={20} weight="fill" />} carregando={enviando} desabilitado={!escolhido || !endereco || trocando || !!novo} onPress={pagar} />
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  secao: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  capa: { width: 42, height: 52, borderRadius: 10, backgroundColor: '#FFF0C9', alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text },
  selecionado: { color: colors.primaryDeep },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  trocar: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioAtivo: { borderColor: colors.black },
  radioMiolo: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.black },
  opcaoEndereco: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  novo: { padding: 14, gap: 8 },
  linha: { flexDirection: 'row', gap: 8 },
  campo: { height: 48, borderRadius: 16, backgroundColor: colors.background, paddingHorizontal: 14, fontFamily: fontFamily.regular, fontSize: 15, color: colors.text },
  totais: { gap: 6, paddingHorizontal: 4 },
  linhaTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalRotulo: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text },
  total: { fontFamily: fontFamily.bold, fontSize: 22, letterSpacing: -0.5, color: colors.text },
  nota: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
})
