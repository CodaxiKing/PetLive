import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Check } from 'phosphor-react-native/src/icons/Check'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { ligarPara } from '../../../src/mapa/acoes'
import { cancelarIda, CHEGADA_ENCERRADA, chegadaDetalhe, cheguei, haQuanto, textoChego, type Chegada } from '../../../src/sos/chegada'
import { colors } from '../../../src/theme/colors'
import { shadow } from '../../../src/theme/tokens'
import { fontFamily } from '../../../src/theme/typography'

type Passo = { titulo: string; em: string | null; dica?: string }

function passos(c: Chegada): Passo[] {
  return [
    { titulo: `Ficha de ${c.pet.nome} enviada`, em: c.criado_em },
    { titulo: 'A clínica viu a ficha', em: c.vista_em },
    { titulo: 'Equipe se preparando', em: c.preparando_em },
    { titulo: 'Sala de emergência liberada', em: c.pronta_em },
    { titulo: 'Você chegou', em: c.chegou_em, dica: 'Toque em Cheguei' },
  ]
}

/** Estou a caminho (protótipo EstouACaminho): resposta da clínica, mudar de clínica, ligar e Cheguei. */
export default function AcompanharChegada() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [c, setC] = useState<Chegada | null | 'indisponivel'>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const [chegando, setChegando] = useState(false)

  const carregar = useCallback(() => {
    if (id) chegadaDetalhe(id).then((r) => setC(r ?? 'indisponivel'), () => undefined)
  }, [id])
  useFocusEffect(carregar)

  // A clínica responde do lado dela: confere a cada 8 s enquanto o aviso está em curso.
  const emCurso = c !== null && c !== 'indisponivel' && !CHEGADA_ENCERRADA.includes(c.status)
  useEffect(() => {
    if (!emCurso) return
    const t = setInterval(() => {
      setAgora(Date.now())
      carregar()
    }, 8000)
    return () => clearInterval(t)
  }, [emCurso, carregar])

  if (!c || c === 'indisponivel') {
    return (
      <View style={s.tela}>
        <HeroiOnda subtitulo="SOS" titulo="Estou a caminho" />
        <View style={s.centro}>{c ? <Text style={s.texto}>Aviso não encontrado.</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
      </View>
    )
  }

  const chegada = c
  const lista = passos(chegada)
  const semVaga = chegada.status === 'indisponivel'
  const titulo = chegada.status === 'chegou' ? 'Vocês chegaram' : chegada.status === 'cancelada' ? 'Aviso encerrado' : chegada.status === 'expirada' ? 'Aviso vencido' : semVaga ? 'Sem vaga agora' : textoChego(chegada.eta_at, agora)
  const subtitulo = semVaga
    ? chegada.resposta ?? 'A clínica não pode receber agora. Escolha outra.'
    : chegada.status === 'cancelada' && chegada.substituido_por
      ? 'Você mudou para outra clínica.'
      : emCurso
        ? 'A clínica já sabe que você está indo.'
        : null

  function confirmarCheguei() {
    setChegando(true)
    cheguei(chegada.id).then(carregar, (e: Error) => Alert.alert('Não deu para avisar', e.message)).finally(() => setChegando(false))
  }

  function cancelar() {
    Alert.alert('Cancelar o aviso?', 'A clínica deixa de esperar vocês.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Cancelar aviso', style: 'destructive', onPress: () => cancelarIda(chegada.id).then(carregar, (e: Error) => Alert.alert('Não deu para cancelar', e.message)) },
    ])
  }

  return (
    <View style={s.tela}>
      <HeroiOnda subtitulo="SOS" titulo="Estou a caminho" />
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <View style={[s.topo, semVaga && s.topoAlerta]}>
          <Text style={s.topoClinica}>{chegada.clinica.name} · no PetLive</Text>
          <Text style={s.topoTitulo}>{titulo}</Text>
          {subtitulo ? <Text style={s.topoTexto}>{subtitulo}</Text> : null}
        </View>

        {chegada.status === 'cancelada' && chegada.substituido_por ? (
          <BotaoPrimario titulo="Ver o aviso da nova clínica" onPress={() => router.replace({ pathname: '/sos/chegada/[id]', params: { id: chegada.substituido_por as string } })} />
        ) : null}

        <View style={s.lista}>
          {lista.map((p, i) => {
            const feito = !!p.em
            const proximo = !feito && (i === 0 || !!lista[i - 1].em)
            return (
              <View key={p.titulo} style={s.passo}>
                <View style={s.trilho}>
                  <View style={[s.bolinha, feito && s.bolinhaFeita, proximo && emCurso && s.bolinhaProxima]}>{feito ? <Check size={14} color={colors.white} weight="bold" /> : null}</View>
                  {i < lista.length - 1 ? <View style={[s.traco, feito && s.tracoFeito]} /> : null}
                </View>
                <View style={s.passoTextos}>
                  <Text style={[s.passoTitulo, !feito && s.passoPendente]}>{p.titulo}</Text>
                  <Text style={s.texto}>{feito ? haQuanto(p.em as string, agora) : proximo && emCurso ? p.dica ?? 'Aguardando' : ''}</Text>
                </View>
              </View>
            )
          })}
        </View>

        <View style={s.recebeu}>
          <Text style={s.recebeuTitulo}>O que a clínica recebeu</Text>
          <Text style={s.texto}>Alergias, remédios, vacinas, peso e seu telefone</Text>
        </View>
        {emCurso ? (
          <Pressable accessibilityRole="button" onPress={cancelar} hitSlop={8} style={s.cancelar}>
            <Text style={s.cancelarTexto}>Cancelar o aviso</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {emCurso ? (
        <View style={s.rodape}>
          <View style={s.linhaBotoes}>
            <BotaoPrimario titulo="Mudar de clínica" claro estilo={s.flex} onPress={() => router.push({ pathname: '/sos/caminho', params: { trocar: chegada.id, atual: chegada.clinica.id } })} />
            {chegada.clinica.phone ? <BotaoPrimario titulo="Ligar" claro estilo={s.flex} onPress={() => ligarPara(chegada.clinica.phone as string).catch(() => undefined)} /> : null}
          </View>
          {semVaga ? null : <BotaoPrimario titulo="Cheguei" fundo={colors.emergency} carregando={chegando} onPress={confirmarCheguei} />}
        </View>
      ) : (
        <View style={s.rodape}>
          <BotaoPrimario titulo="Voltar ao SOS" onPress={() => router.replace('/sos')} />
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  topo: { backgroundColor: colors.emergency, borderRadius: 28, padding: 22, gap: 4 },
  topoAlerta: { backgroundColor: colors.black },
  topoClinica: { fontFamily: fontFamily.bold, fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  topoTitulo: { fontFamily: fontFamily.bold, fontSize: 30, letterSpacing: -0.8, color: colors.white },
  topoTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.85)' },
  lista: { backgroundColor: colors.surface, borderRadius: 26, padding: 18, ...shadow.card },
  passo: { flexDirection: 'row', gap: 14 },
  trilho: { alignItems: 'center', width: 26 },
  bolinha: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  bolinhaFeita: { backgroundColor: colors.successText, borderColor: colors.successText },
  bolinhaProxima: { borderColor: colors.emergency },
  traco: { width: 2, flex: 1, minHeight: 22, backgroundColor: colors.border },
  tracoFeito: { backgroundColor: colors.successText },
  passoTextos: { flex: 1, paddingBottom: 14, gap: 1 },
  passoTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text },
  passoPendente: { color: colors.textMuted, fontFamily: fontFamily.semiBold },
  texto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  recebeu: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 2, ...shadow.card },
  recebeuTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text },
  cancelar: { alignSelf: 'center', paddingVertical: 4 },
  cancelarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.textMuted, textDecorationLine: 'underline' },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 10 },
  linhaBotoes: { flexDirection: 'row', gap: 10 },
})
