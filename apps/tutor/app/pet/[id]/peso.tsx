import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Campo } from '../../../src/components/Campo'
import { usePets } from '../../../src/pets/PetsProvider'
import { GraficoPeso } from '../../../src/saude/GraficoPeso'
import {
  carregarPesos,
  formatarKg,
  kgParaNumero,
  registrarPeso,
  variacaoSeisMeses,
  type RegistroPeso,
} from '../../../src/saude/peso'
import { dataParaExibicao } from '../../../src/saude/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily, typography } from '../../../src/theme/typography'
import { shadow, spacing } from '../../../src/theme/tokens'

/**
 * Peso do pet (board: [APP-CLIENTE] "Registrar peso" e "Peso: gráfico e
 * histórico"). Segue o protótipo Peso.dc.html: herói com o peso atual,
 * gráfico de evolução, histórico e campo verde de novo peso.
 */
export default function TelaPeso() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, recarregar } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null

  const [registros, setRegistros] = useState<RegistroPeso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [novo, setNovo] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!id) return
    carregarPesos(id).then(
      (regs) => {
        setRegistros(regs)
        setCarregando(false)
      },
      () => {
        Alert.alert('Não foi possível carregar', 'Confira sua conexão e tente novamente.')
        setCarregando(false)
      },
    )
  }, [id])

  const atual = registros.length > 0 ? registros[registros.length - 1] : null
  const variacao = variacaoSeisMeses(registros)
  const maisRecentes = [...registros].reverse()

  async function salvar() {
    const kg = kgParaNumero(novo)
    if (kg == null) {
      Alert.alert('Peso inválido', 'Digite um valor de 0,1 a 299,9 (ex.: 4,2).')
      return
    }

    setSalvando(true)
    try {
      await registrarPeso(id, kg)
      const regs = await carregarPesos(id)
      setRegistros(regs)
      setNovo('')
      // Atualiza o peso_atual exibido no resumo e na ficha do pet.
      await recarregar()
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={estilos.hero}>
        <HeroiOnda titulo={`Peso ${pet?.sexo === 'femea' ? 'da' : 'do'} ${pet?.nome ?? 'pet'}`} />

        <View style={estilos.heroConteudo}>
          <Text style={estilos.sobre}>Peso atual</Text>
          <Text style={estilos.kg} accessibilityRole="header">
            {carregando ? '—' : atual ? formatarKg(atual.peso) : '—'}
            <Text style={estilos.kgUnidade}> kg</Text>
          </Text>

          {variacao ? (
            <View style={estilos.pill}>
              <Text style={estilos.pillTexto}>{variacao.texto}</Text>
            </View>
          ) : null}
        </View>

      </View>

      <ScrollView
        style={estilos.flex}
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {carregando ? (
          <View style={estilos.centro}>
            <ActivityIndicator color={colors.primaryDeep} />
          </View>
        ) : (
          <>
            <GraficoPeso registros={registros} />

            {maisRecentes.length > 0 ? (
              <View style={estilos.historico}>
                {maisRecentes.map((r) => (
                  <View key={r.id} style={estilos.linhaPeso}>
                    <Text style={estilos.linhaData}>{dataParaExibicao(r.medido_em)}</Text>
                    <Text style={estilos.linhaKg}>{formatarKg(r.peso)} kg</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Campo
              rotulo="Novo peso (kg)"
              variante="verde"
              placeholder="0,0"
              keyboardType="decimal-pad"
              value={novo}
              onChangeText={setNovo}
              editable={!salvando}
            />

            <Text style={estilos.dica}>
              Quem mede hoje atualiza o peso do pet e entra no histórico.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Registrar peso"
          icone={<Text style={estilos.maisCta}>+</Text>}
          onPress={salvar}
          carregando={salvando}
          desabilitado={carregando}
        />
      </View>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  hero: {
    paddingBottom: 12,
  },
  pata: { position: 'absolute', right: 30, top: 60 },
  maisCta: { fontFamily: fontFamily.regular, fontSize: 28, lineHeight: 32, color: colors.black },
  sobre: { ...typography.captionMedium, color: colors.textMuted, marginBottom: -spacing.sm },
  // Versão 2: o peso atual num cartão branco.
  heroConteudo: {
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 24,
    ...shadow.card,
  },
  kg: {
    ...typography.h1,
    fontFamily: fontFamily.bold,
    fontSize: 52,
    lineHeight: 60,
    letterSpacing: -2.5,
    color: colors.black,
  },
  kgUnidade: {
    fontFamily: fontFamily.regular,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillTexto: {
    ...typography.small,
    fontFamily: fontFamily.bold,
    color: colors.text,
  },
  conteudo: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 130,
    gap: spacing.md,
  },
  centro: { paddingVertical: spacing.xxl, alignItems: 'center' },
  historico: { gap: spacing.sm },
  linhaPeso: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: spacing.md,
  },
  linhaData: { ...typography.bodyMedium, fontFamily: fontFamily.semiBold, color: colors.text },
  linhaKg: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.text },
  dica: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
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
