import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '../../src/auth/AuthProvider'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone } from '../../src/components/Icone'
import { Interruptor } from '../../src/components/Interruptor'
import {
  carregarPrefs,
  CHECKLIST,
  diasAte,
  hojeLocal,
  PREFS_PADRAO,
  proximaData,
  salvarPrefs,
  type DataFogos,
  type PrefsFogos,
} from '../../src/cuidados/fogos'
import { usePets } from '../../src/pets/PetsProvider'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'
import { textoDeErro } from '../../src/lib/erros'

function quandoFalta(dias: number): string {
  if (dias === 0) return 'é hoje'
  if (dias === 1) return 'é amanhã'
  return `em ${dias} dias`
}

/**
 * Fogos e trovão (protótipo ModoFogos): a próxima data com fogos, os avisos,
 * o checklist para acalmar e o modo calmo da noite (silencia lembretes que
 * não são urgentes; remédios continuam). Não recomenda remédio.
 */
export default function TelaFogos() {
  const { user } = useAuth()
  const { petAtivo } = usePets()
  const [data, setData] = useState<DataFogos | null | undefined>(undefined)
  const [prefs, setPrefs] = useState<PrefsFogos>(PREFS_PADRAO)
  const [salvando, setSalvando] = useState(false)

  useFocusEffect(
    useCallback(() => {
      proximaData().then(setData, () => setData(null))
      if (user) carregarPrefs(user.id).then(setPrefs, () => undefined)
    }, [user]),
  )

  async function mudar(novo: PrefsFogos) {
    const anterior = prefs
    setPrefs(novo)
    if (!user) return
    try {
      await salvarPrefs(user.id, novo)
    } catch (e) {
      setPrefs(anterior)
      Alert.alert('Não deu para salvar', textoDeErro(e))
    }
  }

  function marcar(chave: string) {
    const lista = prefs.checklist.includes(chave) ? prefs.checklist.filter((c) => c !== chave) : [...prefs.checklist, chave]
    mudar({ ...prefs, checklist: lista })
  }

  const calmoHoje = prefs.modo_calmo_em === hojeLocal()

  async function modoCalmo() {
    setSalvando(true)
    await mudar({ ...prefs, modo_calmo_em: calmoHoje ? null : hojeLocal() })
    setSalvando(false)
    if (!calmoHoje) {
      Alert.alert('Modo calmo ligado', 'Das 18h às 7h, os lembretes que não são urgentes esperam. Os avisos de remédio continuam.')
    }
  }

  const dias = data ? diasAte(data.data) : null

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Cuidados" titulo="Fogos e trovão" />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.proxima}>
          {data === undefined ? (
            <ActivityIndicator color="#8A5A00" />
          ) : data ? (
            <>
              <Text style={estilos.proximaRotulo}>Próxima data com fogos</Text>
              <Text style={estilos.proximaTitulo}>
                {data.nome} · {quandoFalta(dias ?? 0)}
              </Text>
              <Text style={estilos.proximaSub}>{data.dica ?? `${data.regiao}. Avisamos 3 dias antes e no dia.`}</Text>
            </>
          ) : (
            <>
              <Text style={estilos.proximaRotulo}>Próxima data com fogos</Text>
              <Text style={estilos.proximaTitulo}>Nenhuma por enquanto</Text>
              <Text style={estilos.proximaSub}>Quando houver, avisamos 3 dias antes e no dia.</Text>
            </>
          )}
        </View>

        <View style={estilos.item}>
          <View style={estilos.flex}>
            <Text style={estilos.itemTitulo}>Avisar antes de datas com fogos</Text>
            <Text style={estilos.itemSub}>Réveillon e festas do Rio</Text>
          </View>
          <Interruptor ligado={prefs.avisar} rotulo="Avisar antes de datas com fogos" onToggle={() => mudar({ ...prefs, avisar: !prefs.avisar })} />
        </View>
        <View style={estilos.item}>
          <View style={estilos.flex}>
            <Text style={estilos.itemTitulo}>Lembrar de manter o pet em casa</Text>
            <Text style={estilos.itemSub}>E a janela fechada, à noite</Text>
          </View>
          <Interruptor
            ligado={prefs.lembrar_em_casa}
            rotulo="Lembrar de manter o pet em casa"
            onToggle={() => mudar({ ...prefs, lembrar_em_casa: !prefs.lembrar_em_casa })}
          />
        </View>

        <Text style={estilos.secao}>Para acalmar o pet</Text>
        {CHECKLIST.map((c) => {
          const feito = prefs.checklist.includes(c.chave)
          return (
            <View key={c.chave} style={estilos.check}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: feito }}
                accessibilityLabel={c.texto}
                onPress={() => marcar(c.chave)}
                hitSlop={8}
                style={[estilos.caixa, feito && estilos.caixaFeita]}
              >
                {feito ? <Icone nome="check" size={16} cor={colors.primary} espessura={2.4} /> : null}
              </Pressable>
              <Pressable style={estilos.flex} onPress={() => marcar(c.chave)}>
                <Text style={estilos.checkTexto}>{c.texto}</Text>
              </Pressable>
              {c.rota && petAtivo ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/pet/[id]/carteirinha', params: { id: petAtivo.id } })}
                  hitSlop={8}
                >
                  <Text style={estilos.checkLink}>Ver</Text>
                </Pressable>
              ) : null}
            </View>
          )
        })}
        <Text style={estilos.nota}>Não use remédio para acalmar sem falar com o veterinário.</Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={calmoHoje ? 'Modo calmo ligado hoje · desligar' : 'Ativar modo calmo hoje'}
          carregando={salvando}
          icone={<Icone nome="sino" size={22} espessura={2} />}
          onPress={modoCalmo}
        />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  // Versão 2: a próxima data num cartão escuro.
  proxima: { backgroundColor: colors.black, borderRadius: 28, paddingVertical: 18, paddingHorizontal: 20, gap: 2, minHeight: 100, justifyContent: 'center' },
  proximaRotulo: { fontFamily: fontFamily.bold, fontSize: 14, color: '#F2C14E' },
  proximaTitulo: { fontFamily: fontFamily.bold, fontSize: 24, letterSpacing: -0.5, color: colors.white },
  proximaSub: { fontFamily: fontFamily.regular, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  itemSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#566070' },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  caixa: { width: 34, height: 34, borderRadius: 10, borderWidth: 2, borderColor: '#D5DAE2', alignItems: 'center', justifyContent: 'center' },
  caixaFeita: { backgroundColor: colors.black, borderColor: colors.black },
  checkTexto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, color: colors.black },
  checkLink: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep, textDecorationLine: 'underline' },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: '#566070', textAlign: 'center', marginTop: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
