import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { ControleSegmentado } from '../../../src/components/ControleSegmentado'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { Interruptor } from '../../../src/components/Interruptor'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { useRecurso } from '../../../src/lib/configApp'
import { supabase } from '../../../src/lib/supabase'
import { AvatarPet } from '../../../src/pets/AvatarPet'
import { abrirWhatsAppComTexto, idadePeso, ITENS_FICHA, mensagemFicha, secoesFicha } from '../../../src/pets/fichaEmergencia'
import { FolhaQR } from '../../../src/pets/FolhaQR'
import { gerarLink, PRAZOS } from '../../../src/pets/linkCarteirinha'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

const ROSA = '#FDE0E6'

/**
 * Ficha de emergência (protótipo FichaEmergencia): o que enviar, por quanto
 * tempo o link vale, e enviar pelo WhatsApp ou mostrar o QR na clínica.
 * Se já há uma ficha ativa com as mesmas escolhas, o servidor reaproveita.
 */
export default function TelaFicha() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, recarregar } = usePets()
  const { user } = useAuth()
  const pet = pets.find((p) => p.id === id) ?? null
  const ligado = useRecurso('carteirinha_link')

  const [ligados, setLigados] = useState<Set<string>>(() => new Set(ITENS_FICHA.map((i) => i.chave)))
  const [alergias, setAlergias] = useState<string | null>(null)
  const [prazo, setPrazo] = useState(1)
  const [enviando, setEnviando] = useState<'whatsapp' | 'qr' | null>(null)
  const [qr, setQr] = useState<{ codigo: string; expira_em: string } | null>(null)

  if (!pet) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }
  const textoAlergias = alergias ?? pet.alergias ?? ''

  function alternar(chave: string) {
    setLigados((atual) => {
      const nova = new Set(atual)
      if (nova.has(chave)) nova.delete(chave)
      else nova.add(chave)
      return nova
    })
  }

  async function gerar(canal: 'whatsapp' | 'qr') {
    if (!pet || !user) return
    setEnviando(canal)
    try {
      // Alergias escritas aqui ficam no pet (valem para a carteirinha também).
      if (alergias !== null && alergias.trim() !== (pet.alergias ?? '')) {
        const { error } = await supabase.from('pets').update({ alergias: alergias.trim() || null }).eq('id', pet.id)
        if (error) throw new Error(error.message)
        recarregar().catch(() => undefined)
      }
      const horas = PRAZOS[prazo]
      const link = await gerarLink(pet.id, secoesFicha(ligados), horas, { tipo: 'emergencia', canal })
      if (canal === 'qr') setQr(link)
      else await abrirWhatsAppComTexto(mensagemFicha(pet, link.codigo, horas))
    } catch (e) {
      Alert.alert('Não deu para gerar a ficha', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setEnviando(null)
    }
  }

  const subtitulos: Record<string, string> = {
    alergias: textoAlergias.trim() || 'Nenhuma informada',
    remedios: 'Nome e dose atual',
    vacinas: 'Datas e se estão em dia',
    contato: 'Para a clínica falar com você',
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda fundo={ROSA} subtitulo="Emergência" titulo="Ficha de emergência" altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={estilos.pet}>
          <View style={estilos.avatar}>
            <AvatarPet especie={pet.especie} foto={pet.foto_url} size={60} />
          </View>
          <View style={estilos.flex}>
            <Text style={estilos.petNome} numberOfLines={1}>
              {pet.nome} · {pet.especie === 'gato' ? 'gato' : 'cão'}
              {pet.raca ? `, ${pet.raca.toLowerCase()}` : ''}
            </Text>
            {idadePeso(pet) ? <Text style={estilos.petSub}>{idadePeso(pet)}</Text> : null}
          </View>
        </View>

        {!ligado ? <Text style={estilos.pausado}>O envio por link está pausado agora. Tente de novo mais tarde.</Text> : null}

        <Text style={estilos.secao}>O que enviar</Text>
        {ITENS_FICHA.map((item) => (
          <View key={item.chave} style={estilos.item}>
            <View style={estilos.itemLinha}>
              <View style={estilos.flex}>
                <Text style={estilos.itemTitulo}>{item.titulo}</Text>
                <Text style={estilos.itemSub} numberOfLines={1}>
                  {subtitulos[item.chave]}
                </Text>
              </View>
              <Interruptor ligado={ligados.has(item.chave)} rotulo={item.titulo} onToggle={() => alternar(item.chave)} />
            </View>
            {item.chave === 'alergias' && ligados.has('alergias') && !pet.alergias ? (
              <TextInput
                value={textoAlergias}
                onChangeText={setAlergias}
                placeholder="Ex.: frango, dipirona. Sem doenças crônicas."
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Alergias e condições"
                multiline
                maxLength={500}
                style={estilos.campo}
              />
            ) : null}
          </View>
        ))}

        <Text style={estilos.secao}>O link vale por</Text>
        <ControleSegmentado opcoes={PRAZOS.map((h) => `${h} horas`)} ativo={prazo} onSelecionar={setPrazo} />
        <Text style={estilos.nota}>Você pode cancelar quando quiser e é avisado quando abrirem a ficha. Os dados do pet sempre vão.</Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Enviar por WhatsApp"
          carregando={enviando === 'whatsapp'}
          desabilitado={!ligado || enviando !== null}
          icone={<Icone nome="compartilhar" size={22} espessura={2} />}
          onPress={() => gerar('whatsapp')}
        />
        <Tocavel
          accessibilityRole="button"
          accessibilityLabel="Mostrar QR para a clínica ler"
          disabled={!ligado || enviando !== null}
          onPress={() => gerar('qr')}
          style={estilos.secundario}
        >
          {enviando === 'qr' ? <ActivityIndicator color={colors.black} /> : <Text style={estilos.secundarioTexto}>Mostrar QR para a clínica ler</Text>}
        </Tocavel>
      </View>

      <FolhaQR link={qr} nomePet={pet.nome} onFechar={() => setQr(null)} />
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: 26, padding: 12 },
  avatar: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: '#FFF0C9' },
  petNome: { fontFamily: fontFamily.bold, fontSize: 17, color: colors.black },
  petSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.textMuted },
  pausado: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
    color: '#8A6414',
    backgroundColor: '#FFF0C9',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  item: { backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, gap: 10 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  itemSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#566070' },
  campo: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.black,
  },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#566070' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 10 },
  secundario: { height: 52, borderRadius: 26, backgroundColor: colors.disabled, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
})
