import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { avaliacaoDoPedido } from '../../../src/loja/avaliacoes'
import { abrirPasseio, FASES, ouvirPasseio, paraTrajeto, tempos, TEXTO_REGISTRO, urlsFotosPasseio, type PasseioAoVivo } from '../../../src/loja/passeioAoVivo'
import { hhmm } from '../../../src/loja/reservas'
import { TrajetoPasseio } from '../../../src/passeios/TrajetoPasseio'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'
import { textoDeErro } from '../../../src/lib/erros'

/** Passeio ao vivo e resumo (protótipos PasseioAoVivo e PasseioFim). */
export default function PasseioLoja() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [dados, setDados] = useState<PasseioAoVivo | null>(null)
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const [avaliado, setAvaliado] = useState<boolean | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [agora, setAgora] = useState(() => Date.now())
  const pendente = useRef(false)

  const carregar = useCallback(() => {
    if (!id || pendente.current) return
    pendente.current = true
    abrirPasseio(id)
      .then((d) => {
        setDados(d)
        if (d.disponivel) urlsFotosPasseio(d.registros).then(setFotos, () => undefined)
      }, (e: unknown) => setErro(mensagemDeErro(textoDeErro(e))))
      .finally(() => { pendente.current = false })
    avaliacaoDoPedido(id).then((a) => setAvaliado(a !== null), () => undefined)
  }, [id])
  useFocusEffect(carregar)

  const walkId = dados?.disponivel ? dados.walk?.id : undefined
  const aoVivo = dados?.disponivel && dados.walk && ['iniciado', 'em_andamento'].includes(dados.walk.status)
  useEffect(() => {
    if (!walkId || !aoVivo) return
    const parar = ouvirPasseio(walkId, carregar)
    const relogio = setInterval(() => setAgora(Date.now()), 30_000)
    return () => {
      parar()
      clearInterval(relogio)
    }
  }, [walkId, aoVivo, carregar])

  if (!dados || !dados.disponivel) {
    return <View style={[estilos.tela, estilos.centro]}>{dados || erro ? <Text style={estilos.sub}>{erro ?? 'Passeio não encontrado.'}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
  }

  const { walk } = dados
  const pet = dados.pet ?? 'Seu pet'
  const terminou = walk && ['encerrado', 'avaliado'].includes(walk.status)
  const t = tempos(walk?.started_at ?? null, walk?.ended_at ?? null, dados.ends_at, agora)
  const faseAtual = walk ? FASES.findIndex((f) => f.valor === walk.fase) : -1
  const titulo = !walk || walk.status === 'agendado' ? `Passeio de ${pet}` : walk.status === 'perdido' ? 'O passeio não começou' : terminou ? `Passeio com o ${pet}` : `${pet} está passeando`

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={aoVivo ? '● AO VIVO' : terminou ? 'Resumo do passeio' : dados.loja} titulo={titulo} altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {dados.passeador ? <Text style={estilos.sub}>com {dados.passeador} · {dados.loja}</Text> : null}
        {!walk || walk.status === 'agendado' ? (
          <View style={estilos.cartao}>
            <Text style={estilos.titulo}>Ainda não começou</Text>
            <Text style={estilos.sub}>{dados.starts_at ? `Saída marcada para ${hhmm(dados.starts_at)}. ` : ''}Você recebe um aviso quando o passeador sair.</Text>
          </View>
        ) : walk.status === 'perdido' ? (
          <View style={estilos.cartao}>
            <Text style={estilos.sub}>O passeador não iniciou no horário. Fale com a loja pela conversa do pedido.</Text>
          </View>
        ) : (
          <>
            <View style={estilos.numeros}>
              <View style={estilos.numero}><Text style={estilos.numeroRotulo}>Tempo</Text><Text style={estilos.numeroValor}>{t.minutos} min</Text></View>
              <View style={estilos.numero}><Text style={estilos.numeroRotulo}>Distância</Text><Text style={estilos.numeroValor}>{(walk.distance_m / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</Text></View>
              {t.faltam !== null ? <View style={estilos.numero}><Text style={estilos.numeroRotulo}>Faltam</Text><Text style={estilos.numeroValor}>{t.faltam} min</Text></View> : null}
            </View>
            <View style={estilos.fases}>
              {FASES.map((f, i) => (
                <Text key={f.valor} style={[estilos.fase, i <= faseAtual && estilos.faseFeita]}>{i < faseAtual ? '✓ ' : i === faseAtual ? '● ' : ''}{f.rotulo}</Text>
              ))}
            </View>
            {dados.pontos.length > 1 ? <View style={estilos.cartao}><TrajetoPasseio pontos={paraTrajeto(dados.pontos)} /></View> : null}
            {dados.registros.some((r) => r.type !== 'foto') ? (
              <Text style={estilos.sub}>
                {dados.registros.filter((r) => r.type !== 'foto').map((r) => `${TEXTO_REGISTRO[r.type]} ${hhmm(r.at)}`).join(' · ')}
              </Text>
            ) : null}
            <Text style={estilos.secao}>Fotos do passeio</Text>
            {dados.registros.some((r) => r.type === 'foto') ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fotos}>
                {dados.registros.filter((r) => r.type === 'foto' && r.media_path && fotos[r.media_path]).map((r) => (
                  <Image key={r.id} source={{ uri: fotos[r.media_path as string] }} style={estilos.foto} accessibilityLabel={`Foto do passeio às ${hhmm(r.at)}`} />
                ))}
              </ScrollView>
            ) : (
              <Text style={estilos.sub}>{terminou ? 'Sem fotos neste passeio.' : 'As fotos aparecem aqui quando o passeador enviar.'}</Text>
            )}
            {walk.summary ? <View style={estilos.cartao}><Text style={estilos.secao}>Anotação do passeador</Text><Text style={estilos.texto}>{walk.summary}</Text></View> : null}
          </>
        )}
      </ScrollView>
      <View style={estilos.rodape}>
        {terminou && avaliado === false ? (
          <BotaoPrimario titulo="Avaliar o passeio" onPress={() => router.push({ pathname: '/pedidos/[id]/avaliar', params: { id: dados.request_id, loja: dados.loja } })} />
        ) : (
          <BotaoPrimario titulo="Falar com a loja" onPress={() => router.push(`/pedidos/${dados.request_id}/conversa`)} />
        )}
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  titulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.black },
  cartao: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 6 },
  numeros: { flexDirection: 'row', gap: 10 },
  numero: { flex: 1, backgroundColor: colors.primarySurface, borderRadius: 20, padding: 12, gap: 2 },
  numeroRotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.primaryDeep },
  numeroValor: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  fases: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fase: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.textMuted, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  faseFeita: { color: colors.successText, backgroundColor: colors.successSurface },
  fotos: { gap: 8 },
  foto: { width: 120, height: 120, borderRadius: 18 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
