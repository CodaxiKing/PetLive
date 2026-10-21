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
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { Surgir } from '../../src/components/Animacoes';
import { Mascote } from '../../src/components/Mascote';
import { useLembretes } from '../../src/lembretes/LembretesProvider';
import { rotuloProximidade } from '../../src/lembretes/types';
import { usePets } from '../../src/pets/PetsProvider';
import { useVacinas } from '../../src/saude/VacinasProvider';
import { diasAte } from '../../src/saude/types';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

/** Cores dos cartões de lembrete, alternadas (protótipo Início). */
const PALETA_LEMBRETES = [
  { fundo: '#EBDDFB', borda: '#D7BDF5', texto: '#5B3C8F' },
  { fundo: '#FCE1EF', borda: '#F5BFD9', texto: '#8A2E5C' },
];

type Categoria = { nome: string; fundo: string; filtro: string; icone: NomeIcone; ativa?: boolean };

const CATEGORIAS: Categoria[] = [
  { nome: 'Clínicas', fundo: colors.primary, filtro: 'clinica', icone: 'cruz', ativa: true },
  { nome: 'Banho', fundo: colors.primarySurface, filtro: 'banho_tosa', icone: 'gota' },
  { nome: 'Petshop', fundo: colors.successSurface, filtro: 'petshop', icone: 'sacola' },
  { nome: '24h', fundo: colors.warningSurface, filtro: '24h', icone: 'relogio' },
];

/** "Rex tem 1 vacina vencendo esta semana e 1 atrasada." */
function textoAvisoVacina(nome: string, vencendo: number, atrasadas: number): string {
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? 's' : ''}`;
  if (!vencendo) return `${nome} tem ${plural(atrasadas, 'vacina')} ${atrasadas > 1 ? 'atrasadas' : 'atrasada'}.`;
  const partes = [`${plural(vencendo, 'vacina')} vencendo esta semana`];
  if (atrasadas) partes.push(plural(atrasadas, 'atrasada'));
  return `${nome} tem ${partes.join(' e ')}.`;
}

/**
 * Início (board P0 "Tela Início: busca, categorias, lembretes e aviso de
 * vacina"): o pet ativo no título, os dois próximos lembretes e o aviso das
 * vacinas que vencem em até 7 dias, que leva às clínicas por perto.
 */
export default function Inicio() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { pets, petAtivo } = usePets();
  const { lembretes } = useLembretes();
  const { vacinas } = useVacinas();

  const proximos = lembretes.slice(0, 2);
  const diasVacinas = vacinas.map((v) => diasAte(v.proxima_dose)).filter((d): d is number => d !== null);
  const vacinasVencendo = diasVacinas.filter((d) => d >= 0 && d <= 7).length;
  const vacinasAtrasadas = diasVacinas.filter((d) => d < 0).length;
  const nomePet = petAtivo?.nome ?? 'Seu pet';

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      showsVerticalScrollIndicator={false}
    >
      <View style={[estilos.heroi, { height: 290 }]}>
        <View style={estilos.cabecalho}>
          <BotaoRedondo acessibilidade="Local">
            <IconeLocal />
          </BotaoRedondo>

          <View style={estilos.local}>
            <Text style={estilos.localRotulo}>Local</Text>
            <Text style={estilos.localNome}>Rio de Janeiro</Text>
          </View>

          <BotaoRedondo acessibilidade="Avisos" onPress={() => router.push('/avisos')}>
            <IconeSino />
          </BotaoRedondo>

          <BotaoRedondo acessibilidade="Perfil" onPress={() => router.push('/perfil')}>
            <IconePerfil />
          </BotaoRedondo>
        </View>

        <Text style={estilos.titulo} numberOfLines={1}>
          {petAtivo ? `Para ${petAtivo.sexo === 'femea' ? 'a' : 'o'} ${petAtivo.nome}` : 'Olá!'}
        </Text>

        <Pressable
          style={estilos.busca}
          accessibilityRole="search"
          accessibilityLabel="Buscar clínica, banho e tosa"
          onPress={() => router.push('/mapa')}
        >
          <IconeBusca cor={colors.textMuted} />
          <Text style={estilos.buscaTexto}>Buscar clínica, banho e tosa…</Text>
        </Pressable>

        <OndaHeroi largura={width} />
      </View>

      <View style={estilos.secoes}>
        <Secao titulo="Categorias" acao="Ver todas ›" onAcao={() => router.push('/mapa')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.categorias}>
          {CATEGORIAS.map((categoria) => (
            <Pressable
              key={categoria.nome}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/mapa', params: { filtro: categoria.filtro } })}
              style={[
                estilos.categoria,
                categoria.ativa ? estilos.categoriaAtiva : estilos.categoriaInativa,
              ]}
            >
              <View style={[estilos.categoriaÍcone, { backgroundColor: categoria.fundo }]}>
                <Icone nome={categoria.icone} size={18} espessura={categoria.ativa ? 2.4 : 1.8} />
              </View>
              <Text style={[estilos.categoriaTexto, categoria.ativa && estilos.categoriaTextoAtivo]}>
                {categoria.nome}
              </Text>
            </Pressable>
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
          {proximos.map((lembrete, indice) => {
            const cores = PALETA_LEMBRETES[indice % PALETA_LEMBRETES.length];
            const pet = pets.find((p) => p.id === lembrete.pet_id);
            const quando = rotuloProximidade(lembrete.proxima_em).texto;
            return (
              <Surgir key={lembrete.id} indice={indice} style={estilos.lembreteSurgir}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${lembrete.titulo}, ${quando}`}
                onPress={() => router.push('/lembretes')}
                style={[estilos.lembrete, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
              >
                <View style={estilos.lembreteTopo}>
                  <View style={estilos.lembreteTexto}>
                    <Text style={estilos.lembreteTitulo} numberOfLines={1}>
                      {lembrete.titulo}
                    </Text>
                    <Text style={[estilos.lembreteSub, { color: cores.texto }]} numberOfLines={1}>
                      {pet ? `${pet.nome} · ${quando}` : quando}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Novo lembrete"
                    hitSlop={6}
                    onPress={() => router.push('/lembretes/novo')}
                    style={estilos.lembreteAdicionar}
                  >
                    <Text style={estilos.lembreteAdicionarSinal}>+</Text>
                  </Pressable>
                </View>

                <View style={estilos.lembreteAvatar}>
                  <Mascote especie={pet?.especie ?? 'cao'} size={84} recorte />
                </View>
              </Pressable>
              </Surgir>
            );
          })}

          {proximos.length < 2 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Novo lembrete"
              onPress={() => router.push('/lembretes/novo')}
              style={[estilos.lembrete, estilos.lembreteNovo]}
            >
              <View style={estilos.lembreteTopo}>
                <View style={estilos.lembreteTexto}>
                  <Text style={estilos.lembreteTitulo}>Novo lembrete</Text>
                  <Text style={[estilos.lembreteSub, { color: colors.textMuted }]}>Vacina, banho, consulta…</Text>
                </View>
                <View style={estilos.lembreteAdicionar}>
                  <Text style={estilos.lembreteAdicionarSinal}>+</Text>
                </View>
              </View>
            </Pressable>
          ) : null}
        </View>

        {/* Atalho: vacina vencendo leva às clínicas por perto (board P1). */}
        {vacinasVencendo + vacinasAtrasadas > 0 ? (
          <Pressable
            style={estilos.avisoVacina}
            accessibilityRole="button"
            accessibilityLabel="Ver clínicas por perto"
            onPress={() => router.push({ pathname: '/mapa', params: { filtro: 'clinica' } })}
          >
            <View style={estilos.avisoVacinaÍcone}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.black} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M14 4l6 6-9 9-6-6z" />
                <Path d="M5 13l6 6" />
              </Svg>
            </View>
            <Text style={estilos.avisoVacinaTexto}>
              {textoAvisoVacina(nomePet, vacinasVencendo, vacinasAtrasadas)}
            </Text>
            <View style={estilos.avisoVacinaBotao}>
              <Text style={estilos.avisoVacinaBotaoTexto}>Ver</Text>
            </View>
          </Pressable>
        ) : null}
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
    fontFamily: fontFamily.medium,
  },
  localNome: {
    fontSize: 14,
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  titulo: {
    ...typography.h1,
    fontFamily: fontFamily.medium,
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
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  categoriaTexto: {
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
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
  lembreteSurgir: {
    flex: 1,
  },
  lembreteNovo: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderStyle: 'dashed',
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
    fontFamily: fontFamily.semiBold,
    fontSize: 15,
    color: colors.black,
  },
  lembreteSub: {
    fontFamily: fontFamily.regular,
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
    fontFamily: fontFamily.bold,
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
    fontFamily: fontFamily.medium,
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
    fontFamily: fontFamily.bold,
    color: colors.black,
  },
  respiro: {
    height: 110,
  },
});
