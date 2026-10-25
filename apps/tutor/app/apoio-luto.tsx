import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Tocavel } from '../src/components/Animacoes'
import { HeroiOnda } from '../src/components/HeroiOnda'
import { Icone } from '../src/components/Icone'
import { colors } from '../src/theme/colors'
import { fontFamily } from '../src/theme/typography'

/**
 * Apoio ao luto (BUSINESS.md 5.39). Textos curtos, sem conselhos médicos e
 * sem pressa. Os recursos curados e a revisão por profissional ficam no
 * conteúdo mestre; até lá, este texto base e o CVV.
 */
const TEXTOS = [
  {
    titulo: 'O que você sente é real',
    texto: 'Perder um pet é perder um companheiro de todos os dias. Tristeza, saudade e até culpa são reações comuns. Não existe jeito certo nem prazo para passar por isso.',
  },
  {
    titulo: 'Um passo de cada vez',
    texto: 'Guardar a coleira, olhar fotos ou mudar a rotina pode levar tempo. Faça no seu ritmo. Conversar com quem conheceu seu pet costuma ajudar.',
  },
  {
    titulo: 'Crianças e outros pets',
    texto: 'Crianças entendem melhor com palavras simples e verdadeiras. Outros pets da casa também podem estranhar a ausência; manter a rotina deles traz segurança.',
  },
]

export default function ApoioLuto() {
  return (
    <View style={estilos.tela}>
      <HeroiOnda fundo={colors.premiumSurface} subtitulo="Em memória" titulo="Apoio ao luto" altura={200} />
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {TEXTOS.map((t) => (
          <View key={t.titulo} style={estilos.cartao}>
            <Text style={estilos.titulo}>{t.titulo}</Text>
            <Text style={estilos.texto}>{t.texto}</Text>
          </View>
        ))}
        <Tocavel accessibilityRole="button" onPress={() => Linking.openURL('tel:188').catch(() => undefined)} style={[estilos.cartao, estilos.cvv]}>
          <View style={estilos.cvvLinha}>
            <View style={estilos.icone}>
              <Icone nome="telefone" size={20} />
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.titulo}>Se a tristeza estiver pesada demais</Text>
              <Text style={estilos.texto}>CVV, ligação gratuita, 24 horas: 188. Também atende por chat em cvv.org.br.</Text>
            </View>
          </View>
        </Tocavel>
        <Text style={estilos.nota}>Quando quiser, estaremos aqui. Sem pressa.</Text>
      </ScrollView>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  cartao: { backgroundColor: colors.background, borderRadius: 26, padding: 18, gap: 6 },
  titulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: '#2B3A4A' },
  cvv: { backgroundColor: colors.premiumSurface },
  cvvLinha: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  nota: { fontFamily: fontFamily.regular, fontSize: 14, color: '#566070', textAlign: 'center', marginTop: 8 },
})
