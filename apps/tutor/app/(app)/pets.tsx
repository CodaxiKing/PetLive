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
import { Plus } from 'phosphor-react-native/src/icons/Plus'
import { Flutuar, Surgir, Tocavel } from '../../src/components/Animacoes'
import { Mascote } from '../../src/components/Mascote'
import { useLembretes } from '../../src/lembretes/LembretesProvider'
import { rotuloProximidade } from '../../src/lembretes/types'
import { coresDoPet } from '../../src/pets/coresPet'
import { usePets } from '../../src/pets/PetsProvider'
import { idadeEmAnos } from '../../src/pets/types'
import type { Pet } from '../../src/pets/types'
import { colors } from '../../src/theme/colors'
import { shadow } from '../../src/theme/tokens'
import { fontFamily, typography } from '../../src/theme/typography'
import { useLimitesPlano } from '../../src/premium/useLimitesPlano'
import { AvisoLimitesPlano } from '../../src/premium/AvisoLimitesPlano'
import { limiteCadastroAtingido } from '../../src/premium/limites'

/** "Vermífugo da Mia" -> "Vermífugo": no cartão da Mia o nome já está no topo. */
function tituloSemPet(titulo: string, nome: string): string {
  for (const ligacao of [' do ', ' da ', ' dos ', ' das ']) {
    const sufixo = `${ligacao}${nome}`
    if (titulo.toLowerCase().endsWith(sufixo.toLowerCase())) return titulo.slice(0, -sufixo.length)
  }
  return titulo
}

/**
 * Meus pets (versão 2 do protótipo, MeusPets): título com a contagem e o
 * botão de adicionar, um cartão branco por pet com a foto grande (ou o
 * mascote na cor do pet), raça, idade e o próximo lembrete, e "Adicionar pet".
 */
export default function Pets() {
  const { pets, petsMemoria, seniores, carregando, erro, definirPetAtivo, recarregar } = usePets()
  const { lembretes } = useLembretes()
  const [atualizando, setAtualizando] = useState(false)
  const limites = useLimitesPlano()
  const cadastroBloqueado = limiteCadastroAtingido(limites?.dados)

  const abrirPet = useCallback(
    (pet: Pet) => {
      definirPetAtivo(pet.id)
      router.push({ pathname: '/pet/[id]', params: { id: pet.id } })
    },
    [definirPetAtivo],
  )

  const recarregarLista = useCallback(async () => {
    setAtualizando(true)
    try { await recarregar() } finally { setAtualizando(false) }
  }, [recarregar])

  const contagem =
    erro && pets.length === 0 ? 'Atualize para ver seus pets' : pets.length === 0 ? 'Nenhum pet ainda' : pets.length === 1 ? '1 pet cadastrado' : `${pets.length} pets cadastrados`

  return (
    <View style={estilos.tela}>
      <View style={estilos.topo}>
        <View style={estilos.flex}>
          <Text style={estilos.contagem}>{contagem}</Text>
          <Text style={estilos.titulo} accessibilityRole="header">Meus pets</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cadastrar novo pet"
          disabled={cadastroBloqueado}
          accessibilityState={{ disabled: cadastroBloqueado }}
          hitSlop={8}
          onPress={() => router.push('/pet/novo')}
          style={({ pressed }) => [estilos.mais, (pressed || cadastroBloqueado) && { opacity: 0.5 }]}
        >
          <Plus size={22} color={colors.black} weight="bold" />
        </Pressable>
      </View>

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
          <AvisoLimitesPlano limites={limites?.dados ?? null} />
          {erro ? <View style={estilos.falha}>
            <Text accessibilityRole="alert" style={estilos.falhaTexto}>{erro}</Text>
            <Pressable accessibilityRole="button" disabled={atualizando} accessibilityState={{ disabled: atualizando, busy: atualizando }} onPress={recarregarLista} hitSlop={8}>
              <Text style={estilos.repetir}>{atualizando ? 'Atualizando…' : 'Tentar novamente'}</Text>
            </Pressable>
          </View> : null}
          {pets.length === 0 && !erro ? (
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
            const somenteLeitura = limites?.dados?.petsSomenteLeitura.includes(pet.id)
            return (
              <Surgir key={pet.id} indice={indice}>
                <Tocavel
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${pet.nome}`}
                  onPress={() => abrirPet(pet)}
                  escala={0.98}
                  style={estilos.cartao}
                >
                  <View style={[estilos.retrato, { backgroundColor: cores.fundo }]}>
                    {pet.foto_url ? (
                      <Image source={{ uri: pet.foto_url }} style={estilos.foto} accessibilityLabel={`Foto de ${pet.nome}`} />
                    ) : (
                      <Mascote especie={pet.especie} size={190} recorte />
                    )}
                  </View>
                  <View style={estilos.cartaoTexto}>
                    <View style={estilos.flex}>
                      <Text style={estilos.nome} numberOfLines={1}>
                        {pet.nome}
                      </Text>
                      <Text style={estilos.detalhe} numberOfLines={1}>
                        {[raca, idade].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <View style={estilos.selos}>
                      {proximo ? (
                        <Text style={[estilos.selo, estilos.seloAtencao]} numberOfLines={1}>
                          {tituloSemPet(proximo.titulo, pet.nome)} {rotuloProximidade(proximo.proxima_em).texto}
                        </Text>
                      ) : null}
                      {seniores.has(pet.id) ? <Text style={[estilos.selo, estilos.seloRotina]}>Sênior</Text> : null}
                      {somenteLeitura ? <Text style={[estilos.selo, estilos.seloNeutro]}>Somente leitura</Text> : null}
                    </View>
                  </View>
                </Tocavel>
              </Surgir>
            )
          })}

          {/* Em memória (BUSINESS.md 5.39): fora da lista ativa, com o cartão discreto. */}
          {petsMemoria.map((pet) => (
            <Tocavel
              key={pet.id}
              accessibilityRole="button"
              accessibilityLabel={`${pet.nome}, em memória`}
              onPress={() => router.push({ pathname: '/pet/[id]/memorial', params: { id: pet.id } })}
              style={estilos.memoria}
            >
              <View style={estilos.memoriaRetrato}>
                {pet.foto_url ? (
                  <Image source={{ uri: pet.foto_url }} style={estilos.memoriaFoto} />
                ) : (
                  <Mascote especie={pet.especie} size={56} />
                )}
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.memoriaNome}>{pet.nome}</Text>
                <Text style={estilos.memoriaRotulo}>Em memória</Text>
              </View>
            </Tocavel>
          ))}

          <Pressable
            accessibilityRole="button"
            disabled={cadastroBloqueado}
            accessibilityState={{ disabled: cadastroBloqueado }}
            onPress={() => router.push('/pet/novo')}
            style={({ pressed }) => [estilos.adicionar, (pressed || cadastroBloqueado) && { opacity: 0.5 }]}
          >
            <Plus size={18} color={colors.textMuted} />
            <Text style={estilos.adicionarTexto}>Adicionar pet</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  )
}

const estilos = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  tela: { flex: 1, backgroundColor: colors.background },
  topo: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 16 },
  contagem: { ...typography.captionMedium, color: colors.textMuted },
  titulo: { fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 38, letterSpacing: -1.1, color: colors.black },
  mais: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  falha: { backgroundColor: colors.warningSurface, borderRadius: 20, padding: 16, gap: 10 },
  falhaTexto: { ...typography.small, color: colors.warningText },
  repetir: { ...typography.captionMedium, color: colors.primaryDeep },
  carregando: { marginTop: 40 },
  lista: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 120, gap: 14 },
  vazio: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  vazioTexto: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  // Versão 2: cartão branco com a foto grande em cima e os dados embaixo.
  cartao: { backgroundColor: colors.surface, borderRadius: 28, overflow: 'hidden', ...shadow.card },
  retrato: { height: 200, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  foto: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  cartaoTexto: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  nome: { fontFamily: fontFamily.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.black },
  detalhe: { ...typography.caption, fontSize: 14, color: colors.textMuted },
  selos: { alignItems: 'flex-end', gap: 4, maxWidth: '55%' },
  selo: { fontFamily: fontFamily.bold, fontSize: 12, borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 },
  seloAtencao: { backgroundColor: colors.warningSurface, color: colors.warningText },
  seloRotina: { backgroundColor: colors.premiumSurface, color: colors.premiumText },
  seloNeutro: { backgroundColor: colors.background, color: colors.textMuted },
  memoria: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.premiumSurface, borderRadius: 28, padding: 14 },
  memoriaRetrato: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  memoriaFoto: { width: 56, height: 56 },
  memoriaNome: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  memoriaRotulo: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.premiumText },
  adicionar: {
    height: 64,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adicionarTexto: { fontSize: 15, fontFamily: fontFamily.semiBold, color: colors.textMuted },
})
