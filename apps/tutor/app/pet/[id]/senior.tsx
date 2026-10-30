import { useCallback, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Tocavel } from '../../../src/components/Animacoes'
import { HeroiOnda } from '../../../src/components/HeroiOnda'
import { Icone } from '../../../src/components/Icone'
import { Interruptor } from '../../../src/components/Interruptor'
import type { Lembrete } from '../../../src/lembretes/types'
import { usePets } from '../../../src/pets/PetsProvider'
import { ligarLembrete, rotinaSenior } from '../../../src/pets/senior'
import { idadeEmAnos } from '../../../src/pets/types'
import { colors } from '../../../src/theme/colors'
import { fontFamily } from '../../../src/theme/typography'

const ROTULOS: Record<string, { titulo: string; detalhe: (l: Lembrete) => string }> = {
  senior_consulta: { titulo: 'Consulta a cada 6 meses', detalhe: (l) => `Próxima: ${dataCurta(l.proxima_em)}` },
  senior_pesagem: { titulo: 'Pesagem todo mês', detalhe: (l) => `Aviso no dia ${new Date(l.proxima_em).getDate()}` },
  senior_exames: { titulo: 'Exames de rotina', detalhe: () => 'Pergunte ao veterinário quais' },
}
const ORDEM = ['senior_consulta', 'senior_pesagem', 'senior_exames']

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

/**
 * Pet sênior (protótipo PetIdoso): a rotina adaptada para a idade, com cada
 * lembrete desligável, os sinais para observar e a entrada da escala de
 * qualidade de vida (que só fica aqui, junto do aviso do veterinário).
 */
export default function TelaSenior() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pets } = usePets()
  const pet = pets.find((p) => p.id === id) ?? null
  const [rotina, setRotina] = useState<Lembrete[] | null>(null)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      rotinaSenior(id).then(setRotina, () => setRotina([]))
    }, [id]),
  )

  if (!pet) return <View style={estilos.tela} />
  const da = pet.sexo === 'femea' ? 'a' : 'o'

  async function alternar(l: Lembrete) {
    setRotina((atual) => atual?.map((x) => (x.id === l.id ? { ...x, ativo: !l.ativo } : x)) ?? null)
    try {
      await ligarLembrete(l.id, !l.ativo)
    } catch (e) {
      setRotina((atual) => atual?.map((x) => (x.id === l.id ? { ...x, ativo: l.ativo } : x)) ?? null)
      Alert.alert('Não deu para mudar', e instanceof Error ? e.message : String(e))
    }
  }

  const itens = (rotina ?? []).slice().sort((a, b) => ORDEM.indexOf(a.rotina_item ?? '') - ORDEM.indexOf(b.rotina_item ?? ''))

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo={[pet.nome, idadeEmAnos(pet.nascimento)].filter(Boolean).join(' · ')} titulo="Pet sênior" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.aviso}>
          <Text style={estilos.avisoTitulo}>Rotina adaptada para a idade</Text>
          <Text style={estilos.avisoTexto}>
            Ajustamos os lembretes. Converse com o veterinário sobre o que faz sentido para {da} {pet.nome}.
          </Text>
        </View>

        {rotina === null ? (
          <ActivityIndicator color={colors.primaryDeep} />
        ) : (
          itens.map((l) => {
            const r = ROTULOS[l.rotina_item ?? '']
            if (!r) return null
            return (
              <View key={l.id} style={estilos.item}>
                <View style={estilos.flex}>
                  <Text style={estilos.itemTitulo}>{r.titulo}</Text>
                  <Text style={estilos.itemSub}>{l.ativo ? r.detalhe(l) : 'Desligado'}</Text>
                </View>
                <Interruptor ligado={l.ativo} rotulo={r.titulo} onToggle={() => alternar(l)} />
              </View>
            )
          })
        )}

        <View style={[estilos.item, estilos.sinais]}>
          <View style={estilos.icone}>
            <Icone nome="bandeira" size={20} />
          </View>
          <View style={estilos.flex}>
            <Text style={estilos.sinaisRotulo}>Sinais para observar</Text>
            <Text style={estilos.sinaisTexto}>Apetite, sede, mobilidade e sono</Text>
          </View>
        </View>

        <Tocavel
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/pet/[id]/qualidade-de-vida', params: { id: pet.id } })}
          style={estilos.escala}
        >
          <View style={estilos.flex}>
            <Text style={estilos.escalaTitulo}>Escala de qualidade de vida</Text>
            <Text style={estilos.escalaSub}>Para conversar com o veterinário</Text>
          </View>
          <Text style={estilos.seta}>›</Text>
        </Tocavel>
        <Text style={estilos.nota}>Os remédios contínuos seguem normalmente. A condição sênior vem da idade e não dá para desligar.</Text>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  aviso: { backgroundColor: '#FFF0C9', borderRadius: 28, paddingVertical: 16, paddingHorizontal: 20, gap: 4 },
  avisoTitulo: { fontFamily: fontFamily.bold, fontSize: 14, color: '#8A5A00' },
  avisoTexto: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 23, color: '#2B3A4A' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 18 },
  itemTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  itemSub: { fontFamily: fontFamily.regular, fontSize: 13, color: '#566070' },
  sinais: { paddingVertical: 12 },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  sinaisRotulo: { fontFamily: fontFamily.regular, fontSize: 13, color: '#566070' },
  sinaisTexto: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  escala: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.premiumSurface, borderRadius: 24, paddingVertical: 16, paddingHorizontal: 18 },
  escalaTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  escalaSub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.premiumText },
  seta: { fontFamily: fontFamily.bold, fontSize: 24, color: colors.black },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: '#566070' },
})
