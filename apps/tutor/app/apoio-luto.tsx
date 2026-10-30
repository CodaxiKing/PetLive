import { useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Tocavel } from '../src/components/Animacoes'
import { HeroiOnda } from '../src/components/HeroiOnda'
import { Icone } from '../src/components/Icone'
import { carregarLuto, linkSeguro, LUTO_PADRAO, type RecursoLuto } from '../src/pets/conteudoCuidado'
import { colors } from '../src/theme/colors'
import { fontFamily } from '../src/theme/typography'

/**
 * Apoio ao luto (BUSINESS.md 5.39). Textos curtos, sem conselhos médicos e
 * sem pressa. Os textos e contatos vêm do conteúdo mestre, revisados por
 * profissional; sem internet, o app mostra o texto base e o CVV.
 */
export default function ApoioLuto() {
  const [recursos, setRecursos] = useState<RecursoLuto[]>(LUTO_PADRAO)
  useEffect(() => {
    let vivo = true
    carregarLuto().then((r) => vivo && setRecursos(r))
    return () => {
      vivo = false
    }
  }, [])
  return (
    <View style={estilos.tela}>
      <HeroiOnda fundo={colors.premiumSurface} subtitulo="Em memória" titulo="Apoio ao luto" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {recursos.map((r) => {
          const link = linkSeguro(r.link)
          if (r.tipo === 'contato') {
            return (
              <Tocavel key={r.id} accessibilityRole="button" disabled={!link} onPress={() => link && Linking.openURL(link).catch(() => undefined)} style={[estilos.cartao, estilos.cvv]}>
                <View style={estilos.cvvLinha}>
                  <View style={estilos.icone}>
                    <Icone nome="telefone" size={20} />
                  </View>
                  <View style={estilos.flex}>
                    <Text style={estilos.titulo}>{r.titulo}</Text>
                    <Text style={estilos.texto}>{r.texto}</Text>
                  </View>
                </View>
              </Tocavel>
            )
          }
          return (
            <View key={r.id} style={estilos.cartao}>
              <Text style={estilos.titulo}>{r.titulo}</Text>
              <Text style={estilos.texto}>{r.texto}</Text>
            </View>
          )
        })}
        <Text style={estilos.nota}>Quando quiser, estaremos aqui. Sem pressa.</Text>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  cartao: { backgroundColor: colors.surface, borderRadius: 26, padding: 18, gap: 6 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: '#2B3A4A' },
  cvv: { backgroundColor: colors.premiumSurface },
  cvvLinha: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  nota: { fontFamily: fontFamily.regular, fontSize: 14, color: '#566070', textAlign: 'center', marginTop: 8 },
})
