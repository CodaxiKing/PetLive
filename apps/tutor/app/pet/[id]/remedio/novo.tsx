import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../../src/components/BotaoPrimario'
import { Campo } from '../../../../src/components/Campo'
import { HeroiOnda } from '../../../../src/components/HeroiOnda'
import { Icone } from '../../../../src/components/Icone'
import { usePets } from '../../../../src/pets/PetsProvider'
import { useRemedios } from '../../../../src/remedios/RemediosProvider'
import { REMEDIO_FORM_VAZIO, hojeComoCampo, parseHorarios } from '../../../../src/remedios/types'
import { mascaraHora } from '../../../../src/lib/mascaras'
import { colors } from '../../../../src/theme/colors'
import { fontFamily } from '../../../../src/theme/typography'

const FORMAS = ['Comprimido', 'Gotas', 'ml', 'Cápsula', 'Pomada', 'Injeção']

/** Frequências do protótipo, com os horários que cada uma sugere. */
const FREQUENCIAS: { rotulo: string; horarios: string[] }[] = [
  { rotulo: '1× ao dia', horarios: ['08:00'] },
  { rotulo: '2× ao dia', horarios: ['08:00', '20:00'] },
  { rotulo: '3× ao dia', horarios: ['08:00', '14:00', '20:00'] },
  { rotulo: 'A cada 8h', horarios: ['06:00', '14:00', '22:00'] },
]

const DURACOES: { rotulo: string; dias: number | null }[] = [
  { rotulo: '7 dias', dias: 7 },
  { rotulo: '14 dias', dias: 14 },
  { rotulo: 'Contínuo', dias: null },
]

const p2 = (n: number) => String(n).padStart(2, '0')

/** Último dia do tratamento a partir de hoje (o 1º dia conta). */
function fimDoTratamento(dias: number): string {
  const fim = new Date()
  fim.setDate(fim.getDate() + dias - 1)
  return `${p2(fim.getDate())}/${p2(fim.getMonth() + 1)}/${fim.getFullYear()}`
}

/**
 * Novo remédio (protótipo Remedio; board P0 "Novo remédio: dose,
 * frequência, horários e duração"): nome, dose e forma, frequência que
 * sugere os horários, horários editáveis e duração. Começa hoje.
 */
export default function NovoRemedio() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const { criarRemedio, salvando } = useRemedios()
  const pet = pets.find((p) => p.id === id) ?? null

  const [nome, setNome] = useState('')
  const [dose, setDose] = useState('')
  const [forma, setForma] = useState('Comprimido')
  const [escolhendoForma, setEscolhendoForma] = useState(false)
  const [frequencia, setFrequencia] = useState(FREQUENCIAS[1])
  const [horarios, setHorarios] = useState<string[]>(FREQUENCIAS[1].horarios)
  const [duracao, setDuracao] = useState(DURACOES[0])
  const [novoHorario, setNovoHorario] = useState<string | null>(null)

  function escolherFrequencia(opcao: (typeof FREQUENCIAS)[number]) {
    setFrequencia(opcao)
    setHorarios(opcao.horarios)
  }

  function adicionarHorario() {
    const [hora] = parseHorarios(novoHorario ?? '')
    if (!hora) {
      Alert.alert('Horário inválido', 'Use o formato HH:MM, por exemplo 14:00.')
      return
    }
    setHorarios((atual) => [...new Set([...atual, hora])].sort())
    setNovoHorario(null)
  }

  const salvar = async () => {
    if (!nome.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do remédio.')
      return
    }
    if (!dose.trim()) {
      Alert.alert('Falta a dose', 'Ex.: "1", "1/2" ou "2 ml".')
      return
    }
    if (horarios.length === 0) {
      Alert.alert('Faltam os horários', 'Adicione ao menos um horário.')
      return
    }
    // "1" + Comprimido -> "1 comprimido"; dose já com unidade fica como está.
    const doseTexto = /^[\d.,/\s]+$/.test(dose.trim()) ? `${dose.trim()} ${forma.toLowerCase()}` : dose.trim()
    const salvo = await criarRemedio({
      ...REMEDIO_FORM_VAZIO,
      nome,
      dose: doseTexto,
      frequencia: frequencia.rotulo.replace('×', 'x'),
      horarios: horarios.join(', '),
      inicio: hojeComoCampo(),
      fim: duracao.dias ? fimDoTratamento(duracao.dias) : '',
    })
    if (salvo) router.back()
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <HeroiOnda titulo="Novo remédio" altura={210}>
          {pet ? <Text style={estilos.paraPet}>Para {pet.sexo === 'femea' ? 'a' : 'o'} {pet.nome}</Text> : null}
          <View style={estilos.capsula}>
            <Icone nome="capsula" size={120} cor={colors.white} espessura={1.2} />
          </View>
        </HeroiOnda>

        <View style={estilos.corpo}>
          <Campo rotulo="Nome do remédio" variante="amarelo" placeholder="Ex.: Antibiótico" value={nome} onChangeText={setNome} />

          <View style={estilos.linha}>
            <View style={estilos.flex}>
              <Campo rotulo="Dose" variante="roxo" placeholder="1" value={dose} onChangeText={setDose} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Forma: ${forma}`}
              onPress={() => setEscolhendoForma(true)}
              style={estilos.forma}
            >
              <Text style={estilos.formaRotulo}>Forma</Text>
              <View style={estilos.formaLinha}>
                <Text style={estilos.formaValor}>{forma}</Text>
                <Text style={estilos.formaSeta}>⌄</Text>
              </View>
            </Pressable>
          </View>

          <Text style={estilos.secao}>Frequência</Text>
          <View style={estilos.pills}>
            {FREQUENCIAS.map((opcao) => {
              const ativa = opcao.rotulo === frequencia.rotulo
              return (
                <Pressable
                  key={opcao.rotulo}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativa }}
                  onPress={() => escolherFrequencia(opcao)}
                  style={[estilos.pill, ativa && estilos.pillAtiva]}
                >
                  <Text style={[estilos.pillTexto, ativa && estilos.pillTextoAtivo]}>{opcao.rotulo}</Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={estilos.secao}>Horários</Text>
          <View style={estilos.pills}>
            {horarios.map((hora) => (
              <Pressable
                key={hora}
                accessibilityRole="button"
                accessibilityHint="Toque para remover"
                onPress={() => setHorarios((atual) => atual.filter((h) => h !== hora))}
                style={estilos.horario}
              >
                <Text style={estilos.horarioTexto}>{hora}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Adicionar horário"
              onPress={() => setNovoHorario('')}
              style={estilos.horarioMais}
            >
              <Text style={estilos.horarioMaisTexto}>+</Text>
            </Pressable>
          </View>

          <Text style={estilos.secao}>Duração</Text>
          <View style={estilos.segmentado}>
            {DURACOES.map((opcao) => {
              const ativa = opcao.rotulo === duracao.rotulo
              return (
                <Pressable
                  key={opcao.rotulo}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativa }}
                  onPress={() => setDuracao(opcao)}
                  style={[estilos.segmento, ativa && estilos.segmentoAtivo]}
                >
                  <Text style={[estilos.segmentoTexto, ativa && estilos.segmentoTextoAtivo]}>{opcao.rotulo}</Text>
                </Pressable>
              )
            })}
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

      <Modal visible={escolhendoForma} transparent animationType="fade" onRequestClose={() => setEscolhendoForma(false)}>
        <Pressable style={estilos.fundoModal} onPress={() => setEscolhendoForma(false)} accessibilityLabel="Fechar">
          <View style={estilos.folha}>
            <Text style={estilos.folhaTitulo}>Forma do remédio</Text>
            <View style={estilos.pills}>
              {FORMAS.map((opcao) => (
                <Pressable
                  key={opcao}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: opcao === forma }}
                  onPress={() => {
                    setForma(opcao)
                    setEscolhendoForma(false)
                  }}
                  style={[estilos.pill, opcao === forma && estilos.pillAtiva]}
                >
                  <Text style={[estilos.pillTexto, opcao === forma && estilos.pillTextoAtivo]}>{opcao}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={novoHorario !== null} transparent animationType="fade" onRequestClose={() => setNovoHorario(null)}>
        <View style={estilos.fundoModal}>
          <View style={estilos.folha}>
            <Text style={estilos.folhaTitulo}>Novo horário</Text>
            <TextInput
              value={novoHorario ?? ''}
              onChangeText={(t) => setNovoHorario(mascaraHora(t))}
              maxLength={5}
              placeholder="HH:MM"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
              style={estilos.entradaHorario}
              accessibilityLabel="Horário"
            />
            <BotaoPrimario titulo="Adicionar" onPress={adicionarHorario} />
            <Pressable accessibilityRole="button" onPress={() => setNovoHorario(null)} hitSlop={8}>
              <Text style={estilos.cancelar}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 130 },
  paraPet: { position: 'absolute', left: 86, top: 68, fontSize: 15, fontFamily: fontFamily.medium, color: colors.black },
  capsula: { position: 'absolute', right: 24, top: 70 },
  corpo: { paddingHorizontal: 24, gap: 12 },
  linha: { flexDirection: 'row', gap: 10 },
  forma: { flex: 1, backgroundColor: colors.primarySurface, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12 },
  formaRotulo: { fontSize: 13, fontFamily: fontFamily.medium, color: colors.primaryDeep },
  formaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  formaValor: { fontSize: 17, fontFamily: fontFamily.medium, color: colors.black },
  formaSeta: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  secao: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black, marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  horario: { borderRadius: 999, backgroundColor: colors.primary, paddingHorizontal: 22, paddingVertical: 12 },
  horarioTexto: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.black },
  horarioMais: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horarioMaisTexto: { fontSize: 22, fontFamily: fontFamily.regular, color: colors.textMuted },
  segmentado: { flexDirection: 'row', backgroundColor: colors.background, borderRadius: 26, padding: 4 },
  segmento: { flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segmentoAtivo: { backgroundColor: colors.black },
  segmentoTexto: { fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  segmentoTextoAtivo: { color: colors.white },
  check: { fontSize: 20, fontFamily: fontFamily.bold, color: colors.black },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: colors.surface,
  },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  folhaTitulo: { fontSize: 18, fontFamily: fontFamily.bold, color: colors.black },
  entradaHorario: {
    fontSize: 24,
    fontFamily: fontFamily.semiBold,
    color: colors.black,
    backgroundColor: colors.primarySurface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  cancelar: { fontSize: 14, fontFamily: fontFamily.medium, color: colors.textMuted, textAlign: 'center' },
})
