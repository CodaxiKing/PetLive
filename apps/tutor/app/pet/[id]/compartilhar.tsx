import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../../src/auth/AuthProvider'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { ControleSegmentado } from '../../../src/components/ControleSegmentado'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { Interruptor } from '../../../src/components/Interruptor'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import { supabase } from '../../../src/lib/supabase'
import {
  cancelarLink,
  gerarLink,
  linksAtivos,
  mensagemLink,
  PRAZOS,
  quando,
  SECOES,
  type LinkCarteirinha,
  type Secao,
} from '../../../src/pets/linkCarteirinha'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/** Seções com texto que o tutor escreve aqui mesmo, se ainda não escreveu. */
type Texto = 'alergias' | 'veterinario' | 'observacoes' | 'telefone'
const DICAS: Record<Texto, string> = {
  alergias: 'Ex.: frango, dipirona. Sem doenças crônicas.',
  veterinario: 'Ex.: Dra. Ana · Clínica Vida Pet · (21) 99999-0000',
  observacoes: 'Ex.: tem medo de trovão, come 2 vezes ao dia.',
  telefone: '(21) 99999-0000',
}

/**
 * O que incluir ao compartilhar (protótipo CompartilharSecoes): o tutor
 * escolhe os 8 itens, o prazo do link, e o app abre o menu de compartilhar
 * do sistema com a mensagem e o link. A escolha vale só para aquele envio.
 */
export default function TelaCompartilhar() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, recarregar } = usePets()
  const { user } = useAuth()
  const pet = pets.find((p) => p.id === id) ?? null

  const [ligadas, setLigadas] = useState<Set<Secao>>(() => new Set(SECOES.filter((s) => s.padrao).map((s) => s.chave)))
  const [textos, setTextos] = useState<Record<Texto, string>>({ alergias: '', veterinario: '', observacoes: '', telefone: '' })
  const [prazo, setPrazo] = useState(1)
  const [links, setLinks] = useState<LinkCarteirinha[]>([])
  const [enviando, setEnviando] = useState(false)

  // Textos já salvos: do pet e o telefone do perfil.
  useEffect(() => {
    if (!pet || !user) return
    let vivo = true
    supabase
      .from('profiles')
      .select('telefone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return
        setTextos({
          alergias: pet.alergias ?? '',
          veterinario: pet.veterinario ?? '',
          observacoes: pet.observacoes ?? '',
          telefone: data?.telefone ?? '',
        })
      })
    return () => {
      vivo = false
    }
  }, [pet, user])

  const carregarLinks = useCallback(() => {
    if (!id) return
    linksAtivos(id).then(setLinks, () => setLinks([]))
  }, [id])
  useFocusEffect(carregarLinks)

  if (!pet) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.primaryDeep} />
      </View>
    )
  }

  function alternar(chave: Secao) {
    setLigadas((atual) => {
      const nova = new Set(atual)
      if (nova.has(chave)) nova.delete(chave)
      else nova.add(chave)
      return nova
    })
  }

  async function continuar() {
    if (!pet) return
    setEnviando(true)
    try {
      // Guarda o que o tutor escreveu: vale para os próximos envios e para a carteirinha.
      const doPet = {
        alergias: textos.alergias.trim() || null,
        veterinario: textos.veterinario.trim() || null,
        observacoes: textos.observacoes.trim() || null,
      }
      if (doPet.alergias !== (pet.alergias ?? null) || doPet.veterinario !== (pet.veterinario ?? null) || doPet.observacoes !== (pet.observacoes ?? null)) {
        const { error } = await supabase.from('pets').update(doPet).eq('id', pet.id)
        if (error) throw new Error(error.message)
        recarregar().catch(() => undefined)
      }
      if (user && ligadas.has('telefone')) {
        const { error } = await supabase.from('profiles').update({ telefone: textos.telefone.trim() || null }).eq('id', user.id)
        if (error) throw new Error(error.message)
      }
      const link = await gerarLink(pet.id, [...ligadas], PRAZOS[prazo])
      carregarLinks()
      await Share.share({ title: `Carteirinha de ${pet.nome}`, message: mensagemLink(pet.nome, link.codigo, link.expira_em) })
    } catch (e) {
      Alert.alert('Não deu para gerar o link', mensagemDeErro(e instanceof Error ? e.message : String(e)))
    } finally {
      setEnviando(false)
    }
  }

  function cancelar(link: LinkCarteirinha) {
    Alert.alert('Cancelar este link?', 'Quem tiver o link deixa de ver a carteirinha na hora.', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Cancelar link',
        style: 'destructive',
        onPress: () => cancelarLink(link.id).then(carregarLinks, (e: unknown) => Alert.alert('Não deu para cancelar', e instanceof Error ? e.message : 'Tente de novo.')),
      },
    ])
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda titulo="O que incluir?" subtitulo="Compartilhar" altura={200} />

      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={estilos.intro}>
          Escolha o que vai na carteirinha de {pet.nome}. Quem receber vê só isto. Incluídos: {ligadas.size} de {SECOES.length}.
        </Text>

        {SECOES.map((s) => {
          const ligado = ligadas.has(s.chave)
          const texto = s.chave in DICAS ? (s.chave as Texto) : null
          return (
            <View key={s.chave} style={estilos.item}>
              <View style={estilos.itemLinha}>
                <View style={estilos.flex}>
                  <Text style={estilos.itemTitulo}>{s.titulo}</Text>
                  <Text style={estilos.itemDescricao}>{s.descricao}</Text>
                </View>
                <Interruptor ligado={ligado} rotulo={s.titulo} onToggle={() => alternar(s.chave)} />
              </View>
              {ligado && texto ? (
                <TextInput
                  value={textos[texto]}
                  onChangeText={(v) => setTextos((t) => ({ ...t, [texto]: v }))}
                  placeholder={DICAS[texto]}
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel={s.titulo}
                  keyboardType={texto === 'telefone' ? 'phone-pad' : 'default'}
                  multiline={texto !== 'telefone'}
                  maxLength={texto === 'observacoes' ? 1000 : texto === 'alergias' ? 500 : 300}
                  style={estilos.itemCampo}
                />
              ) : null}
            </View>
          )
        })}

        <Text style={estilos.secao}>O link vale por</Text>
        <ControleSegmentado opcoes={PRAZOS.map((h) => `${h} horas`)} ativo={prazo} onSelecionar={setPrazo} />
        <Text style={estilos.nota}>Abre no navegador, sem login. Você pode cancelar quando quiser e vê quantas vezes foi aberto.</Text>

        {links.length > 0 ? (
          <>
            <Text style={estilos.secao}>Links ativos</Text>
            {links.map((l) => (
              <View key={l.id} style={estilos.link}>
                <View style={estilos.linkIcone}>
                  <Icone nome="compartilhar" size={18} />
                </View>
                <View style={estilos.flex}>
                  <Text style={estilos.linkTitulo}>Vale até {quando(l.expira_em)}</Text>
                  <Text style={estilos.linkSub}>
                    {l.aberturas === 0 ? 'Ainda não foi aberto' : `Aberto ${l.aberturas} ${l.aberturas === 1 ? 'vez' : 'vezes'}, a última ${quando(l.ultima_abertura_em ?? l.criado_em)}`}
                  </Text>
                </View>
                <Tocavel accessibilityRole="button" accessibilityLabel="Cancelar link" onPress={() => cancelar(l)} style={estilos.linkCancelar}>
                  <Text style={estilos.linkCancelarTexto}>Cancelar</Text>
                </Tocavel>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Continuar"
          carregando={enviando}
          icone={<Icone nome="compartilhar" size={22} espessura={2} />}
          onPress={continuar}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  intro: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: '#5E6878', marginBottom: 2 },
  item: { backgroundColor: colors.background, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, gap: 10 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  itemDescricao: { fontFamily: fontFamily.regular, fontSize: 13, color: '#5E6878' },
  itemCampo: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.black,
  },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 10 },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#6A7484' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySurface, borderRadius: 22, padding: 12 },
  linkIcone: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  linkTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  linkSub: { fontFamily: fontFamily.regular, fontSize: 12, color: '#2B3A4A' },
  linkCancelar: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white },
  linkCancelarTexto: { fontFamily: fontFamily.bold, fontSize: 12, color: '#B3173A' },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
