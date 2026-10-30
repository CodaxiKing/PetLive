import { useEffect, useState, type ComponentType } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bug } from 'phosphor-react-native/src/icons/Bug';
import { Car } from 'phosphor-react-native/src/icons/Car';
import { Drop } from 'phosphor-react-native/src/icons/Drop';
import { FirstAid } from 'phosphor-react-native/src/icons/FirstAid';
import { Lightning } from 'phosphor-react-native/src/icons/Lightning';
import { Minus } from 'phosphor-react-native/src/icons/Minus';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { WifiSlash } from 'phosphor-react-native/src/icons/WifiSlash';
import { Wind } from 'phosphor-react-native/src/icons/Wind';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { textoRevisao } from '../../src/sos/conteudo';
import { usePacoteEmergencia } from '../../src/sos/pacote';
import { colors } from '../../src/theme/colors';
import { shadow, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { estaOffline } from '../../src/lib/cacheOffline';
import { registrarEvento } from '../../src/lib/eventos';

const AMARELO = '#FFF0C9';
const AMARELO_TEXTO = '#8A6414';

// Ícone de cada situação do pacote; uma situação nova sem ícone usa o kit.
const ICONES: Record<string, ComponentType<{ size?: number; color?: string }>> = {
  engasgo: Wind,
  'golpe-de-calor': Sun,
  convulsao: Lightning,
  sangramento: Drop,
  'picada-mordida': Bug,
  'atropelamento-queda': Car,
};

/**
 * Primeiros socorros (tela 47, protótipo PrimeirosSocorros; board P1
 * "Primeiros socorros: situações e passo a passo, sem internet"). Uma
 * situação aberta por vez, passos numerados e o atalho para a clínica.
 */
export default function PrimeirosSocorros() {
  const pacote = usePacoteEmergencia();

  // Acessos ao guia offline (métrica da Fase 1); "offline" é a última leitura sem rede.
  useEffect(() => {
    registrarEvento('guia_aberto', { guia: 'primeiros_socorros', offline: estaOffline() });
  }, []);
  const [aberta, setAberta] = useState<string | null>(null);

  function alternar(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAberta((atual) => (atual === id ? null : id));
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda titulo="Primeiros socorros">
        <View style={estilos.offline}>
          <WifiSlash size={16} color={colors.successText} weight="bold" />
          <Text style={estilos.offlineTexto}>Funciona sem internet</Text>
        </View>
      </HeroiOnda>

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {pacote.primeirosSocorros.map((situacao) => {
          const estaAberta = aberta === situacao.id;
          const Desenho = ICONES[situacao.id] ?? FirstAid;
          return (
            <View key={situacao.id} style={[estilos.cartao, estaAberta && estilos.cartaoAberto]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: estaAberta }}
                onPress={() => alternar(situacao.id)}
                style={({ pressed }) => [estilos.situacao, pressed && { opacity: 0.7 }]}
              >
                <View style={estilos.icone}>
                  <Desenho size={22} color={AMARELO_TEXTO} />
                </View>
                <Text style={estilos.situacaoTitulo}>{situacao.titulo}</Text>
                {estaAberta ? <Minus size={22} color={colors.textMuted} /> : <Plus size={22} color={colors.textMuted} />}
              </Pressable>

              {estaAberta ? (
                <View style={estilos.passos}>
                  {situacao.passos.map((passo, i) => (
                    <View key={passo} style={estilos.passo}>
                      <View style={estilos.numero}>
                        <Text style={estilos.numeroTexto}>{i + 1}</Text>
                      </View>
                      <Text style={estilos.passoTexto}>{passo}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        <Text style={estilos.nota}>{textoRevisao(pacote)}</Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Clínica 24 h mais perto"
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
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.successSurface,
  },
  offlineTexto: { fontSize: 13, fontFamily: typography.h1.fontFamily, color: colors.successText },
  conteudo: { paddingHorizontal: 20, paddingBottom: spacing.lg, gap: 10 },
  cartao: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow.card,
  },
  cartaoAberto: { borderColor: AMARELO },
  situacao: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  icone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: AMARELO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  situacaoTitulo: { flex: 1, fontSize: 16, lineHeight: 21, fontFamily: typography.h1.fontFamily, color: colors.black },
  passos: { paddingHorizontal: 18, paddingBottom: 18, paddingTop: 4, gap: 14 },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: { fontSize: 13, fontFamily: typography.h1.fontFamily, color: colors.white },
  passoTexto: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    paddingTop: 3,
    fontFamily: typography.caption.fontFamily,
    color: colors.black,
  },
  nota: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: typography.small.fontFamily,
    color: colors.textMuted,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  rodape: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, backgroundColor: colors.background },
});
