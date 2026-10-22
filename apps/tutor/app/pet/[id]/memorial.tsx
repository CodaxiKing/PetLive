import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { Gradiente } from '../../../src/components/Gradiente'
import { Icone, type NomeIcone } from '../../../src/components/Icone'
import { Mascote } from '../../../src/components/Mascote'
import { abrirPdf } from '../../../src/lib/pdf'
import { carregarMemorial, htmlAlbum, reativarPet, resumoLinha, type Memorial } from '../../../src/pets/memorial'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/** Até 24 h depois de registrar, o "Desfazer" fica em destaque. */
const JANELA_DESFAZER_MS = 24 * 3_600_000

/**
 * Em memória (protótipo Memorial): foto, datas, a mensagem, a linha do tempo
 * guardada, o álbum de lembranças e o apoio ao luto. Sem metas, sem pedidos
 * e sem pressa. Reativar fica discreto no rodapé.
 */
export default function TelaMemorial() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { petsMemoria, recarregar } = usePets()
  const pet = petsMemoria.find((p) => p.id === id) ?? null
  const [memorial, setMemorial] = useState<Memorial | null>(null)
  const [resumo, setResumo] = useState<{ marcos: number; fotos: number } | null>(null)
  const [recente, setRecente] = useState(false)
  const [gerando, setGerando] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      carregarMemorial(id).then((m) => {
        setMemorial(m)
        setRecente(Boolean(m && Date.now() - new Date(m.criado_em).getTime() < JANELA_DESFAZER_MS))
      }, () => undefined)
      resumoLinha(id).then(setResumo, () => undefined)
    }, [id]),
  )

  if (!pet || !memorial) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <ActivityIndicator color={colors.premiumText} />
      </View>
    )
  }
  const nome = pet.nome
  const anos = [pet.nascimento?.slice(0, 4), memorial.data_partida.slice(0, 4)].filter(Boolean).join(' · ')

  function desfazer() {
    Alert.alert(`Desfazer o registro?`, `${nome} volta para a lista de pets, com os lembretes a partir de agora.`, [
      { text: 'Manter em memória', style: 'cancel' },
      {
        text: 'Desfazer',
        onPress: async () => {
          try {
            await reativarPet(pet!.id)
            await recarregar()
            router.replace({ pathname: '/pet/[id]', params: { id: pet!.id } })
          } catch (e) {
            Alert.alert('Não deu para desfazer', e instanceof Error ? e.message : String(e))
          }
        },
      },
    ])
  }

  async function baixarAlbum() {
    if (!pet || !memorial) return
    setGerando(true)
    try {
      const resultado = await abrirPdf(await htmlAlbum(pet, memorial))
      if (resultado === 'sem-modulo') {
        Alert.alert('Atualize o app', 'O álbum em PDF precisa da versão mais nova do PetLive na loja de apps.')
      }
    } catch {
      Alert.alert('Não deu para gerar o álbum', 'Tente de novo em instantes.')
    } finally {
      setGerando(false)
    }
  }

  const cartoes: { icone: NomeIcone; rotulo: string; valor: string; fundo: string; acao: () => void }[] = [
    {
      icone: 'pata',
      rotulo: `Linha do tempo ${pet.sexo === 'femea' ? 'da' : 'do'} ${nome}`,
      valor: resumo ? `${resumo.fotos} ${resumo.fotos === 1 ? 'foto' : 'fotos'} e ${resumo.marcos} marcos guardados` : 'Abrir',
      fundo: colors.premiumSurface,
      acao: () => router.push({ pathname: '/pet/[id]/linha-do-tempo', params: { id: pet.id } }),
    },
    { icone: 'livro', rotulo: 'Baixar o álbum de lembranças', valor: gerando ? 'Preparando…' : 'PDF com as fotos e os marcos', fundo: colors.background, acao: baixarAlbum },
    { icone: 'coracao', rotulo: 'Apoio ao luto', valor: 'Textos e contatos de apoio', fundo: colors.background, acao: () => router.push('/apoio-luto') },
  ]

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.topo}>
          <Gradiente de={colors.premiumSurface} ate={colors.surface} />
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.voltar}>
            <Icone nome="seta" size={20} />
          </Pressable>
          <View style={estilos.retrato}>
            {pet.foto_url ? <Image source={{ uri: pet.foto_url }} style={estilos.foto} /> : <Mascote especie={pet.especie} size={170} />}
          </View>
          <Text style={estilos.nome}>{nome}</Text>
          <Text style={estilos.anos}>{anos} · Em memória</Text>
        </View>

        <View style={estilos.corpo}>
          {recente ? (
            <View style={estilos.desfazer}>
              <View style={estilos.flex}>
                <Text style={estilos.desfazerTitulo}>Registrado agora. Foi sem querer?</Text>
                <Text style={estilos.desfazerSub}>Você pode desfazer por 24 horas.</Text>
              </View>
              <Tocavel accessibilityRole="button" onPress={desfazer} style={estilos.desfazerBotao}>
                <Text style={estilos.desfazerBotaoTexto}>Desfazer</Text>
              </Tocavel>
            </View>
          ) : null}

          {memorial.mensagem ? <Text style={estilos.mensagem}>“{memorial.mensagem}”</Text> : null}

          {cartoes.map((c) => (
            <Tocavel key={c.rotulo} accessibilityRole="button" onPress={c.acao} style={[estilos.cartao, { backgroundColor: c.fundo }]}>
              <View style={estilos.cartaoIcone}>
                <Icone nome={c.icone} size={20} />
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.cartaoRotulo}>{c.rotulo}</Text>
                <Text style={estilos.cartaoValor}>{c.valor}</Text>
              </View>
            </Tocavel>
          ))}

          <Text style={estilos.semPressa}>Quando quiser, estaremos aqui. Sem pressa.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/pet/[id]/reativar', params: { id: pet.id } })} hitSlop={10}>
            <Text style={estilos.reativar}>Registrei por engano: reativar {pet.sexo === 'femea' ? 'a' : 'o'} {nome}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 40 },
  topo: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, overflow: 'hidden' },
  voltar: {
    position: 'absolute',
    left: 24,
    top: 56,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
  },
  retrato: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.white,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    shadowColor: '#5B3C8F',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  foto: { width: 210, height: 210 },
  nome: { fontFamily: fontFamily.medium, fontSize: 40, letterSpacing: -1.2, color: colors.black, marginTop: 18 },
  anos: { fontFamily: fontFamily.medium, fontSize: 16, color: colors.premiumText },
  corpo: { paddingHorizontal: 24, gap: 12 },
  desfazer: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF0C9', borderRadius: 26, padding: 14, paddingLeft: 18 },
  desfazerTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: '#4A3800' },
  desfazerSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#7A5A00' },
  desfazerBotao: { backgroundColor: colors.black, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 },
  desfazerBotaoTexto: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.white },
  mensagem: { fontFamily: fontFamily.regular, fontSize: 17, color: '#5E6878', textAlign: 'center', marginVertical: 4 },
  cartao: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 26, padding: 14 },
  cartaoIcone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  cartaoRotulo: { fontFamily: fontFamily.regular, fontSize: 13, color: '#5E6878' },
  cartaoValor: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  semPressa: { fontFamily: fontFamily.regular, fontSize: 14, color: '#6A7484', textAlign: 'center', marginTop: 10 },
  reativar: { fontFamily: fontFamily.bold, fontSize: 14, color: '#6A7484', textAlign: 'center', marginTop: 6 },
})
