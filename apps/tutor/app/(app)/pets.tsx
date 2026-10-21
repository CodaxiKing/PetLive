import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { Flutuar, Surgir } from '../../src/components/Animacoes'
import { HeroiOnda } from '../../src/components/HeroiOnda'
import { MarcaPata } from '../../src/components/MarcaPata'
import { Mascote } from '../../src/components/Mascote'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import { rotuloProximidade } from '../../src/lembretes/types'
import { coresDoPet } from '../../src/pets/coresPet'
import { usePets } from '../../src/pets/PetsProvider'
import { idadeEmAnos } from '../../src/pets/types'
import type { Pet } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'
import { fontFamily, typography } from '../../src/theme/typography'

/** "Vermífugo da Mia" -> "Vermífugo": no cartão da Mia o nome já está no topo. */
function tituloSemPet(titulo: string, nome: string): string {
  for (const ligacao of [' do ', ' da ', ' dos ', ' das ']) {
    const sufixo = `${ligacao}${nome}`
    if (titulo.toLowerCase().endsWith(sufixo.toLowerCase())) return titulo.slice(0, -sufixo.length)
  }
  return titulo
}

/**
 * Meus pets (protótipo MeusPets; board P0 "Lista Meus pets"): herói com a
 * contagem e o botão de adicionar, um cartão colorido por pet com raça,
 * idade, o próximo lembrete e o mascote (ou a foto), e "Adicionar pet".
 */
export default function Pets() {
  const { pets, carregando, definirPetAtivo, recarregar } = usePets()
  const { lembretes } = useLembretes()
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

  const contagem =
    pets.length === 0 ? 'Nenhum pet ainda' : pets.length === 1 ? '1 pet cadastrado' : `${pets.length} pets cadastrados`

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={contagem} titulo="Meus pets" semVoltar altura={210}>
        <MarcaPata size={120} style={estilos.pata} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cadastrar novo pet"
          hitSlop={8}
          onPress={() => router.push('/pet/novo')}
          style={({ pressed }) => [estilos.mais, pressed && { opacity: 0.7 }]}
        >
          <Text style={estilos.maisSinal}>+</Text>
        </Pressable>
      </HeroiOnda>

      {carregando ? (
        <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
      ) : (
        <ScrollView
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={atualizando} onRefresh={recarregarLista} tintColor={colors.primaryDeep} />
          }
        >
          {pets.length === 0 ? (
            <View style={estilos.vazio}>
              <Flutuar>
                <Mascote especie="cao" size={140} />
              </Flutuar>
              <Text style={estilos.vazioTexto}>
                Cadastre seu primeiro pet para acompanhar saúde, rotina e lugares por perto.
              </Text>
            </View>
          ) : null}

          {pets.map((pet, indice) => {
            const cores = coresDoPet(pet, indice)
            const idade = idadeEmAnos(pet.nascimento)
            const raca = pet.raca || (pet.especie === 'gato' ? 'Gato' : 'Cão')
            const proximo = lembretes.find((l) => l.pet_id === pet.id)
            return (
              <Surgir key={pet.id} indice={indice}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${pet.nome}`}
                  onPress={() => abrirPet(pet)}
                  style={({ pressed }) => [
                    estilos.cartao,
                    { backgroundColor: cores.fundo, borderColor: cores.borda },
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={estilos.cartaoTexto}>
                    <Text style={estilos.nome} numberOfLines={1}>
                      {pet.nome}
                    </Text>
                    <View style={estilos.chips}>
                      <Text style={estilos.chip} numberOfLines={1}>
                        {raca}
                      </Text>
                      {idade ? <Text style={estilos.chip}>{idade}</Text> : null}
                    </View>
                    {proximo ? (
                      <Text style={estilos.lembrete} numberOfLines={1}>
                        {tituloSemPet(proximo.titulo, pet.nome)} {rotuloProximidade(proximo.proxima_em).texto}
                      </Text>
                    ) : null}
                  </View>

                  <View style={estilos.retrato}>
                    {pet.foto_url ? (
                      <Image source={{ uri: pet.foto_url }} style={estilos.foto} accessibilityLabel={`Foto de ${pet.nome}`} />
                    ) : (
                      <Mascote especie={pet.especie} size={180} recorte />
                    )}
                  </View>
                </Pressable>
              </Surgir>
            )
          })}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/pet/novo')}
            style={({ pressed }) => [estilos.adicionar, pressed && { opacity: 0.7 }]}
          >
            <Text style={estilos.adicionarTexto}>+   Adicionar pet</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  pata: { position: 'absolute', right: 70, top: 96 },
  mais: {
    position: 'absolute',
    right: 24,
    top: 56,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maisSinal: { fontFamily: fontFamily.regular, fontSize: 28, lineHeight: 32, color: colors.black },
  carregando: { marginTop: 40 },
  lista: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120, gap: 14 },
  vazio: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  vazioTexto: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  cartao: {
    height: 172,
    borderRadius: 32,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cartaoTexto: { flex: 1, paddingLeft: 20, paddingTop: 22, paddingBottom: 18, gap: 8, zIndex: 1 },
  nome: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontFamily: typography.h1.fontFamily,
    color: colors.black,
  },
  chips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    fontSize: 13,
    fontFamily: typography.captionMedium.fontFamily,
    color: colors.black,
    backgroundColor: colors.white,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lembrete: {
    marginTop: 'auto',
    alignSelf: 'flex-start',
    fontSize: 13,
    fontFamily: typography.label.fontFamily,
    color: colors.black,
    backgroundColor: colors.primary,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retrato: { width: 150, alignItems: 'center', justifyContent: 'flex-end' },
  foto: { width: 132, height: 132, borderRadius: 66, marginBottom: 20 },
  adicionar: {
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adicionarTexto: { fontSize: 16, fontFamily: typography.captionMedium.fontFamily, color: colors.textMuted },
})
