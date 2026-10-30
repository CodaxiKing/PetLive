import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Copy } from 'phosphor-react-native/src/icons/Copy'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { reais } from '../../src/despesas/despesas'
import { copiarTexto } from '../../src/lib/copiar'
import { cpfValido, desistirDoPix, ErroPix, gerarPix, mascararCpf, pagamentoDetalhe, tempoRestante, type Pagamento } from '../../src/pagamentos/pagamentos'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'

const PASSOS = ['Abra o app do seu banco e escolha Pix', 'Escaneie o QR ou cole o código', 'Confirmamos aqui, sem você fazer nada']

type Resultado = { pg: Pagamento | null } | { cpf: true } | { cpf: false; erro: string }

/** Gera (ou reabre) a cobrança e lê o pagamento; "cpf" quando o banco pede nome e CPF. */
async function carregarPix(alvo: { pedido: string } | { album: string }, dados?: { nome: string; cpf: string }): Promise<Resultado> {
  try {
    return { pg: await pagamentoDetalhe(await gerarPix(alvo, dados)) }
  } catch (e) {
    if (e instanceof ErroPix && e.codigo === 'cpf') return { cpf: true }
    return { cpf: false, erro: e instanceof Error ? e.message : String(e) }
  }
}

/** Pagar com Pix (protótipo PagamentoPix): QR, copia e cola, prazo e confirmação automática. */
export default function PagarComPix() {
  const { pedido, album } = useLocalSearchParams<{ pedido?: string; album?: string }>()
  const alvo = pedido ? { pedido } : album ? { album } : null
  const [pg, setPg] = useState<Pagamento | null>(null)
  const [pedeCpf, setPedeCpf] = useState(false)
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [gerando, setGerando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [conferindo, setConferindo] = useState(false)
  const [agora, setAgora] = useState(() => Date.now())
  const pagou = useRef(false)

  // Aplica o resultado de gerar o Pix (a primeira abertura e as novas tentativas).
  const aplicar = useCallback((r: Resultado) => {
    if ('pg' in r) {
      setPedeCpf(false)
      setPg(r.pg)
      if (!r.pg) setErro('Não encontramos este pagamento. Tente de novo.')
    } else if (r.cpf) setPedeCpf(true)
    else setErro(r.erro)
    setGerando(false)
  }, [])

  function gerar(dados?: { nome: string; cpf: string }) {
    if (!alvo) return
    setGerando(true)
    setErro(null)
    carregarPix(alvo, dados).then(aplicar)
  }

  useEffect(() => {
    if (!alvo) return
    let vivo = true
    carregarPix(alvo).then((r) => vivo && aplicar(r))
    return () => {
      vivo = false
    }
    // O alvo vem dos parâmetros da rota e não muda nesta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, album, aplicar])

  const conferir = useCallback(async () => {
    if (!pg) return null
    const atual = await pagamentoDetalhe(pg.id).catch(() => null)
    if (!atual) return null
    if (atual.status === 'pago' && !pagou.current) {
      pagou.current = true
      router.replace({ pathname: '/pagamento/[id]', params: { id: atual.id } })
    } else if (atual.status !== pg.status) setPg(atual)
    return atual
  }, [pg])

  // Confere o pagamento a cada 4 s e atualiza o relógio a cada segundo.
  const pendente = pg?.status === 'pendente'
  useEffect(() => {
    if (!pendente) return
    const relogio = setInterval(() => setAgora(Date.now()), 1000)
    const status = setInterval(conferir, 4000)
    return () => {
      clearInterval(relogio)
      clearInterval(status)
    }
  }, [pendente, conferir])

  async function copiar() {
    if (!pg?.pix_payload) return
    if ((await copiarTexto(pg.pix_payload)) !== 'copiado') return
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  async function jaPaguei() {
    setConferindo(true)
    const atual = await conferir()
    setConferindo(false)
    if (atual && atual.status === 'pendente') Alert.alert('Ainda não chegou', 'O banco pode levar alguns segundos para avisar. Esta tela confere sozinha e muda quando o Pix entrar.')
  }

  function desistir() {
    if (!pedido) return router.back()
    Alert.alert('Desistir do pedido?', 'O pedido não vai para a loja. Se você já pagou, espere a confirmação.', [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Desistir',
        style: 'destructive',
        onPress: () => desistirDoPix(pedido).then(() => router.replace(`/pedidos/${pedido}`), (e: Error) => Alert.alert('Não deu para desistir', e.message)),
      },
    ])
  }

  const vencido = pg !== null && (pg.status === 'expirado' || (pg.status === 'pendente' && Date.parse(pg.expires_at) <= agora))

  if (pedeCpf) {
    const valido = nome.trim().length >= 3 && cpfValido(cpf)
    return (
      <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <HeroiOnda titulo="Pagar com Pix" />
        <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
          <Text style={s.texto}>Para gerar o primeiro Pix, o banco pede o nome e o CPF de quem paga. O CPF vai só para o emissor da cobrança; o PetLive não guarda.</Text>
          <View style={s.formulario}>
            <TextInput value={nome} onChangeText={setNome} placeholder="Nome completo" placeholderTextColor={colors.textMuted} autoComplete="name" style={s.campo} accessibilityLabel="Nome completo" />
            <TextInput
              value={cpf}
              onChangeText={(t) => setCpf(mascararCpf(t))}
              placeholder="CPF"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={14}
              style={[s.campo, s.campoDivisor]}
              accessibilityLabel="CPF"
            />
          </View>
          {cpf.length === 14 && !cpfValido(cpf) ? <Text style={s.erro}>Confira o CPF.</Text> : null}
          {erro ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
        </ScrollView>
        <View style={s.rodape}>
          <BotaoPrimario titulo="Gerar o Pix" carregando={gerando} desabilitado={!valido} onPress={() => gerar({ nome: nome.trim(), cpf })} />
        </View>
      </KeyboardAvoidingView>
    )
  }

  if (!pg) {
    if (!alvo) {
      return (
        <View style={s.tela}>
          <HeroiOnda titulo="Pagar com Pix" />
          <View style={s.centro}>
            <Text style={s.texto}>Pagamento não encontrado.</Text>
          </View>
        </View>
      )
    }
    return (
      <View style={s.tela}>
        <HeroiOnda titulo="Pagar com Pix" />
        <View style={s.centro}>
          {erro ? (
            <>
              <Text style={[s.texto, s.textoCentro]} accessibilityRole="alert">{erro}</Text>
              <BotaoPrimario titulo="Tentar de novo" carregando={gerando} onPress={() => gerar()} />
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primaryDeep} />
              <Text style={s.texto}>Gerando o Pix…</Text>
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={s.tela}>
      <HeroiOnda titulo="Pagar com Pix" />
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={s.cartao}>
          <Text style={[s.prazo, vencido && s.prazoVencido]}>{vencido ? 'O Pix venceu' : `Expira em ${tempoRestante(pg.expires_at, agora)}`}</Text>
          <Text style={s.valor}>{reais(pg.amount_cents)}</Text>
          {pg.para ? <Text style={s.texto}>Para {pg.para}</Text> : <Text style={s.texto}>{pg.descricao}</Text>}
          {!vencido && pg.pix_qr ? (
            <Image source={{ uri: `data:image/png;base64,${pg.pix_qr}` }} style={s.qr} accessibilityLabel="QR Code do Pix" />
          ) : null}
          {!vencido && pg.pix_payload ? (
            <View style={s.copiaCola}>
              <Text style={s.codigo} numberOfLines={1} ellipsizeMode="middle" selectable>
                {pg.pix_payload}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Copiar o código Pix" onPress={copiar} style={({ pressed }) => [s.copiar, pressed && { opacity: 0.7 }]}>
                <Copy size={16} color={colors.white} />
                <Text style={s.copiarTexto}>{copiado ? 'Copiado' : 'Copiar'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {vencido ? (
          <Text style={s.texto}>{pedido ? 'O pedido não foi enviado à loja. Faça o pedido de novo quando quiser.' : 'Gere outro Pix para continuar.'}</Text>
        ) : (
          <View style={s.passos}>
            {PASSOS.map((p, i) => (
              <View key={p} style={s.passo}>
                <View style={s.numero}>
                  <Text style={s.numeroTexto}>{i + 1}</Text>
                </View>
                <Text style={s.passoTexto}>{p}</Text>
              </View>
            ))}
          </View>
        )}
        {!vencido ? (
          <View style={s.aguardando}>
            <ActivityIndicator size="small" color={colors.primaryDeep} />
            <Text style={s.aguardandoTexto}>Aguardando o pagamento</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={s.rodape}>
        {vencido ? (
          album ? (
            <BotaoPrimario titulo="Gerar outro Pix" carregando={gerando} onPress={() => gerar()} />
          ) : (
            <BotaoPrimario titulo="Ver o pedido" onPress={() => router.replace(`/pedidos/${pedido}`)} />
          )
        ) : (
          <>
            <BotaoPrimario titulo="Já paguei" carregando={conferindo} onPress={jaPaguei} />
            <Pressable accessibilityRole="button" onPress={desistir} hitSlop={8} style={s.desistir}>
              <Text style={s.desistirTexto}>{pedido ? 'Desistir do pedido' : 'Pagar depois'}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 16 },
  cartao: { backgroundColor: colors.surface, borderRadius: 28, padding: 20, alignItems: 'center', gap: 4, ...shadow.card },
  prazo: { fontFamily: fontFamily.bold, fontSize: 13, color: '#8A6414', backgroundColor: '#FFF0C9', borderRadius: 999, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 5, marginBottom: 6 },
  prazoVencido: { color: '#A3324F', backgroundColor: '#FDE0E6' },
  valor: { fontFamily: fontFamily.bold, fontSize: 32, letterSpacing: -1, color: colors.text },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  textoCentro: { textAlign: 'center' },
  qr: { width: 220, height: 220, marginVertical: 12 },
  copiaCola: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', backgroundColor: colors.background, borderRadius: 18, paddingLeft: 14, paddingRight: 6, height: 50 },
  codigo: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, color: colors.text },
  copiar: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.black, borderRadius: 16, paddingHorizontal: 14, height: 38 },
  copiarTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.white },
  passos: { gap: 12, paddingHorizontal: 4 },
  passo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  numero: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  numeroTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.white },
  passoTexto: { flex: 1, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  aguardando: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primarySurface, borderRadius: 999, paddingVertical: 12 },
  aguardandoTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  formulario: { backgroundColor: colors.surface, borderRadius: 24, ...shadow.card },
  campo: { height: 56, paddingHorizontal: 18, fontFamily: fontFamily.regular, fontSize: 16, color: colors.text },
  campoDivisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 10 },
  desistir: { alignSelf: 'center', paddingVertical: 4 },
  desistirTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },
})
