import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import {
  BotaoRedondo,
  IconeBusca,
  IconeLocal,
  IconePerfil,
  IconeSino,
  OndaHeroi,
  Secao,
} from '../../src/components/Layout';
import { Icone } from '../../src/components/Icone';
import { Mascote } from '../../src/components/Mascote';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

type Lembrete = {
  tipo: string;
  pet: string;
  quando: string;
  especie: 'cao' | 'gato';
  fundo: string;
  borda: string;
  texto: string;
};

const LEMBRETES_EXEMPLO: Lembrete[] = [
  { tipo: 'Vacina V10', pet: 'Rex', quando: 'em 5 dias', especie: 'cao', fundo: '#EBDDFB', borda: '#D7BDF5', texto: '#5B3C8F' },
  { tipo: 'Vermífugo', pet: 'Mia', quando: 'em 12 dias', especie: 'gato', fundo: '#FCE1EF', borda: '#F5BFD9', texto: '#8A2E5C' },
];

type Categoria = { nome: string; fundo: string; ativa?: boolean };

const CATEGORIAS: Categoria[] = [
  { nome: 'Clínicas', fundo: colors.primary, ativa: true },
  { nome: 'Banho', fundo: colors.primarySurface },
  { nome: 'Petshop', fundo: colors.successSurface },
  { nome: '24h', fundo: colors.warningSurface },
];

export default function Inicio() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
    >
      <View style={[estilos.heroi, { height: 290 }]}>
        <View style={estilos.cabecalho}>
          <BotaoRedondo acessibilidade="Escolher local">
            <IconeLocal />
          </BotaoRedondo>

          <View style={estilos.local}>
            <Text style={estilos.localRotulo}>Local</Text>
            <Text style={estilos.localNome}>Rio de Janeiro ⌄</Text>
          </View>

          <BotaoRedondo acessibilidade="Avisos">
            <IconeSino />
          </BotaoRedondo>

          <BotaoRedondo acessibilidade="Perfil">
            <IconePerfil />
          </BotaoRedondo>
        </View>

        <Text style={estilos.titulo}>Para o Rex</Text>

        <View style={estilos.busca}>
          <IconeBusca cor={colors.textMuted} />
          <Text style={estilos.buscaTexto}>Buscar clínica, banho e tosa…</Text>
        </View>

        <OndaHeroi largura={width} />
      </View>

      <View style={estilos.secoes}>
        <Secao titulo="Categorias" acao="Ver todos ›" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.categorias}>
          {CATEGORIAS.map((categoria) => (
            <View
              key={categoria.nome}
              style={[
                estilos.categoria,
                categoria.ativa ? estilos.categoriaAtiva : estilos.categoriaInativa,
              ]}
            >
              <View style={[estilos.categoriaÍcone, { backgroundColor: categoria.fundo }]}>
                <Text style={estilos.categoriaSinal}>{categoria.ativa ? '+' : '•'}</Text>
              </View>
              <Text style={[estilos.categoriaTexto, categoria.ativa && estilos.categoriaTextoAtivo]}>
                {categoria.nome}
              </Text>
            </View>
          ))}

          {/* Atalhos da Fase 1: SOS (rosa, como no Mapa) e Calculadoras. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="SOS: emergência"
            onPress={() => router.push('/sos')}
            style={[estilos.categoria, estilos.categoriaSos]}
          >
            <View style={[estilos.categoriaÍcone, { backgroundColor: colors.white }]}>
              <Icone nome="cruz" cor="#A3324F" espessura={2.4} />
            </View>
            <Text style={[estilos.categoriaTexto, estilos.categoriaTextoSos]}>SOS</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/ferramentas/calculadoras')}
            style={[estilos.categoria, estilos.categoriaInativa]}
          >
            <View style={[estilos.categoriaÍcone, { backgroundColor: colors.premiumSurface }]}>
              <Icone nome="calculadora" />
            </View>
            <Text style={estilos.categoriaTexto}>Calculadoras</Text>
          </Pressable>
        </ScrollView>

        <Secao titulo="Próximos lembretes" acao="Ver todos ›" onAcao={() => router.push('/lembretes')} />

        <View style={estilos.lembretes}>
          {LEMBRETES_EXEMPLO.map((lembrete) => (
            <View
              key={lembrete.tipo}
              style={[estilos.lembrete, { backgroundColor: lembrete.fundo, borderColor: lembrete.borda }]}
            >
              <View style={estilos.lembreteTopo}>
                <View style={estilos.lembreteTexto}>
                  <Text style={estilos.lembreteTitulo}>{lembrete.tipo}</Text>
                  <Text style={[estilos.lembreteSub, { color: lembrete.texto }]}>
                    {lembrete.pet} · {lembrete.quando}
                  </Text>
                </View>
                <View style={estilos.lembreteAdicionar}>
                  <Text style={estilos.lembreteAdicionarSinal}>+</Text>
                </View>
              </View>

              <View style={estilos.lembreteAvatar}>
                <Mascote especie={lembrete.especie} size={84} recorte />
              </View>
            </View>
          ))}
        </View>

        {/* Atalho: vacina vencendo leva às clínicas por perto (board P1). */}
        <Pressable
          style={estilos.avisoVacina}
          accessibilityRole="button"
          accessibilityLabel="Ver clínicas por perto"
          onPress={() =>
            router.push({ pathname: '/mapa', params: { filtro: 'clinica' } })
          }
        >
          <View style={estilos.avisoVacinaÍcone}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M14 4l6 6-9 9-6-6z" />
              <Path d="M5 13l6 6" />
            </Svg>
          </View>
          <Text style={estilos.avisoVacinaTexto}>Você tem 1 vacina vencendo esta semana.</Text>
          <View style={estilos.avisoVacinaBotao}>
            <Text style={estilos.avisoVacinaBotaoTexto}>Ver</Text>
          </View>
        </Pressable>
      </View>

      {/* Espaço para o menu inferior flutuante não cobrir o conteúdo. */}
      <View style={estilos.respiro} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  conteudo: {
    paddingBottom: spacing.xxl,
  },
  heroi: {
    backgroundColor: colors.hero,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 54,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  local: {
    flex: 1,
    minWidth: 0,
  },
  localRotulo: {
    fontSize: 11,
    color: colors.primaryDark,
    fontWeight: '500',
  },
  localNome: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
  },
  titulo: {
    ...typography.h1,
    fontWeight: '500',
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.1,
    color: colors.black,
    marginTop: 22,
  },
  busca: {
    marginTop: 16,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  buscaTexto: {
    fontSize: 14,
    color: '#6A7484',
  },
  secoes: {
    paddingHorizontal: 24,
    gap: 10,
  },
  categorias: {
    gap: 8,
    paddingRight: 24,
  },
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    borderRadius: 27,
    paddingLeft: 6,
    paddingRight: 16,
    flexShrink: 0,
  },
  categoriaAtiva: {
    backgroundColor: colors.black,
  },
  categoriaInativa: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#E6EAF0',
  },
  categoriaSos: {
    backgroundColor: '#FDE0E6',
  },
  categoriaTextoSos: {
    color: '#A3324F',
  },
  categoriaÍcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoriaSinal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.black,
  },
  categoriaTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.black,
  },
  categoriaTextoAtivo: {
    color: colors.white,
  },
  lembretes: {
    flexDirection: 'row',
    gap: 10,
  },
  lembrete: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 12,
    gap: 8,
  },
  lembreteTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lembreteTexto: {
    flex: 1,
    minWidth: 0,
  },
  lembreteTitulo: {
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
  lembreteSub: {
    fontSize: 12,
    marginTop: 2,
  },
  lembreteAdicionar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lembreteAdicionarSinal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.black,
    lineHeight: 20,
  },
  lembreteAvatar: {
    backgroundColor: colors.white,
    borderRadius: 20,
    height: 74,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  avisoVacina: {
    marginTop: 6,
    backgroundColor: colors.background,
    borderRadius: 22,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avisoVacinaÍcone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avisoVacinaTexto: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.text,
  },
  avisoVacinaBotao: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoVacinaBotaoTexto: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
  },
  respiro: {
    height: 110,
  },
});
