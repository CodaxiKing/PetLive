import { useRouter } from 'expo-router';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Flutuar } from '../../src/components/Animacoes';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

/** Patinha do alto, canto superior direito do herói. */
function Patinha({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colors.white} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={6} cy={10} r={1.8} />
      <Circle cx={10} cy={6} r={1.8} />
      <Circle cx={14} cy={6} r={1.8} />
      <Circle cx={18} cy={10} r={1.8} />
      <Path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
    </Svg>
  );
}

/** Mascote do protótipo: cachorro visto de frente. */
function Mascote({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {/* corpo e orelhas */}
      <Path d="M30 200Q36 150 100 150Q164 150 170 200z" fill="#E88F45" />
      <Path d="M46 78L52 24L96 54z" fill="#E88F45" />
      <Path d="M154 78L148 24L104 54z" fill="#E88F45" />
      <Path d="M58 64L60 40L80 54z" fill="#F7B7B0" />
      <Path d="M142 64L140 40L120 54z" fill="#F7B7B0" />
      {/* cabeça */}
      <Ellipse cx={100} cy={98} rx={58} ry={52} fill="#F2A65A" />
      <Ellipse cx={100} cy={120} rx={22} ry={15} fill="#FBE3CC" />
      {/* olhos verdes com brilho */}
      <Ellipse cx={76} cy={94} rx={8} ry={10} fill="#3E8E6A" />
      <Ellipse cx={124} cy={94} rx={8} ry={10} fill="#3E8E6A" />
      <Ellipse cx={76} cy={94} rx={2.5} ry={7} fill="#1D1A18" />
      <Ellipse cx={124} cy={94} rx={2.5} ry={7} fill="#1D1A18" />
      <Circle cx={78} cy={90} r={2} fill="#fff" />
      <Circle cx={126} cy={90} r={2} fill="#fff" />
      {/* focinho e sorriso */}
      <Path d="M93 109h14l-7 9z" fill="#E57373" />
      <Path d="M100 118c0 7-8 8-12 4M100 118c0 7 8 8 12 4" fill="none" stroke="#6B4A3A" strokeWidth={2.5} strokeLinecap="round" />
      {/* bigodes */}
      <Path d="M60 112l-26-4M60 120l-26 6M140 112l26-4M140 120l26 6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

/** Onda branca que separa o herói do conteúdo. */
function Onda({ largura, altura }: { largura: number; altura: number }) {
  return (
    <Svg
      width={largura}
      height={altura}
      viewBox="0 0 390 46"
      preserveAspectRatio="none"
      style={estilos.onda}
    >
      <Path
        d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z"
        fill="#fff"
      />
    </Svg>
  );
}

export default function Welcome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  // Altura do herói, como no protótipo (470 em tela de 844), com teto
  // para não comer a área de conteúdo em aparelhos baixos.
  const alturaHeroi = Math.min(470, Math.round(height * 0.52));

  return (
    <View style={estilos.tela}>
      <View style={[estilos.heroi, { height: alturaHeroi }]}>
        <Text style={estilos.marca}>PetLive</Text>
        <View style={estilos.patinha}>
          <Patinha size={110} />
        </View>
        <View style={[estilos.mascote, { width: alturaHeroi * 0.72, height: alturaHeroi * 0.72 }]}>
          <Flutuar><Mascote size={alturaHeroi * 0.72} /></Flutuar>
        </View>
        <Onda largura={width} altura={46} />
      </View>

      <View style={estilos.conteudo}>
        {/* Indicador de páginas do onboarding. */}
        <View style={estilos.indicadores}>
          <View style={[estilos.traco, estilos.tracoAtivo]} />
          <View style={estilos.ponto} />
          <View style={estilos.ponto} />
        </View>

        <Text style={estilos.titulo}>
          Saúde do seu{'\n'}pet, sempre{'\n'}em dia
        </Text>
        <Text style={estilos.subtitulo}>Vacinas, lembretes e clínicas perto de você, no mesmo app.</Text>

        <View style={estilos.acoes}>
          <View style={estilos.botaoVoltar}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M11 6l-6 6 6 6" stroke={colors.black} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>

          <BotaoPrimario
            titulo="Começar"
            variante="pata"
            onPress={() => router.push('/criar-conta')}
            estilo={estilos.botaoComecar}
          />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.white,
  },
  heroi: {
    backgroundColor: colors.hero,
    overflow: 'hidden',
  },
  marca: {
    position: 'absolute',
    left: 24,
    top: 60,
    ...typography.h2,
    fontWeight: '800',
    fontSize: 22,
    color: colors.black,
  },
  patinha: {
    position: 'absolute',
    right: 20,
    top: 46,
  },
  mascote: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 18,
  },
  onda: {
    position: 'absolute',
    left: 0,
    bottom: -1,
  },
  conteudo: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 28,
    gap: 14,
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
    fontWeight: '500',
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.3,
    color: colors.black,
  },
  subtitulo: {
    ...typography.caption,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  acoes: {
    marginTop: 'auto',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  botaoVoltar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.disabled,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  botaoComecar: {
    flex: 1,
  },
});
