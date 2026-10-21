import { useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { textoRevisao } from '../../src/sos/conteudo';
import { usePacoteEmergencia } from '../../src/sos/pacote';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';
import { estaOffline } from '../../src/lib/cacheOffline';
import { registrarEvento } from '../../src/lib/eventos';

const ROSA = '#FDE0E6';

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
      <HeroiOnda subtitulo="Emergência" titulo="Primeiros socorros" selo="Funciona sem internet" />

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {pacote.primeirosSocorros.map((situacao) => {
          const estaAberta = aberta === situacao.id;
          return (
            <View key={situacao.id} style={estilos.bloco}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: estaAberta }}
                onPress={() => alternar(situacao.id)}
                style={({ pressed }) => [
                  estilos.situacao,
                  estaAberta && { backgroundColor: ROSA },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={estilos.situacaoTitulo}>{situacao.titulo}</Text>
                <Text style={estilos.sinal}>{estaAberta ? '−' : '+'}</Text>
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
          icone={<Icone nome="local" size={22} />}
          onPress={() => router.navigate('/sos')}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: 8 },
  bloco: { gap: 8 },
  situacao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  situacaoTitulo: { fontSize: 14, lineHeight: 19, fontFamily: typography.h1.fontFamily, color: colors.black },
  sinal: { fontFamily: fontFamily.regular, fontSize: 18, lineHeight: 20, color: colors.black },
  passos: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: ROSA,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  numero: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroTexto: { fontSize: 13, fontFamily: typography.overline.fontFamily, color: colors.primary },
  passoTexto: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 3,
    fontFamily: typography.caption.fontFamily,
    color: colors.black,
  },
  nota: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.small.fontFamily,
    color: '#6A7484',
    textAlign: 'center',
    paddingHorizontal: 6,
    marginTop: 4,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
