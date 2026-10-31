import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { Interruptor } from '../../../src/components/Interruptor'
import { mensagemDeErro } from '../../../src/lib/cacheOffline'
import {
  acessosAtivos,
  criarAcesso,
  DURACOES,
  mensagemCuidador,
  revogarAcesso,
  type AcessoCuidador,
} from '../../../src/pets/cuidador'
import { quando } from '../../../src/pets/linkCarteirinha'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'
import { textoDeErro } from '../../../src/lib/erros'

const PERMISSOES = [
  { chave: 'vacinas', titulo: 'Vacinas e vermífugo', descricao: 'Datas e próximas doses' },
  { chave: 'remedios', titulo: 'Remédios e horários', descricao: 'Com marcar dose dada' },
  { chave: 'contatos', titulo: 'Alergias e contatos de emergência', descricao: 'Do tutor e do veterinário' },
] as const
type Permissao = (typeof PERMISSOES)[number]['chave']

/**
 * Cuidador temporário (protótipo Cuidador): o tutor escolhe os pets, o prazo,
 * quem cuida e o que essa pessoa vê, e manda o link. Em "Quem tem acesso
 * agora" dá para reenviar ou revogar. O acesso termina sozinho.
 */
export default function TelaCuidador() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const [escolhidos, setEscolhidos] = useState<Set<string>>(() => new Set(id ? [id] : []))
  const [duracao, setDuracao] = useState(1)
  const [cuidador, setCuidador] = useState('')
  const [ver, setVer] = useState<Record<Permissao, boolean>>({ vacinas: true, remedios: true, contatos: true })
  const [acessos, setAcessos] = useState<AcessoCuidador[]>([])
  const [salvando, setSalvando] = useState(false)
  // Base da prévia "termina sexta às 14:00" (o acesso de verdade começa ao gerar).
  const [abertaEm] = useState(() => Date.now())

  const carregar = useCallback(() => {
    acessosAtivos().then(setAcessos, () => setAcessos([]))
  }, [])
  useFocusEffect(carregar)

  const nomePets = (ids: string[]) =>
    pets
      .filter((p) => ids.includes(p.id))
      .map((p) => `${p.sexo === 'femea' ? 'da' : 'do'} ${p.nome}`)
      .join(' e ')

  function alternarPet(petId: string) {
    setEscolhidos((atual) => {
      const nova = new Set(atual)
      if (nova.has(petId)) nova.delete(petId)
      else nova.add(petId)
      return nova
    })
  }

  async function enviar(codigo: string, fim: string, ids: string[]) {
    await Share.share({ title: 'Acesso de cuidador', message: mensagemCuidador(nomePets(ids), codigo, fim) }).catch(() => undefined)
  }

  async function gerar() {
    const ids = [...escolhidos]
    setSalvando(true)
    try {
      const fim = new Date(Date.now() + DURACOES[duracao].horas * 3_600_000)
      const acesso = await criarAcesso({ pets: ids, cuidador, fim, ...ver })
      setCuidador('')
      carregar()
      await enviar(acesso.codigo, acesso.fim, ids)
    } catch (e) {
      Alert.alert('Não deu para criar o acesso', mensagemDeErro(textoDeErro(e)))
    } finally {
      setSalvando(false)
    }
  }

  function revogar(a: AcessoCuidador) {
    Alert.alert(`Revogar o acesso de ${a.cuidador}?`, 'O link para de funcionar na hora.', [
      { text: 'Manter', style: 'cancel' },
      {
        text: 'Revogar',
        style: 'destructive',
        onPress: () => revogarAcesso(a.id).then(carregar, (e) => Alert.alert('Não deu para revogar', textoDeErro(e))),
      },
    ])
  }

  const fimPrevisto = new Date(abertaEm + DURACOES[duracao].horas * 3_600_000).toISOString()
  const pronto = escolhidos.size > 0 && cuidador.trim().length >= 2

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda titulo="Cuidador temporário" subtitulo="Compartilhar" altura={200} />
      <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={estilos.campo}>
          <Text style={estilos.rotulo}>{pets.length > 1 ? 'Pets' : 'Pet'}</Text>
          <View style={estilos.chips}>
            {pets.map((p) => {
              const ativo = escolhidos.has(p.id)
              return (
                <Tocavel
                  key={p.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ativo }}
                  onPress={() => alternarPet(p.id)}
                  style={[estilos.chip, ativo && estilos.chipAtivo]}
                >
                  <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>{p.nome}</Text>
                </Tocavel>
              )
            })}
          </View>
        </View>

        <View style={estilos.campo}>
          <Text style={estilos.rotulo}>Período do acesso · termina {quando(fimPrevisto)}</Text>
          <View style={estilos.chips}>
            {DURACOES.map((d, i) => (
              <Tocavel
                key={d.rotulo}
                accessibilityRole="radio"
                accessibilityState={{ selected: i === duracao }}
                onPress={() => setDuracao(i)}
                style={[estilos.chip, i === duracao && estilos.chipAtivo]}
              >
                <Text style={[estilos.chipTexto, i === duracao && estilos.chipTextoAtivo]}>{d.rotulo}</Text>
              </Tocavel>
            ))}
          </View>
        </View>

        <View style={estilos.campo}>
          <Text style={estilos.rotulo}>Cuidador</Text>
          <TextInput
            value={cuidador}
            onChangeText={setCuidador}
            placeholder="Nome de quem vai cuidar"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Nome do cuidador"
            maxLength={80}
            style={estilos.entrada}
          />
        </View>

        <Text style={estilos.secao}>O que o cuidador pode ver</Text>
        {PERMISSOES.map((p) => (
          <View key={p.chave} style={estilos.item}>
            <View style={estilos.flex}>
              <Text style={estilos.itemTitulo}>{p.titulo}</Text>
              <Text style={estilos.itemSub}>{p.descricao}</Text>
            </View>
            <Interruptor ligado={ver[p.chave]} rotulo={p.titulo} onToggle={() => setVer((v) => ({ ...v, [p.chave]: !v[p.chave] }))} />
          </View>
        ))}

        {acessos.length > 0 ? (
          <>
            <Text style={estilos.secao}>Quem tem acesso agora</Text>
            {acessos.map((a) => (
              <View key={a.id} style={estilos.acesso}>
                <View style={estilos.flex}>
                  <Text style={estilos.acessoTitulo}>
                    {a.cuidador} · até {quando(a.fim)}
                  </Text>
                  <Text style={estilos.acessoSub}>
                    {a.aberturas === 0 ? 'Ainda não abriu o link' : `Abriu ${a.aberturas} ${a.aberturas === 1 ? 'vez' : 'vezes'}`}
                  </Text>
                  <Tocavel accessibilityRole="button" onPress={() => enviar(a.codigo, a.fim, a.pet_ids)}>
                    <Text style={estilos.acessoLink}>Enviar o link de novo</Text>
                  </Tocavel>
                </View>
                <Tocavel accessibilityRole="button" accessibilityLabel={`Revogar o acesso de ${a.cuidador}`} onPress={() => revogar(a)}>
                  <Text style={estilos.revogar}>Revogar</Text>
                </Tocavel>
              </View>
            ))}
          </>
        ) : null}
        <Text style={estilos.nota}>
          O acesso termina sozinho e você é avisado um dia antes e a cada dose marcada. O cuidador não edita nada nem vê seus outros pets.
        </Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Gerar acesso"
          carregando={salvando}
          desabilitado={!pronto}
          icone={salvando ? <ActivityIndicator /> : <Icone nome="escudo" size={22} espessura={2} />}
          onPress={gerar}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  campo: { backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: '#566070' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white },
  chipAtivo: { backgroundColor: colors.black },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  chipTextoAtivo: { color: colors.white },
  entrada: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black, paddingVertical: 2 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 16 },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  itemSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#566070' },
  acesso: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySurface, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
  acessoTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  acessoSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.primaryDeep },
  acessoLink: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black, textDecorationLine: 'underline', marginTop: 4 },
  revogar: { fontFamily: fontFamily.bold, fontSize: 14, color: '#B3173A' },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#566070', marginTop: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
