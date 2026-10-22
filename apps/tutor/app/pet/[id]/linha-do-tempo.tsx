import { useCallback, useState } from 'react'
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { BotaoPrimario } from '../../../src/components/BotaoPrimario'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone, type NomeIcone } from '../../../src/components/Icone'
import { carregarLinha, urlsFotos, type ItemLinha } from '../../../src/pets/linhaDoTempo'
import { usePets } from '../../../src/pets/PetsProvider'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

/** Marcadores dos automáticos: cor e ícone por tipo (o manual é o ponto preto). */
const VISUAL: Record<ItemLinha['tipo'], { cor: string; icone?: NomeIcone }> = {
  marco: { cor: colors.black },
  chegada: { cor: '#9AD6F8', icone: 'pata' },
  nascimento: { cor: '#FFE9A8', icone: 'bolo' },
  aniversario: { cor: '#FFE9A8', icone: 'bolo' },
  vacina: { cor: '#E4D3FA', icone: 'vacina' },
  consulta: { cor: '#FBDADF', icone: 'cruz' },
  peso: { cor: '#D2EFDD', icone: 'balanca' },
}
const FUNDOS_FOTO = ['#FFF0C9', '#9AD6F8', '#DDF3E6', '#EBDDFB']

function dataCurta(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a.slice(2)}`
}

/**
 * Linha do tempo (protótipo LinhaDoTempo): marcos manuais com texto e foto,
 * mais os automáticos (chegada, aniversários, vacinas, consultas e pesagens).
 * Privada: só o tutor vê. Tocar num marco manual abre para editar.
 */
export default function TelaLinhaDoTempo() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, petsMemoria } = usePets()
  const pet = [...pets, ...petsMemoria].find((p) => p.id === id) ?? null
  const [itens, setItens] = useState<ItemLinha[] | null>(null)
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const [soMarcos, setSoMarcos] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      let vivo = true
      carregarLinha(id)
        .then(async (lista) => {
          const urls = await urlsFotos(lista.flatMap((i) => (i.foto_path ? [i.foto_path] : [])))
          if (!vivo) return
          setItens(lista)
          setFotos(urls)
        })
        .catch(() => vivo && setItens([]))
      return () => {
        vivo = false
      }
    }, [id]),
  )

  const lista = (itens ?? []).filter((i) => !soMarcos || i.manual)

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={pet?.nome ?? 'Pet'} titulo="Linha do tempo" altura={200} />
      {itens === null ? (
        <ActivityIndicator color={colors.primaryDeep} style={estilos.carregando} />
      ) : (
        <ScrollView style={estilos.flex} contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
          <View style={estilos.filtros}>
            {[
              { rotulo: 'Tudo', valor: false },
              { rotulo: 'Só meus marcos', valor: true },
            ].map((f) => (
              <Tocavel
                key={f.rotulo}
                accessibilityRole="radio"
                accessibilityState={{ selected: soMarcos === f.valor }}
                onPress={() => setSoMarcos(f.valor)}
                style={[estilos.filtro, soMarcos === f.valor && estilos.filtroAtivo]}
              >
                <Text style={[estilos.filtroTexto, soMarcos === f.valor && estilos.filtroTextoAtivo]}>{f.rotulo}</Text>
              </Tocavel>
            ))}
          </View>

          {lista.length === 0 ? (
            <Text style={estilos.vazio}>Nenhum marco ainda. Registre o primeiro passeio, a chegada em casa ou aquela foto especial.</Text>
          ) : (
            lista.map((item, i) => {
              const visual = VISUAL[item.tipo]
              const ultimo = i === lista.length - 1
              const conteudo = (
                <>
                  <Text style={estilos.data}>{dataCurta(item.data)}</Text>
                  <Text style={[estilos.titulo, !item.manual && estilos.tituloAuto]}>{item.titulo}</Text>
                  {item.descricao ? <Text style={estilos.descricao}>{item.descricao}</Text> : null}
                  {item.foto_path ? (
                    <View style={[estilos.foto, { backgroundColor: FUNDOS_FOTO[i % FUNDOS_FOTO.length] }]}>
                      {fotos[item.foto_path] ? <Image source={{ uri: fotos[item.foto_path] }} style={estilos.fotoImagem} /> : null}
                    </View>
                  ) : null}
                </>
              )
              return (
                <View key={item.id} style={estilos.linha}>
                  <View style={estilos.trilho}>
                    <View style={[estilos.ponto, { backgroundColor: visual.cor }, !item.manual && estilos.pontoAuto]}>
                      {visual.icone ? <Icone nome={visual.icone} size={12} espessura={2} /> : null}
                    </View>
                    {ultimo ? null : <View style={estilos.fio} />}
                  </View>
                  {item.manual ? (
                    <Tocavel
                      accessibilityRole="button"
                      accessibilityLabel={`Editar o marco ${item.titulo}`}
                      onPress={() => router.push({ pathname: '/pet/[id]/marco', params: { id: id ?? '', marco: item.id } })}
                      estiloExterno={estilos.corpo}
                    >
                      {conteudo}
                    </Tocavel>
                  ) : (
                    <View style={estilos.corpo}>{conteudo}</View>
                  )}
                </View>
              )
            })
          )}
          <Text style={estilos.nota}>Só você vê a linha do tempo. Vacinas, consultas, pesagens e aniversários entram sozinhos.</Text>
        </ScrollView>
      )}

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Adicionar marco"
          icone={<Icone nome="pata" size={22} espessura={2} />}
          onPress={() => router.push({ pathname: '/pet/[id]/marco', params: { id: id ?? '' } })}
        />
      </View>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  carregando: { marginTop: 40 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24 },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filtro: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.background },
  filtroAtivo: { backgroundColor: colors.black },
  filtroTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  filtroTextoAtivo: { color: colors.white },
  vazio: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },
  linha: { flexDirection: 'row', gap: 16 },
  trilho: { width: 28, alignItems: 'center' },
  ponto: { width: 22, height: 22, borderRadius: 11, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  pontoAuto: { width: 26, height: 26, borderRadius: 13, marginTop: 0 },
  fio: { flex: 1, width: 3, borderRadius: 2, backgroundColor: '#D5DAE2', marginVertical: 4 },
  corpo: { flex: 1, minWidth: 0, paddingBottom: 22 },
  data: { fontFamily: fontFamily.bold, fontSize: 13, color: '#6A7484' },
  titulo: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.black, marginTop: 2 },
  tituloAuto: { fontFamily: fontFamily.semiBold, fontSize: 16 },
  descricao: { fontFamily: fontFamily.regular, fontSize: 14, color: '#5E6878', marginTop: 1 },
  foto: { marginTop: 10, height: 170, borderRadius: 26, overflow: 'hidden' },
  fotoImagem: { width: '100%', height: '100%' },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#6A7484', marginTop: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
})
