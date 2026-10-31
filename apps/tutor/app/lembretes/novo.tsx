import { useRef, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Tocavel } from '../../src/components/Animacoes'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { Campo } from '../../src/components/Campo'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { Icone, type NomeIcone } from '../../src/components/Icone'
import { MarcaPata } from '../../src/components/MarcaPata'
import { Mascote } from '../../src/components/Mascote'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import type { Repeticao, TipoLembrete } from '../../src/lembretes/types'
import { LEMBRETE_FORM_VAZIO, PLACEHOLDER_TITULO, TIPOS } from '../../src/lembretes/types'
import { ANTECEDENCIAS_MIN, textoAntecedencias } from '../../src/notificacoes/antecedencia'
import { usePets } from '../../src/pets/PetsProvider'
import type { Pet } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'
import { fontFamily } from '../../src/theme/typography'

/** Cartões da primeira etapa (protótipo NovoLembrete). */
type Escolha = {
  chave: string
  rotulo: string
  icone: NomeIcone
  fundo: string
  /** Tipo do lembrete; sem tipo, abre o formulário próprio (vacina, remédio, peso). */
  tipo?: TipoLembrete
}

const ESCOLHAS: Escolha[] = [
  { chave: 'vacina', rotulo: 'Vacina', icone: 'vacina', fundo: '#EADCFB' },
  { chave: 'remedio', rotulo: 'Remédio', icone: 'capsula', fundo: '#FFF0C9' },
  { chave: 'vermifugo', rotulo: 'Vermífugo e antipulgas', icone: 'relogio', fundo: '#D8F2E3', tipo: 'vermifugo' },
  { chave: 'consulta', rotulo: 'Consulta', icone: 'cruz', fundo: '#E0F1FA', tipo: 'consulta' },
  { chave: 'banho', rotulo: 'Banho e tosa', icone: 'gota', fundo: '#FDE0E6', tipo: 'banho_tosa' },
  { chave: 'peso', rotulo: 'Pesar o pet', icone: 'balanca', fundo: '#F3F5F8' },
]

const REPETIR: { valor: Repeticao; rotulo: string; intervalo?: string }[] = [
  { valor: 'nao', rotulo: 'Não repetir' },
  { valor: 'mensal', rotulo: 'Todo mês' },
  { valor: 'customizado', rotulo: 'A cada 15 dias', intervalo: '15' },
  { valor: 'semanal', rotulo: 'Toda semana' },
  { valor: 'anual', rotulo: 'Todo ano' },
  { valor: 'diario', rotulo: 'Todo dia' },
]

function PetChip({ pet, onPress }: { pet: Pet | null; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Escolher o pet" onPress={onPress} style={estilos.petChip}>
      <View style={estilos.petAvatar}>
        {pet ? <Mascote especie={pet.especie} size={30} recorte /> : <Icone nome="cruz" size={14} />}
      </View>
      <Text style={estilos.petChipTexto}>{pet ? `Para ${pet.sexo === 'femea' ? 'a' : 'o'} ${pet.nome}` : 'Todos os pets'} ⌄</Text>
    </Pressable>
  )
}

/**
 * Novo lembrete (protótipos NovoLembrete e Lembrete; board P0 "Novo
 * lembrete: escolha do tipo" e P1 "Lembrete personalizado"): primeiro o
 * tipo em cartões; vacina, remédio e peso vão para os formulários próprios;
 * os demais seguem para título, pet, data, hora, repetição e aviso.
 */
export default function NovoLembrete() {
  const { criarLembrete, salvando } = useLembretes()
  const { pets, petAtivo } = usePets()
  const [etapa, setEtapa] = useState<'tipo' | 'detalhes'>('tipo')
  const [escolha, setEscolha] = useState<Escolha | null>(null)
  const [form, setForm] = useState({ ...LEMBRETE_FORM_VAZIO, pet_id: petAtivo?.id ?? null })
  const [escolhendoPet, setEscolhendoPet] = useState(false)
  const horaEditada = useRef(false)


  const alterar = <K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const pet = form.pet_id ? (pets.find((p) => p.id === form.pet_id) ?? null) : null

  function continuar(alvo: Escolha | 'outro') {
    if (alvo === 'outro') {
      alterar('tipo', 'outro')
      setEtapa('detalhes')
      return
    }
    if (!alvo.tipo) {
      const petId = pet?.id ?? pets[0]?.id
      if (!petId) {
        Alert.alert('Cadastre um pet', 'Vacina, remédio e peso ficam no cadastro do pet.')
        return
      }
      const destino =
        alvo.chave === 'vacina' ? '/pet/[id]/vacina/nova' : alvo.chave === 'remedio' ? '/pet/[id]/remedio/novo' : '/pet/[id]/peso'
      router.replace({ pathname: destino, params: { id: petId } })
      return
    }
    alterar('tipo', alvo.tipo)
    setEtapa('detalhes')
  }

  const salvar = async () => {
    if (!form.titulo.trim()) {
      Alert.alert('Falta o título', 'Dê um nome ao lembrete (ex.: Banho e tosa).')
      return
    }
    if (!form.data.trim()) {
      Alert.alert('Falta a data', 'Informe quando acontece (DD/MM/AAAA).')
      return
    }
    if (form.repetir === 'customizado' && !(Number(form.intervalo_dias) > 0)) {
      Alert.alert('Falta o intervalo', 'Informe a cada quantos dias repete.')
      return
    }
    const lembrete = await criarLembrete(form)
    if (lembrete) router.back()
  }

  const seletorPet = (
    <Modal visible={escolhendoPet} transparent animationType="fade" onRequestClose={() => setEscolhendoPet(false)}>
      <Pressable style={estilos.fundoModal} onPress={() => setEscolhendoPet(false)} accessibilityLabel="Fechar">
        <View style={estilos.folha}>
          <Text style={estilos.folhaTitulo}>Para qual pet?</Text>
          {[null, ...pets].map((p) => (
            <Pressable
              key={p?.id ?? 'todos'}
              accessibilityRole="button"
              onPress={() => {
                alterar('pet_id', p?.id ?? null)
                setEscolhendoPet(false)
              }}
              style={[estilos.opcaoPet, form.pet_id === (p?.id ?? null) && estilos.opcaoPetAtiva]}
            >
              <Text style={estilos.opcaoPetTexto}>{p?.nome ?? 'Todos os pets'}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  )

  if (etapa === 'tipo') {
    return (
      <View style={estilos.tela}>
        <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
          <HeroiOnda titulo="Novo lembrete" altura={230}>
            <View style={estilos.petChipLugar}>
              <PetChip pet={pet} onPress={() => setEscolhendoPet(true)} />
            </View>
          </HeroiOnda>

          <View style={estilos.corpo}>
            <Text style={estilos.pergunta}>O que você quer lembrar?</Text>
            <View style={estilos.grade}>
              {ESCOLHAS.map((item) => {
                const ativo = escolha?.chave === item.chave
                return (
                  <Tocavel
                    key={item.chave}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: ativo }}
                    onPress={() => setEscolha(item)}
                    estiloExterno={estilos.cartaoTipoLugar}
                    style={[estilos.cartaoTipo, { backgroundColor: item.fundo }, ativo && estilos.cartaoTipoAtivo]}
                  >
                    <View style={estilos.cartaoIcone}>
                      <Icone nome={item.icone} size={20} />
                    </View>
                    <Text style={estilos.cartaoTexto}>{item.rotulo}</Text>
                  </Tocavel>
                )
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => continuar('outro')} style={estilos.outro}>
              <Text style={estilos.outroTexto}>+ Outro lembrete (ração, escova, passeio)</Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={estilos.rodape}>
          <BotaoPrimario
            titulo={escolha ? `Continuar com ${escolha.rotulo.toLowerCase()}` : 'Escolha um tipo'}
            desabilitado={!escolha}
            onPress={() => escolha && continuar(escolha)}
          />
        </View>
        {seletorPet}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroiOnda titulo="Novo lembrete" altura={210}>
        </HeroiOnda>

        <View style={estilos.corpo}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.pills}>
            {TIPOS.map((tipo) => {
              const ativa = form.tipo === tipo.valor
              return (
                <Pressable
                  key={tipo.valor}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativa }}
                  onPress={() => alterar('tipo', tipo.valor)}
                  style={[estilos.pill, ativa && estilos.pillAtiva]}
                >
                  <Text style={[estilos.pillTexto, ativa && estilos.pillTextoAtivo]}>{tipo.rotulo}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <Campo
            rotulo="Título"
            variante="roxo"
            placeholder={PLACEHOLDER_TITULO[form.tipo]}
            value={form.titulo}
            onChangeText={(v) => alterar('titulo', v)}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Lembrete para ${pet?.nome ?? 'todos os pets'}`}
            onPress={() => setEscolhendoPet(true)}
            style={({ pressed }) => [estilos.cartaoPet, pressed && { opacity: 0.7 }]}
          >
            <View style={estilos.petAvatarGrande}>
              {pet ? <Mascote especie={pet.especie} size={46} recorte /> : <MarcaPata size={26} cor={colors.black} />}
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.paraRotulo}>Para</Text>
              <Text style={estilos.paraNome}>{pet?.nome ?? 'Todos os pets'}</Text>
            </View>
            <Icone nome="seta" size={18} />
          </Pressable>

          <View style={estilos.linha}>
            <View style={estilos.flex}>
              <Campo
                rotulo="Data"
                variante="amarelo"
                mascara="data"
                placeholder="dd/mm/aaaa"
                value={form.data}
                onChangeText={(v) => alterar('data', v)}
              />
            </View>
            <View style={estilos.flex}>
              <Campo
                rotulo="Hora"
                variante="azul"
                mascara="hora"
                placeholder="09:00"
                value={form.hora}
                onChangeText={(v) => {
                  horaEditada.current = true
                  alterar('hora', v)
                }}
              />
            </View>
          </View>

          <Text style={estilos.pergunta}>Repetir</Text>
          <View style={estilos.pillsQuebra}>
            {REPETIR.map((opcao) => {
              const ativa =
                form.repetir === opcao.valor && (opcao.valor !== 'customizado' || form.intervalo_dias === opcao.intervalo)
              return (
                <Pressable
                  key={opcao.rotulo}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativa }}
                  onPress={() => {
                    alterar('repetir', opcao.valor)
                    alterar('intervalo_dias', opcao.intervalo ?? '')
                  }}
                  style={[estilos.pill, ativa && estilos.pillAtiva]}
                >
                  <Text style={[estilos.pillTexto, ativa && estilos.pillTextoAtivo]}>{opcao.rotulo}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={estilos.aviso}>
            <View style={estilos.flex}>
              <Text style={estilos.avisoTitulo}>Aviso: {textoAntecedencias(ANTECEDENCIAS_MIN[form.tipo]).toLowerCase()}</Text>
              <Text style={estilos.avisoTexto}>Você recebe uma notificação no celular.</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Criar lembrete"
          icone={<Text style={estilos.check}>✓</Text>}
          onPress={salvar}
          carregando={salvando}
        />
      </View>
      {seletorPet}
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 130 },
  pata: { position: 'absolute', right: 24, top: 56 },
  sino: { position: 'absolute', right: 30, top: 44 },
  petChipLugar: { marginTop: 12, marginLeft: 58, alignSelf: 'flex-start' },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
  },
  petAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petChipTexto: { fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.black },
  corpo: { paddingHorizontal: 24, gap: 12 },
  pergunta: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cartaoTipoLugar: { width: '48%', flexGrow: 1 },
  cartaoTipo: {
    height: 92,
    borderRadius: 26,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cartaoTipoAtivo: { borderColor: colors.black },
  cartaoIcone: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartaoTexto: { fontSize: 15, lineHeight: 19, fontFamily: fontFamily.bold, color: colors.black },
  outro: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outroTexto: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.textMuted },
  pills: { gap: 8 },
  pillsQuebra: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  pillAtiva: { backgroundColor: colors.black, borderColor: colors.black },
  pillTexto: { fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.black },
  pillTextoAtivo: { color: colors.white },
  cartaoPet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 10,
    paddingRight: 18,
  },
  petAvatarGrande: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paraRotulo: { fontSize: 12, fontFamily: fontFamily.regular, color: colors.textMuted },
  paraNome: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.black },
  linha: { flexDirection: 'row', gap: 10 },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  avisoTitulo: { fontSize: 16, fontFamily: fontFamily.semiBold, color: colors.black },
  avisoTexto: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted },
  check: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.black },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  folhaTitulo: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.black, marginBottom: 4 },
  opcaoPet: { backgroundColor: colors.surface, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18 },
  opcaoPetAtiva: { backgroundColor: colors.primarySurface },
  opcaoPetTexto: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.black },
})
