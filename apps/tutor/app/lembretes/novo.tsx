import { useEffect, useRef, useState } from 'react'
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
import { router } from 'expo-router'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../src/components/CabecalhoTela'
import { Campo } from '../../src/components/Campo'
import { ControleSegmentado } from '../../src/components/ControleSegmentado'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import type { Repeticao, TipoLembrete } from '../../src/lembretes/types'
import { LEMBRETE_FORM_VAZIO, REPETICOES, TIPOS } from '../../src/lembretes/types'
import { preferenciasAvisos } from '../../src/notificacoes/prefs'
import { colors } from '../../src/theme/colors'
import { typography } from '../../src/theme/typography'
import { radius, spacing } from '../../src/theme/tokens'

const REPETIR_ROTULOS = REPETICOES.map((r) => r.rotulo)

export default function NovoLembrete() {
  const { criarLembrete, salvando } = useLembretes()
  const [form, setForm] = useState(LEMBRETE_FORM_VAZIO)
  const horaEditada = useRef(false)

  // Hora inicial vem da tela Avisos ("Horário dos avisos"); só aplica se o
  // tutor ainda não digitou nada no campo.
  useEffect(() => {
    preferenciasAvisos().then(
      (avisos) => {
        if (!horaEditada.current) {
          setForm((atual) => ({ ...atual, hora: avisos.horario }))
        }
      },
      () => undefined, // sem preferência salva, mantém o padrão do formulário
    )
  }, [])

  const alterar = (campo: keyof typeof form, valor: string | TipoLembrete | Repeticao | null) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const salvar = async () => {
    if (!form.titulo.trim()) {
      Alert.alert('Falta o título', 'Dê um nome ao lembrete (ex.: Vacina V10).')
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

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <CabecalhoTela titulo="Novo lembrete" />

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Tipo</Text>
          <View style={estilos.pills}>
            {TIPOS.map((tipo) => {
              const ativa = form.tipo === tipo.valor
              return (
                <Pressable
                  key={tipo.valor}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => alterar('tipo', tipo.valor)}
                  style={[
                    estilos.pill,
                    { backgroundColor: ativa ? tipo.fundo : colors.surface },
                    !ativa && estilos.pillBorda,
                  ]}
                >
                  <Text style={[estilos.pillTexto, { color: ativa ? tipo.cor : colors.textMuted }]}>
                    {tipo.rotulo}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <Campo
          rotulo="Título"
          placeholder="Ex.: Vacina V10, Consulta…"
          value={form.titulo}
          onChangeText={(v) => alterar('titulo', v)}
        />

        <View style={estilos.linhaDupla}>
          <View style={estilos.metade}>
            <Campo
              rotulo="Data"
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              value={form.data}
              onChangeText={(v) => alterar('data', v)}
            />
          </View>
          <View style={estilos.metade}>
            <Campo
              rotulo="Hora"
              variante="azul"
              placeholder="HH:MM"
              keyboardType="number-pad"
              value={form.hora}
              onChangeText={(v) => {
                horaEditada.current = true
                alterar('hora', v)
              }}
            />
          </View>
        </View>

        <View style={estilos.bloco}>
          <Text style={estilos.rotulo}>Repetir</Text>
          <ControleSegmentado
            opcoes={REPETIR_ROTULOS}
            ativo={REPETICOES.findIndex((r) => r.valor === form.repetir)}
            onSelecionar={(i) => alterar('repetir', REPETICOES[i].valor)}
          />
        </View>

        {form.repetir === 'customizado' ? (
          <Campo
            rotulo="A cada quantos dias"
            variante="verde"
            placeholder="Ex.: 15"
            keyboardType="number-pad"
            value={form.intervalo_dias}
            onChangeText={(v) => alterar('intervalo_dias', v)}
          />
        ) : null}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Criar lembrete" onPress={salvar} carregando={salvando} />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  conteudo: { padding: spacing.xl, paddingBottom: 130, gap: spacing.lg },
  bloco: { gap: spacing.sm },
  rotulo: { ...typography.label, color: colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  pillBorda: { borderWidth: 1, borderColor: colors.borderStrong },
  pillTexto: { ...typography.captionMedium },
  linhaDupla: { flexDirection: 'row', gap: spacing.md },
  metade: { flex: 1 },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
})
