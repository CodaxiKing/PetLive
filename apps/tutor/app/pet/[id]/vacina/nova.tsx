import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../../src/components/BotaoPrimario'
import { Campo } from '../../../../src/components/Campo'
import { HeroiOnda } from '../../../../src/components/HeroiOnda'
import { Interruptor } from '../../../../src/components/Interruptor'
import { MarcaPata } from '../../../../src/components/MarcaPata'
import { Mascote } from '../../../../src/components/Mascote'
import { useLembretes } from '../../../../src/lembretes/LembretesProvider'
import { LEMBRETE_FORM_VAZIO } from '../../../../src/lembretes/types'
import { usePets } from '../../../../src/pets/PetsProvider'
import { somenteParaEditavel } from '../../../../src/pets/SomenteLeitura'
import { useVacinas } from '../../../../src/saude/VacinasProvider'
import type { VacinaForm } from '../../../../src/saude/types'
import { VACINA_FORM_VAZIO, dataParaExibicao, dataParaIso, hojeComoCampo } from '../../../../src/saude/types'
import { colors } from '../../../../src/theme/colors'
import { fontFamily } from '../../../../src/theme/typography'

const p2 = (n: number) => String(n).padStart(2, '0')
const campoDe = (d: Date) => `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`

/** Data do campo ('DD/MM/AAAA') + dias, ou hoje + dias quando o campo está vazio. */
function somarAoCampo(campo: string, dias: number): string {
  const iso = dataParaIso(campo)
  const base = iso ? new Date(`${iso}T12:00:00`) : new Date()
  base.setDate(base.getDate() + dias)
  return campoDe(base)
}

function Atalho({ rotulo, ativo, onPress }: { rotulo: string; ativo: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      onPress={onPress}
      hitSlop={4}
      style={[estilos.atalho, ativo && estilos.atalhoAtivo]}
    >
      <Text style={[estilos.atalhoTexto, ativo && estilos.atalhoTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  )
}

/**
 * Registrar vacina (protótipo Vacina; board P0 "Registrar vacina (escolha,
 * datas, atalhos e observação)"): vacinas sugeridas para a espécie, datas
 * com atalhos (hoje, ontem, em 1 ano, em 3 semanas), observação e o
 * lembrete da próxima dose.
 */
function NovaVacina() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const { sugeridas, registrarVacina, salvando, sugerirProximaDose } = useVacinas()
  const { criarLembrete } = useLembretes()

  const pet = pets.find((p) => p.id === id) ?? null
  const [form, setForm] = useState<VacinaForm>({ ...VACINA_FORM_VAZIO, aplicada_em: hojeComoCampo() })
  const [nomeCustomizado, setNomeCustomizado] = useState(false)
  const [lembrar, setLembrar] = useState(true)

  const alterar = (campo: keyof VacinaForm, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }))

  const escolherSugestao = (nome: string) => {
    setNomeCustomizado(false)
    setForm((atual) => {
      // A sugestão trabalha em ISO; o campo, em DD/MM/AAAA.
      const aplicadaIso = dataParaIso(atual.aplicada_em || hojeComoCampo())
      const proximaIso = aplicadaIso ? sugerirProximaDose(nome, aplicadaIso) : null
      return { ...atual, nome, proxima_dose: proximaIso ? dataParaExibicao(proximaIso) : atual.proxima_dose }
    })
  }

  const salvar = async () => {
    if (!form.nome.trim()) {
      Alert.alert('Falta o nome', 'Escolha uma vacina ou digite o nome dela.')
      return
    }
    if (!dataParaIso(form.aplicada_em)) {
      Alert.alert('Falta a data', 'Informe quando a vacina foi aplicada (DD/MM/AAAA).')
      return
    }
    const vacina = await registrarVacina(form)
    if (!vacina) return
    if (lembrar && pet && dataParaIso(form.proxima_dose)) {
      await criarLembrete({
        ...LEMBRETE_FORM_VAZIO,
        tipo: 'vacina',
        titulo: `Vacina ${form.nome.trim()}`,
        pet_id: pet.id,
        data: form.proxima_dose,
      })
    }
    router.back()
  }

  const hoje = hojeComoCampo()
  const ontem = somarAoCampo(hoje, -1)
  const emUmAno = somarAoCampo(form.aplicada_em, 365)
  const emTresSemanas = somarAoCampo(form.aplicada_em, 21)

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HeroiOnda titulo="Registrar vacina" altura={230}>
          <MarcaPata size={110} style={estilos.pata} />
          {pet ? (
            <View style={estilos.petChip}>
              <View style={estilos.petAvatar}>
                <Mascote especie={pet.especie} size={30} recorte />
              </View>
              <Text style={estilos.petChipTexto}>
                Para {pet.sexo === 'femea' ? 'a' : 'o'} {pet.nome}
              </Text>
            </View>
          ) : null}
        </HeroiOnda>

        <View style={estilos.corpo}>
          <Text style={estilos.pergunta}>Qual vacina?</Text>
          <View style={estilos.pills}>
            {sugeridas.map((sugestao) => {
              const ativa = !nomeCustomizado && form.nome === sugestao.nome
              return (
                <Pressable
                  key={sugestao.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => escolherSugestao(sugestao.nome)}
                  style={[estilos.pill, ativa && estilos.pillAtiva]}
                >
                  <Text style={[estilos.pillTexto, ativa && estilos.pillTextoAtivo]}>{sugestao.nome}</Text>
                </Pressable>
              )
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: nomeCustomizado }}
              onPress={() => {
                setNomeCustomizado(true)
                alterar('nome', '')
              }}
              style={[estilos.pill, estilos.pillOutra, nomeCustomizado && estilos.pillAtiva]}
            >
              <Text style={[estilos.pillTexto, estilos.pillOutraTexto, nomeCustomizado && estilos.pillTextoAtivo]}>
                + Outra
              </Text>
            </Pressable>
          </View>

          {nomeCustomizado ? (
            <Campo
              rotulo="Nome da vacina"
              placeholder="Ex.: Leishmaniose"
              value={form.nome}
              onChangeText={(v) => alterar('nome', v)}
              autoFocus
            />
          ) : null}

          <View style={estilos.datas}>
            <View style={estilos.data}>
              <Campo
                rotulo="Data aplicada"
                variante="roxo"
                mascara="data"
                placeholder="dd/mm/aaaa"
                value={form.aplicada_em}
                onChangeText={(v) => alterar('aplicada_em', v)}
              />
              <View style={estilos.atalhos}>
                <Atalho rotulo="Hoje" ativo={form.aplicada_em === hoje} onPress={() => alterar('aplicada_em', hoje)} />
                <Atalho rotulo="Ontem" ativo={form.aplicada_em === ontem} onPress={() => alterar('aplicada_em', ontem)} />
              </View>
            </View>
            <View style={estilos.data}>
              <Campo
                rotulo="Próxima dose"
                variante="amarelo"
                mascara="data"
                placeholder="dd/mm/aaaa"
                value={form.proxima_dose}
                onChangeText={(v) => alterar('proxima_dose', v)}
              />
              <View style={estilos.atalhos}>
                <Atalho
                  rotulo="Em 1 ano"
                  ativo={form.proxima_dose === emUmAno}
                  onPress={() => alterar('proxima_dose', emUmAno)}
                />
                <Atalho
                  rotulo="Em 3 sem."
                  ativo={form.proxima_dose === emTresSemanas}
                  onPress={() => alterar('proxima_dose', emTresSemanas)}
                />
              </View>
            </View>
          </View>

          <Campo
            rotulo="Observação"
            variante="verde"
            placeholder="Lote, clínica, reações"
            value={form.observacao}
            onChangeText={(v) => alterar('observacao', v)}
            multiline
          />

          <View style={estilos.lembrar}>
            <View style={estilos.flex}>
              <Text style={estilos.lembrarTitulo}>Lembrar da próxima dose</Text>
              <Text style={estilos.lembrarTexto}>Você recebe uma notificação antes.</Text>
            </View>
            <Interruptor ligado={lembrar} onToggle={() => setLembrar((v) => !v)} rotulo="Lembrar da próxima dose" />
          </View>
        </View>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Salvar vacina"
          icone={<Text style={estilos.check}>✓</Text>}
          onPress={salvar}
          carregando={salvando}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 130 },
  pata: { position: 'absolute', right: 24, top: 56 },
  petChip: {
    position: 'absolute',
    left: 24,
    top: 160,
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
  },
  petChipTexto: { fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.black },
  corpo: { paddingHorizontal: 24, gap: 12 },
  pergunta: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  pillAtiva: { backgroundColor: colors.black, borderColor: colors.black },
  pillOutra: { borderStyle: 'dashed', borderColor: colors.borderStrong },
  pillTexto: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.black },
  pillOutraTexto: { color: colors.textMuted },
  pillTextoAtivo: { color: colors.white },
  datas: { flexDirection: 'row', gap: 10 },
  data: { flex: 1, gap: 8 },
  atalhos: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  atalho: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.background },
  atalhoAtivo: { backgroundColor: colors.black },
  atalhoTexto: { fontSize: 13, fontFamily: fontFamily.semiBold, color: colors.black },
  atalhoTextoAtivo: { color: colors.white },
  lembrar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  lembrarTitulo: { fontSize: 16, fontFamily: fontFamily.semiBold, color: colors.black },
  lembrarTexto: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted },
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
})

export default somenteParaEditavel(NovaVacina)
