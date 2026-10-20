import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CabecalhoTela } from '../../../src/components/CabecalhoTela'
import { Mascote } from '../../../src/components/Mascote'
import { AbaCalendario } from '../../../src/pets/AbaCalendario'
import { AbaGeral } from '../../../src/pets/AbaGeral'
import { AbaSaude } from '../../../src/pets/AbaSaude'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { typography } from '../../../src/theme/typography'
import { radius, spacing } from '../../../src/theme/tokens'

const ABAS = ['Geral', 'Saúde', 'Calendário'] as const
type Aba = (typeof ABAS)[number]

export default function PetDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, definirPetAtivo, removerPet, salvando } = usePets()
  const [aba, setAba] = useState<Aba>('Geral')

  const pet = pets.find((p) => p.id === id) ?? null

  // Mantém o pet selecionado em sincronia com a rota (alimenta Início/Saúde).
  useEffect(() => {
    if (pet) definirPetAtivo(pet.id)
  }, [pet, definirPetAtivo])

  if (!pet) {
    return (
      <View style={estilos.tela}>
        <CabecalhoTela titulo="Pet" />
        <Text style={estilos.aviso}>Pet não encontrado.</Text>
      </View>
    )
  }

  const confirmarExclusao = () => {
    Alert.alert(
      `Excluir ${pet.nome}?`,
      'Isso apaga também os vacinas, remédios e compromissos deste pet. Não dá para desfazer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const ok = await removerPet(pet.id)
            if (ok) router.back()
          },
        },
      ],
    )
  }

  return (
    <View style={estilos.tela}>
      <CabecalhoTela titulo={pet.nome} acao="Editar" onAcao={() => router.push({ pathname: '/pet/[id]/editar', params: { id: pet.id } })} />

      <View style={estilos.topo}>
        <View style={estilos.avatar}>
          <Mascote especie={pet.especie} size={72} recorte />
        </View>

        <View style={estilos.abas}>
          {ABAS.map((op) => {
            const ativa = op === aba
            return (
              <Pressable
                key={op}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                onPress={() => setAba(op)}
                style={[estilos.aba, ativa && estilos.abaAtiva]}
              >
                <Text style={[estilos.abaTexto, ativa && estilos.abaTextoAtivo]}>{op}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={estilos.flex}>
        {aba === 'Geral' && <AbaGeral />}
        {aba === 'Saúde' && <AbaSaude />}
        {aba === 'Calendário' && <AbaCalendario />}
      </View>

      <View style={estilos.rodape}>
        <Pressable
          accessibilityRole="button"
          onPress={confirmarExclusao}
          disabled={salvando}
          style={({ pressed }) => [estilos.excluir, pressed && estilos.pressionado]}
        >
          <Text style={estilos.excluirTexto}>Excluir pet</Text>
        </Pressable>
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySurface,
    overflow: 'hidden',
  },
  abas: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.disabled,
    borderRadius: 26,
    padding: 4,
  },
  aba: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  abaAtiva: { backgroundColor: colors.black },
  abaTexto: { ...typography.captionMedium, color: colors.textMuted },
  abaTextoAtivo: { color: colors.white },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  aviso: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  rodape: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 32,
  },
  excluir: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dangerSurface,
  },
  pressionado: { opacity: 0.6 },
  excluirTexto: { ...typography.button, color: colors.danger },
})
