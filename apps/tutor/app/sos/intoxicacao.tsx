import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Avocado } from 'phosphor-react-native/src/icons/Avocado';
import { Bone } from 'phosphor-react-native/src/icons/Bone';
import { Bug } from 'phosphor-react-native/src/icons/Bug';
import { Cherries } from 'phosphor-react-native/src/icons/Cherries';
import { Coffee } from 'phosphor-react-native/src/icons/Coffee';
import { Cookie } from 'phosphor-react-native/src/icons/Cookie';
import { Cube } from 'phosphor-react-native/src/icons/Cube';
import { FlowerLotus } from 'phosphor-react-native/src/icons/FlowerLotus';
import { Leaf } from 'phosphor-react-native/src/icons/Leaf';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { Nut } from 'phosphor-react-native/src/icons/Nut';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { Pill } from 'phosphor-react-native/src/icons/Pill';
import { Plant } from 'phosphor-react-native/src/icons/Plant';
import { Skull } from 'phosphor-react-native/src/icons/Skull';
import { SprayBottle } from 'phosphor-react-native/src/icons/SprayBottle';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { Wine } from 'phosphor-react-native/src/icons/Wine';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { buscarToxicos, textoRevisao, type ItemToxico } from '../../src/sos/conteudo';
import { usePacoteEmergencia } from '../../src/sos/pacote';
import { colors } from '../../src/theme/colors';
import { shadow, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { estaOffline } from '../../src/lib/cacheOffline';
import { registrarEvento } from '../../src/lib/eventos';

type IconeFosforo = ComponentType<{ size?: number; color?: string }>;

const SELO: Record<ItemToxico['risco'], { texto: string; fundo: string; cor: string }> = {
  perigoso: { texto: 'Perigoso', fundo: '#FDE0E6', cor: '#A3324F' },
  cuidado: { texto: 'Cuidado', fundo: '#FFF0C9', cor: '#8A6414' },
};

// Ícone de cada item do pacote; um item novo sem ícone usa o alerta.
const ICONES: Record<string, IconeFosforo> = {
  chocolate: Cookie,
  uva: Cherries,
  'cebola-alho': Plant,
  xilitol: Cube,
  lirio: FlowerLotus,
  'remedio-humano': Pill,
  'antipulgas-gato': Bug,
  'veneno-rato': Skull,
  'produtos-limpeza': SprayBottle,
  macadamia: Nut,
  alcool: Wine,
  cafe: Coffee,
  abacate: Avocado,
  'osso-cozido': Bone,
  'comigo-ninguem-pode': Leaf,
};

function paraQuem(item: ItemToxico): string | null {
  if (item.especies.length === 2) return null;
  return item.especies[0] === 'gato' ? 'Só gatos' : 'Só cães';
}

/**
 * O que intoxica o pet (tela 48, protótipo Intoxicacao; board P1 "O que
 * intoxica o pet: busca, risco e o que fazer, sem internet"). Lista
 * pesquisável, perigosos primeiro; tocar abre sintomas e o que fazer.
 */
export default function Intoxicacao() {
  const pacote = usePacoteEmergencia();

  // Acessos ao guia offline (métrica da Fase 1); "offline" é a última leitura sem rede.
  useEffect(() => {
    registrarEvento('guia_aberto', { guia: 'intoxicacao', offline: estaOffline() });
  }, []);
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);

  const itens = useMemo(() => buscarToxicos(pacote.toxicos, busca), [pacote, busca]);

  function alternar(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberto((atual) => (atual === id ? null : id));
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda titulo="O que intoxica" />

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.busca}>
          <MagnifyingGlass size={20} color={colors.black} />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar alimento ou produto"
            placeholderTextColor={colors.textMuted}
            style={estilos.buscaCampo}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar alimento ou produto"
          />
        </View>

        {itens.length > 0 ? (
          <View style={estilos.lista}>
            {itens.map((item, i) => {
              const selo = SELO[item.risco];
              const estaAberto = aberto === item.id;
              const especie = paraQuem(item);
              const Desenho = ICONES[item.id] ?? Warning;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: estaAberto }}
                  accessibilityLabel={`${item.nome}, ${selo.texto}`}
                  onPress={() => alternar(item.id)}
                  style={({ pressed }) => [estilos.item, i > 0 && estilos.divisor, pressed && { opacity: 0.7 }]}
                >
                  <View style={estilos.itemTopo}>
                    <View style={[estilos.icone, { backgroundColor: selo.fundo }]}>
                      <Desenho size={20} color={selo.cor} />
                    </View>
                    <View style={estilos.flex}>
                      <Text style={estilos.itemNome}>{item.nome}</Text>
                      <Text style={estilos.itemResumo} numberOfLines={estaAberto ? undefined : 1}>
                        {especie ? `${especie} · ` : ''}
                        {item.resumo}
                      </Text>
                    </View>
                    <Text style={[estilos.selo, { backgroundColor: selo.fundo, color: selo.cor }]}>{selo.texto}</Text>
                  </View>

                  {estaAberto ? (
                    <View style={estilos.detalhe}>
                      <Text style={estilos.detalheRotulo}>Sintomas comuns</Text>
                      <Text style={estilos.detalheTexto}>{item.sintomas}</Text>
                      <Text style={estilos.detalheRotulo}>O que fazer</Text>
                      <Text style={estilos.detalheTexto}>{item.oQueFazer}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={estilos.vazio}>
            Não achamos “{busca.trim()}” na lista. Na dúvida, ligue para a clínica.
          </Text>
        )}

        <Text style={estilos.nota}>
          A gravidade depende da quantidade e do peso do pet. Na dúvida, ligue para a clínica.
        </Text>
        <Text style={estilos.nota}>{textoRevisao(pacote)}</Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Comeu algo? Ligar para a clínica"
          fundo={colors.emergency}
          icone={<Phone size={20} />}
          onPress={() => router.navigate('/sos')}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 20, paddingBottom: spacing.lg, gap: 14 },
  busca: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    ...shadow.card,
  },
  buscaCampo: {
    flex: 1,
    fontSize: 15,
    fontFamily: typography.caption.fontFamily,
    color: colors.black,
    paddingVertical: 0,
  },
  lista: { backgroundColor: colors.surface, borderRadius: 26, ...shadow.card },
  item: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  divisor: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemNome: { fontSize: 16, lineHeight: 21, fontFamily: typography.h1.fontFamily, color: colors.black },
  itemResumo: { fontSize: 14, lineHeight: 19, fontFamily: typography.caption.fontFamily, color: colors.textMuted },
  selo: {
    fontSize: 12,
    fontFamily: typography.h1.fontFamily,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detalhe: { backgroundColor: colors.background, borderRadius: 16, padding: 12, gap: 2, marginLeft: 56 },
  detalheRotulo: { fontSize: 11, fontFamily: typography.h1.fontFamily, color: colors.textMuted, marginTop: 4 },
  detalheTexto: { fontSize: 13, lineHeight: 19, fontFamily: typography.caption.fontFamily, color: colors.black },
  vazio: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  nota: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.small.fontFamily,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, backgroundColor: colors.background },
});
