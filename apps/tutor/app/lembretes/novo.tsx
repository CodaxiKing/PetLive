import { useEffect, useRef, useState } from 'react'
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
import Svg, { Circle, Path } from 'react-native-svg'
import { BotaoPrimario } from '../../src/components/BotaoPrimario'
import { CabecalhoTela } from '../../src/components/CabecalhoTela'
import { Campo } from '../../src/components/Campo'
import { ControleSegmentado } from '../../src/components/ControleSegmentado'
import { Interruptor } from '../../src/components/Interruptor'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import type { Repeticao, TipoLembrete } from '../../src/lembretes/types'
import { LEMBRETE_FORM_VAZIO, PLACEHOLDER_TITULO, REPETICOES, TIPOS } from '../../src/lembretes/types'
import { AvatarPet } from '../../src/pets/AvatarPet'
import { usePets } from '../../src/pets/PetsProvider'
import { preferenciasAvisos } from '../../src/notificacoes/prefs'
import { colors } from '../../src/theme/colors'
import { fontFamily, typography } from '../../src/theme/typography'
import { radius, spacing } from '../../src/theme/tokens'

const REPETIR_ROTULOS = REPETICOES.map((r) => r.rotulo)

export default function NovoLembrete() {
  const { criarLembrete, salvando } = useLembretes()
  const { pets } = usePets()
  const [form, setForm] = useState(LEMBRETE_FORM_VAZIO)
  const [escolhendoPet, setEscolhendoPet] = useState(false)
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

  const alterar = (campo: keyof typeof form, valor: string | TipoLembrete | Repeticao | boolean | null) =>
    setForm((atual) => ({ ...atual, [campo]: valor }))

  const petEscolhido = form.pet_id ? pets.find((p) => p.id === form.pet_id) ?? null : null

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
          variante="roxo"
          placeholder={PLACEHOLDER_TITULO[form.tipo]}
          value={form.titulo}
          onChangeText={(v) => alterar('titulo', v)}
        />

        {/* Para qual pet (protótipo Lembrete.dc.html: card "Para / Rex"). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Lembrete para ${petEscolhido?.nome ?? 'todos os pets'}`}
          onPress={() => setEscolhendoPet(true)}
          style={({ pressed }) => [estilos.cartaoPet, pressed && { opacity: 0.7 }]}
        >
          {petEscolhido ? (
            <AvatarPet especie={petEscolhido.especie} foto={petEscolhido.foto_url} size={44} />
          ) : (
            <View style={estilos.petGenerico}>
              <Svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.black}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <Circle cx={6} cy={10} r={1.8} />
                <Circle cx={10} cy={6} r={1.8} />
                <Circle cx={14} cy={6} r={1.8} />
                <Circle cx={18} cy={10} r={1.8} />
                <Path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
              </Svg>
            </View>
          )}
          <View style={estilos.flex}>
            <Text style={estilos.petRotulo}>Para</Text>
            <Text style={estilos.petNome} numberOfLines={1}>
              {petEscolhido?.nome ?? 'Todos os pets'}
            </Text>
          </View>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
            <Path
              d="M6 9l6 6 6-6"
              stroke={colors.black}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>

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

        {/* "Avisar 1 dia antes" (protótipo Lembrete.dc.html). */}
        <View style={estilos.cartaoAviso}>
          <View style={estilos.flex}>
            <Text style={estilos.avisoTitulo}>Avisar 1 dia antes</Text>
            <Text style={estilos.avisoSub}>Você recebe uma notificação.</Text>
          </View>
          <Interruptor
            ligado={form.aviso_antes}
            rotulo="Avisar 1 dia antes"
            desabilitado={salvando}
            onToggle={() => alterar('aviso_antes', !form.aviso_antes)}
          />
        </View>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Criar lembrete" onPress={salvar} carregando={salvando} />
      </View>

      {/* Escolher o pet do lembrete */}
      <Modal
        visible={escolhendoPet}
        animationType="slide"
        transparent
        onRequestClose={() => setEscolhendoPet(false)}
      >
        <View style={estilos.fundoModal}>
          <View style={estilos.cartaoModal}>
            <Text style={estilos.tituloModal}>Para qual pet?</Text>

            <ScrollView style={estilos.listaPets} showsVerticalScrollIndicator={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: form.pet_id === null }}
                onPress={() => {
                  alterar('pet_id', null)
                  setEscolhendoPet(false)
                }}
                style={({ pressed }) => [estilos.linhaPet, pressed && { opacity: 0.7 }]}
              >
                <View style={estilos.petGenerico}>
                  <Svg
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.black}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <Circle cx={6} cy={10} r={1.8} />
                    <Circle cx={10} cy={6} r={1.8} />
                    <Circle cx={14} cy={6} r={1.8} />
                    <Circle cx={18} cy={10} r={1.8} />
                    <Path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
                  </Svg>
                </View>
                <Text style={estilos.linhaPetTexto}>Todos os pets</Text>
                {form.pet_id === null ? <Text style={estilos.check}>✓</Text> : null}
              </Pressable>

              {pets.map((pet) => (
                <Pressable
                  key={pet.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.pet_id === pet.id }}
                  onPress={() => {
                    alterar('pet_id', pet.id)
                    setEscolhendoPet(false)
                  }}
                  style={({ pressed }) => [estilos.linhaPet, pressed && { opacity: 0.7 }]}
                >
                  <AvatarPet especie={pet.especie} foto={pet.foto_url} size={40} />
                  <Text style={estilos.linhaPetTexto} numberOfLines={1}>
                    {pet.nome}
                  </Text>
                  {form.pet_id === pet.id ? <Text style={estilos.check}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>

            <View style={estilos.acoesModal}>
              <BotaoPrimario titulo="Fechar" onPress={() => setEscolhendoPet(false)} />
            </View>
          </View>
        </View>
      </Modal>
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
  cartaoPet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 8,
    paddingRight: 14,
  },
  petGenerico: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CFE8FB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  petRotulo: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted },
  petNome: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.black },
  cartaoAviso: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avisoTitulo: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  avisoSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  cartaoModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  tituloModal: { ...typography.h3, color: colors.text },
  listaPets: { maxHeight: 360 },
  linhaPet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linhaPetTexto: { flex: 1, fontSize: 16, fontFamily: fontFamily.semiBold, color: colors.text },
  check: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.primaryDeep },
  acoesModal: { marginTop: spacing.sm },
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
