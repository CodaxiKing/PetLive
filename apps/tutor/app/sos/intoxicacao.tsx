import { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { buscarToxicos, textoRevisao, type ItemToxico } from '../../src/sos/conteudo';
import { usePacoteEmergencia } from '../../src/sos/pacote';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { estaOffline } from '../../src/lib/cacheOffline';
import { registrarEvento } from '../../src/lib/eventos';

const AMARELO = '#FFF0C9';

const SELO: Record<ItemToxico['risco'], { texto: string; fundo: string; cor: string }> = {
  perigoso: { texto: 'Perigoso', fundo: '#FDE0E6', cor: '#A3324F' },
  cuidado: { texto: 'Cuidado', fundo: AMARELO, cor: '#8A6414' },
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
      <HeroiOnda fundo={AMARELO} subtitulo="Emergência" titulo="O que intoxica" selo="Funciona sem internet" />

      <ScrollView
        contentContainerStyle={estilos.conteudo}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={estilos.busca}>
          <Icone nome="busca" size={18} cor="#566070" />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar um alimento ou produto"
            placeholderTextColor="#566070"
            style={estilos.buscaCampo}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar um alimento ou produto"
          />
        </View>

        {itens.map((item) => {
          const selo = SELO[item.risco];
          const estaAberto = aberto === item.id;
          const especie = paraQuem(item);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ expanded: estaAberto }}
              accessibilityLabel={`${item.nome}, ${selo.texto}`}
              onPress={() => alternar(item.id)}
              style={({ pressed }) => [estilos.item, pressed && { opacity: 0.8 }]}
            >
              <View style={estilos.itemTopo}>
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

        {itens.length === 0 ? (
          <Text style={estilos.vazio}>
            Não achamos “{busca.trim()}” na lista. Na dúvida, ligue para a clínica.
          </Text>
        ) : null}

        <Text style={estilos.nota}>
          A gravidade depende da quantidade e do peso do pet. Na dúvida, ligue para a clínica.
        </Text>
        <Text style={estilos.nota}>{textoRevisao(pacote)}</Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Comeu algo? Ligar agora"
          icone={<Icone nome="telefone" size={22} />}
          onPress={() => router.navigate('/sos')}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: 8 },
  busca: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F6FA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  buscaCampo: {
    flex: 1,
    fontSize: 14,
    fontFamily: typography.caption.fontFamily,
    color: colors.black,
    paddingVertical: 0,
  },
  item: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  itemTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemNome: { fontSize: 14, lineHeight: 19, fontFamily: typography.h1.fontFamily, color: colors.black },
  itemResumo: { ...typography.small, color: colors.textMuted },
  selo: {
    fontSize: 11,
    fontFamily: typography.h1.fontFamily,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detalhe: { backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 2 },
  detalheRotulo: { fontSize: 11, fontFamily: typography.h1.fontFamily, color: '#566070', marginTop: 4 },
  detalheTexto: { fontSize: 13, lineHeight: 19, fontFamily: typography.caption.fontFamily, color: colors.black },
  vazio: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  nota: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.small.fontFamily,
    color: '#566070',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
