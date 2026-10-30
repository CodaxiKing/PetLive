import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Surgir } from '../../src/components/Animacoes';
import { colors } from '../../src/theme/colors';
import { fontFamily, typography } from '../../src/theme/typography';

const FOTO = require('../../assets/fotos/boas-vindas.jpg');
const LOGO = require('../../assets/logo-petlive.png');

/**
 * Boas-vindas da versão 2 do protótipo (BoasVindas): foto de ponta a ponta,
 * o logo numa pílula no alto e uma folha branca com o convite e os botões.
 * A foto é do Pexels (a mesma do site) e mostra uma tutora, não um usuário.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={estilos.tela}>
      <Image source={FOTO} resizeMode="cover" style={estilos.foto} accessibilityIgnoresInvertColors />
      <View style={[estilos.marca, { top: insets.top + 16 }]}>
        <Image source={LOGO} style={estilos.logo} accessibilityIgnoresInvertColors />
        <Text style={estilos.marcaTexto}>PetLive</Text>
      </View>

      <Surgir style={[estilos.folha, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <View style={estilos.indicadores}>
          <View style={[estilos.traco, estilos.tracoAtivo]} />
          <View style={estilos.ponto} />
          <View style={estilos.ponto} />
        </View>

        <Text style={estilos.titulo} accessibilityRole="header">
          A saúde do seu pet, sempre em dia
        </Text>
        <Text style={estilos.subtitulo}>Vacinas, lembretes e clínicas perto de você, no mesmo app.</Text>

        <BotaoPrimario titulo="Começar" onPress={() => router.push('/criar-conta')} estilo={estilos.botao} />
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push('/criar-conta?modo=entrar')}
          style={({ pressed }) => [estilos.entrar, pressed && { opacity: 0.6 }]}
        >
          <Text style={estilos.entrarTexto}>Já tenho conta</Text>
        </Pressable>
      </Surgir>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'flex-end',
  },
  foto: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  marca: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingLeft: 8,
    paddingRight: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  logo: {
    width: 30,
    height: 30,
  },
  marcaTexto: {
    fontFamily: fontFamily.extraBold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.black,
  },
  folha: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  indicadores: {
    flexDirection: 'row',
    gap: 6,
  },
  traco: {
    width: 26,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  tracoAtivo: {
    backgroundColor: colors.black,
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  titulo: {
    ...typography.h1,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.2,
    color: colors.black,
  },
  subtitulo: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  botao: {
    marginTop: 8,
  },
  entrar: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  entrarTexto: {
    ...typography.button,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    color: colors.black,
  },
});
