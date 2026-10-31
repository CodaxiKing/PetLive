import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { textoDeErro } from '../../../src/lib/erros'
import { Surgir } from '../../../src/components/Animacoes'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { usePets } from '../../../src/pets/PetsProvider'
import { conferirSelos, SELOS, type Selo } from '../../../src/pets/selos'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'
import { useAuth } from '../../../src/auth/AuthProvider'
import { SeloPasseios } from '../../../src/passeios/SeloPasseios'

/**
 * Selos de cuidado (protótipo Selos): os conquistados em cor, os que faltam
 * apagados, com o que é preciso para ter cada um. Sem ranking, sem pontos e
 * sem cobrança: perder um selo não gera aviso.
 */
export default function TelaSelos() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets, petsMemoria } = usePets()
  const { user } = useAuth()
  const pet = [...pets, ...petsMemoria].find((p) => p.id === id) ?? null
  const [selos, setSelos] = useState<Set<Selo> | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      conferirSelos(id).then(
        (lista) => {
          setErro(null)
          setSelos(lista)
        },
        (e) => {
          setErro(textoDeErro(e))
          setSelos(new Set())
        },
      )
    }, [id]),
  )

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={pet?.nome ?? 'Pet'} titulo="Selos de cuidado" />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {erro ? (
          <Text style={estilos.aviso} accessibilityRole="alert">
            Não deu para conferir os selos agora. {erro}
          </Text>
        ) : selos && selos.size === 0 && pet ? (
          // Nenhum selo ainda: aponta o primeiro passo, que é o mais rápido.
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/pet/[id]/peso', params: { id: pet.id } })} style={estilos.comece}>
            <Text style={estilos.comeceTitulo}>Comece pelo peso</Text>
            <Text style={estilos.comeceTexto}>Registre a pesagem de hoje e ganhe o primeiro selo {pet.especie === 'gato' ? 'da' : 'do'} {pet.nome}.</Text>
          </Pressable>
        ) : null}
        <View style={estilos.grade}>
          {SELOS.map((s, i) => {
            const tem = selos?.has(s.chave) ?? false
            return (
              <Surgir key={s.chave} indice={i} style={estilos.celula}>
                <View
                  accessible
                  accessibilityLabel={`${s.rotulo}: ${tem ? 'conquistado' : `ainda não. ${s.como}`}`}
                  style={[estilos.circulo, { backgroundColor: tem ? s.fundo : '#F3F5F8' }]}
                >
                  <Icone nome="escudo" size={34} cor={tem ? colors.black : '#C3C9D3'} espessura={2} />
                </View>
                <Text style={[estilos.rotulo, !tem && estilos.rotuloApagado]} numberOfLines={2}>
                  {s.rotulo}
                </Text>
                {!tem && selos ? <Text style={estilos.como}>{s.como}</Text> : null}
              </Surgir>
            )
          })}
        </View>
        {user && pet ? <SeloPasseios key={`${user.id}:${pet.id}`} tutorId={user.id} petId={pet.id} /> : null}
        <Text style={estilos.nota}>Os selos mostram o cuidado do dia a dia. Não há ranking nem pontos.</Text>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 22 },
  celula: { width: '33.33%', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  circulo: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  rotulo: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black, textAlign: 'center' },
  rotuloApagado: { color: '#8A93A3' },
  como: { fontFamily: fontFamily.regular, fontSize: 11, lineHeight: 14, color: '#8A93A3', textAlign: 'center', marginTop: -4 },
  aviso: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20, color: colors.danger },
  comece: { backgroundColor: colors.black, borderRadius: 24, padding: 18, gap: 4 },
  comeceTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.white },
  comeceTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.8)' },
  nota: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: '#566070', backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', padding: 18 },
})
