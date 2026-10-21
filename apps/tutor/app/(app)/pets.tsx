import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { IconeBusca } from '../../src/components/Layout'
import { Mascote } from '../../src/components/Mascote'
import { Flutuar } from '../../src/components/Animacoes'
import { AvatarPet } from '../../src/pets/AvatarPet'
import { usePets } from '../../src/pets/PetsProvider'
import { idadeEmAnos } from '../../src/pets/types'
import type { Pet } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'
import { typography } from '../../src/theme/typography'
import { components, shadow, spacing } from '../../src/theme/tokens'

export default function Pets() {
  const { pets, carregando, definirPetAtivo, recarregar } = usePets()
  const [atualizando, setAtualizando] = useState(false)

  const abrirPet = useCallback(
    (pet: Pet) => {
      definirPetAtivo(pet.id)
      router.push({ pathname: '/pet/[id]', params: { id: pet.id } })
    },
    [definirPetAtivo],
  )

  const recarregarLista = useCallback(async () => {
    setAtualizando(true)
    await recarregar()
    setAtualizando(false)
  }, [recarregar])

  const renderItem = ({ item }: { item: Pet }) => {
    const detalhe = [item.raca, idadeEmAnos(item.nascimento)].filter(Boolean).join(' · ')
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${item.nome}`}
        onPress={() => abrirPet(item)}
        style={({ pressed }) => [components.card, estilos.cartao, pressed && estilos.pressionado]}
      >
        <AvatarPet especie={item.especie} foto={item.foto_url} size={52} />
        <View style={estilos.flex}>
          <Text style={estilos.nome}>{item.nome}</Text>
          {detalhe ? <Text style={estilos.detalhe}>{detalhe}</Text> : null}
        </View>
        <Text style={estilos.chevron}>›</Text>
      </Pressable>
    )
  }

  if (carregando) {
    return (
      <View style={estilos.tela}>
        <View style={estilos.centro}>
          <ActivityIndicator color={colors.primaryDeep} />
        </View>
      </View>
    )
  }

  return (
    <View style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>Meus pets</Text>
        <View style={estilos.iconeBusca}>
          <IconeBusca size={18} cor={colors.textMuted} />
        </View>
      </View>

      {pets.length === 0 ? (
        <View style={estilos.centro}>
          <Flutuar><Mascote especie="cao" size={140} /></Flutuar>
          <Text style={estilos.vazioTitulo}>Nenhum pet ainda</Text>
          <Text style={estilos.vazioTexto}>
            Cadastre seu primeiro pet para acompanhar saúde, rotina e locais por perto.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/pet/novo')}
            style={({ pressed }) => [estilos.novoBotao, pressed && estilos.pressionado]}
          >
            <Text style={estilos.novoBotaoTexto}>Cadastrar pet</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={recarregarLista}
              tintColor={colors.primaryDeep}
            />
          }
        />
      )}

      {pets.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cadastrar novo pet"
          onPress={() => router.push('/pet/novo')}
          style={({ pressed }) => [estilos.fab, shadow.floating, pressed && estilos.pressionado]}
        >
          <Text style={estilos.fabSinal}>＋</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  titulo: { ...typography.h1, fontSize: 30, lineHeight: 36, color: colors.black },
  iconeBusca: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  lista: { paddingHorizontal: spacing.xl, paddingBottom: 130, gap: spacing.md },
  cartao: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nome: { ...typography.h3, color: colors.black },
  detalhe: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  chevron: { fontSize: 26, color: colors.textMuted },
  vazioTitulo: { ...typography.h2, color: colors.black, textAlign: 'center' },
  vazioTexto: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  novoBotao: {
    marginTop: spacing.md,
    height: 56,
    paddingHorizontal: spacing.xxl,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  novoBotaoTexto: { ...typography.button, color: colors.white },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: 110,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabSinal: { fontSize: 30, lineHeight: 34, color: colors.black, fontWeight: '400' },
  pressionado: { opacity: 0.7 },
})
