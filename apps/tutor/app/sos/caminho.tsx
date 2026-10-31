import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Hospital } from 'phosphor-react-native/src/icons/Hospital'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { AvatarPet } from '../../src/pets/AvatarPet'
import { usePets } from '../../src/pets/PetsProvider'
import { posicaoAtual } from '../../src/perdido/perdido'
import { avisarClinica, clinicas24hPerto, minutosAte, mudarDeClinica, type Clinica24h } from '../../src/sos/chegada'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily } from '../../src/theme/typography'
import { textoDeErro } from '../../src/lib/erros'

const TEMPOS = [5, 10, 15, 20, 30, 45]

/**
 * Estou a caminho (SOS pré-chegada): escolher a clínica 24 h do PetLive, o pet
 * e o tempo de chegada; a clínica recebe a ficha de emergência na hora. Com
 * ?trocar=<id>, muda o aviso em curso para outra clínica.
 */
export default function EstouACaminho() {
  const { trocar, atual, lugar, nome, telefone } = useLocalSearchParams<{ trocar?: string; atual?: string; lugar?: string; nome?: string; telefone?: string }>()
  const { pets, petAtivo } = usePets()
  const [clinicas, setClinicas] = useState<Clinica24h[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [clinicaId, setClinicaId] = useState<string | null>(null)
  const [petId, setPetId] = useState(petAtivo?.id ?? pets[0]?.id ?? null)
  const [eta, setEta] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    posicaoAtual()
      .then(({ lat, lng }) => clinicas24hPerto(lat, lng))
      .then((lista) => {
        const outras = lista.filter((c) => c.id !== atual)
        setClinicas(outras)
        if (outras[0]) {
          setClinicaId(outras[0].id)
          setEta(minutosAte(outras[0].distancia_km))
        }
      })
      .catch((e: Error) => {
        setClinicas([])
        setErro(textoDeErro(e))
      })
  }, [atual])

  function escolher(c: Clinica24h) {
    setClinicaId(c.id)
    setEta(minutosAte(c.distancia_km))
  }

  async function enviar() {
    if (!clinicaId || !eta || (!trocar && !petId)) return
    setEnviando(true)
    setErro(null)
    try {
      const id = trocar ? await mudarDeClinica(trocar, clinicaId, eta) : await avisarClinica(petId as string, clinicaId, eta)
      router.replace({ pathname: '/sos/chegada/[id]', params: { id } })
    } catch (e) {
      setErro(textoDeErro(e))
    } finally {
      setEnviando(false)
    }
  }

  const pet = pets.find((p) => p.id === petId) ?? null
  const tempos = eta && !TEMPOS.includes(eta) ? [eta, ...TEMPOS].sort((a, b) => a - b) : TEMPOS

  return (
    <View style={s.tela}>
      <HeroiOnda subtitulo="SOS" titulo={trocar ? 'Mudar de clínica' : 'Vou levar à clínica'} />
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <Text style={s.texto}>A clínica recebe na hora a ficha de emergência e o tempo até vocês chegarem.</Text>

        {!trocar && pets.length > 1 ? (
          <>
            <Text style={s.secao}>Pet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.linhaChips}>
              {pets.map((p) => (
                <Pressable key={p.id} accessibilityRole="radio" accessibilityState={{ selected: p.id === petId }} onPress={() => setPetId(p.id)} style={[s.pet, p.id === petId && s.ativo]}>
                  <AvatarPet especie={p.especie} foto={p.foto_url} size={30} />
                  <Text style={[s.chipTexto, p.id === petId && s.textoClaro]}>{p.nome}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <Text style={s.secao}>Clínica 24 h no PetLive</Text>
        {clinicas === null ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : clinicas.length === 0 ? (
          <View style={s.vazio}>
            <Text style={s.texto}>{erro ?? 'Nenhuma clínica 24 h do PetLive por perto. Mande a ficha pelo WhatsApp para a clínica que você escolher.'}</Text>
          </View>
        ) : (
          <View style={s.lista}>
            {clinicas.map((c, i) => {
              const ativa = c.id === clinicaId
              return (
                <Pressable key={c.id} accessibilityRole="radio" accessibilityState={{ selected: ativa }} onPress={() => escolher(c)} style={({ pressed }) => [s.item, i > 0 && s.divisor, pressed && { opacity: 0.7 }]}>
                  <View style={s.icone}>
                    <Hospital size={22} color={colors.emergency} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.itemTitulo}>{c.name}</Text>
                    <Text style={s.texto}>
                      {String(c.distancia_km).replace('.', ',')} km · cerca de {minutosAte(c.distancia_km)} min{c.neighborhood ? ` · ${c.neighborhood}` : ''}
                    </Text>
                  </View>
                  <View style={[s.radio, ativa && s.radioAtivo]}>{ativa ? <View style={s.radioMiolo} /> : null}</View>
                </Pressable>
              )
            })}
          </View>
        )}

        {clinicas?.length ? (
          <>
            <Text style={s.secao}>Chego em</Text>
            <View style={s.chips}>
              {tempos.map((t) => (
                <Pressable key={t} accessibilityRole="radio" accessibilityState={{ selected: t === eta }} onPress={() => setEta(t)} style={[s.chip, t === eta && s.ativo]}>
                  <Text style={[s.chipTexto, t === eta && s.textoClaro]}>{t} min</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {pet && !trocar ? (
          <View style={s.info}>
            <Text style={s.infoTitulo}>O que a clínica recebe</Text>
            <Text style={s.infoTexto}>Ficha {pet.especie === 'gato' ? 'da' : 'do'} {pet.nome}: alergias, remédios, vacinas, peso e seu telefone. O link vale por 6 horas.</Text>
          </View>
        ) : null}
        {erro && clinicas?.length ? <Text style={s.erro} accessibilityRole="alert">{erro}</Text> : null}
        {!trocar ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/ficha/enviar', params: lugar ? { lugar, nome: nome ?? '', telefone: telefone ?? '' } : {} })}
            style={({ pressed }) => [s.whatsapp, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.whatsappTitulo}>A clínica não está no PetLive?</Text>
            <Text style={s.texto}>{nome ? `Mande a ficha pelo WhatsApp para ${nome}.` : 'Mande a ficha pelo WhatsApp para qualquer clínica.'}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <View style={s.rodape}>
        <BotaoPrimario
          titulo={trocar ? 'Avisar a nova clínica' : 'Avisar a clínica'}
          fundo={colors.emergency}
          carregando={enviando}
          desabilitado={!clinicaId || !eta || (!trocar && !petId)}
          onPress={enviar}
        />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  conteudo: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  secao: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.text, marginTop: 4 },
  linhaChips: { gap: 8 },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, height: 40, borderRadius: 20, backgroundColor: colors.surface, ...shadow.card },
  ativo: { backgroundColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.text },
  textoClaro: { color: colors.white },
  vazio: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, ...shadow.card },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icone: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FDE0E6', alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.text },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioAtivo: { borderColor: colors.black },
  radioMiolo: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.black },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.surface, justifyContent: 'center', ...shadow.card },
  info: { backgroundColor: colors.primarySurface, borderRadius: 20, padding: 14, gap: 2 },
  infoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  infoTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.primaryDeep },
  whatsapp: { backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 2, ...shadow.card },
  whatsappTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.text },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
})
