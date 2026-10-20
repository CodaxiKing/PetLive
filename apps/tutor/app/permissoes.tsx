import { useCallback, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { Icone, type NomeIcone } from '../src/components/Icone';
import { registrarConsentimento, type TipoConsentimento } from '../src/privacidade/consentimentos';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/tokens';
import { typography } from '../src/theme/typography';

type Estado = 'pendente' | 'concedida' | 'negada' | 'adiada';

type Permissao = {
  chave: 'avisos' | 'localizacao';
  consentimento: TipoConsentimento;
  titulo: string;
  descricao: string;
  icone: NomeIcone;
  fundo: string;
  consultar: () => Promise<{ status: string; canAskAgain: boolean }>;
  pedir: () => Promise<{ status: string; canAskAgain: boolean }>;
};

const PERMISSOES: Permissao[] = [
  {
    chave: 'avisos',
    consentimento: 'avisos_push',
    titulo: 'Avisos',
    descricao: 'Lembretes de vacina, vermífugo e remédio na hora certa.',
    icone: 'sino',
    fundo: '#FFF0C9',
    consultar: () => Notifications.getPermissionsAsync(),
    pedir: () => Notifications.requestPermissionsAsync(),
  },
  {
    chave: 'localizacao',
    consentimento: 'localizacao',
    titulo: 'Localização ao usar o app',
    descricao: 'Clínicas, petshops e o SOS com a clínica 24 h mais perto.',
    icone: 'local',
    fundo: '#E0F1FA',
    consultar: () => Location.getForegroundPermissionsAsync(),
    pedir: () => Location.requestForegroundPermissionsAsync(),
  },
];

function traduzir(status: string): Estado {
  if (status === 'granted') return 'concedida';
  if (status === 'denied') return 'negada';
  return 'pendente';
}

/**
 * Permissões do app (tela 98, protótipo PermissoesApp; board P0 "Tela de
 * permissões: avisos e localização ao usar o app"). Explica cada pedido
 * antes do diálogo do sistema; "Agora não" não pergunta nada ao sistema.
 * Câmera e fotos só são pedidas na hora de usar.
 */
export default function Permissoes() {
  const { primeiroAcesso } = useLocalSearchParams<{ primeiroAcesso?: string }>();
  const ehPrimeiroAcesso = primeiroAcesso === '1';

  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [podePerguntar, setPodePerguntar] = useState<Record<string, boolean>>({});
  const [pedindo, setPedindo] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    for (const permissao of PERMISSOES) {
      permissao.consultar().then(
        (resultado) => {
          setEstados((atual) =>
            // "Agora não" vale até sair da tela, se o sistema ainda não sabe.
            atual[permissao.chave] === 'adiada' && resultado.status === 'undetermined'
              ? atual
              : { ...atual, [permissao.chave]: traduzir(resultado.status) },
          );
          setPodePerguntar((atual) => ({ ...atual, [permissao.chave]: resultado.canAskAgain }));
        },
        () => undefined,
      );
    }
  }, []);

  useFocusEffect(recarregar);

  async function permitir(permissao: Permissao) {
    if (pedindo) return;
    // Negada sem poder perguntar de novo: só pelas configurações do sistema.
    if (estados[permissao.chave] === 'negada' && podePerguntar[permissao.chave] === false) {
      Linking.openSettings().catch(() => undefined);
      return;
    }
    setPedindo(permissao.chave);
    try {
      const resultado = await permissao.pedir();
      const estado = traduzir(resultado.status);
      setEstados((atual) => ({ ...atual, [permissao.chave]: estado }));
      setPodePerguntar((atual) => ({ ...atual, [permissao.chave]: resultado.canAskAgain }));
      // Registro do consentimento (LGPD); falha de rede não trava a tela.
      if (estado !== 'pendente') {
        registrarConsentimento(permissao.consentimento, estado === 'concedida').catch(() => undefined);
      }
    } catch {
      // O sistema recusou o pedido (ex.: web); a tela segue com o estado anterior.
    } finally {
      setPedindo(null);
    }
  }

  function continuar() {
    if (ehPrimeiroAcesso) {
      router.replace('/inicio');
    } else {
      router.back();
    }
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Para funcionar melhor" titulo="Permissões" semVoltar={ehPrimeiroAcesso} />

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {PERMISSOES.map((permissao) => {
          const estado = estados[permissao.chave] ?? 'pendente';
          return (
            <View key={permissao.chave} style={[estilos.cartao, { backgroundColor: permissao.fundo }]}>
              <View style={estilos.topo}>
                <View style={estilos.circulo}>
                  <Icone nome={permissao.icone} size={20} />
                </View>
                <View style={estilos.flex}>
                  <Text style={estilos.titulo}>{permissao.titulo}</Text>
                  <Text style={estilos.descricao}>{permissao.descricao}</Text>
                </View>
              </View>

              {estado === 'concedida' ? (
                <View style={[estilos.botao, estilos.botaoClaro]}>
                  <Text style={estilos.botaoTextoEscuro}>✓ Permitido</Text>
                </View>
              ) : (
                <View style={estilos.botoes}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Permitir ${permissao.titulo}`}
                    disabled={pedindo !== null}
                    onPress={() => permitir(permissao)}
                    style={({ pressed }) => [estilos.botao, estilos.botaoEscuro, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={estilos.botaoTextoClaro}>
                      {estado === 'negada' && podePerguntar[permissao.chave] === false
                        ? 'Abrir ajustes'
                        : 'Permitir'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Agora não: ${permissao.titulo}`}
                    accessibilityState={{ selected: estado === 'adiada' || estado === 'negada' }}
                    disabled={pedindo !== null}
                    onPress={() => setEstados((atual) => ({ ...atual, [permissao.chave]: 'adiada' }))}
                    style={({ pressed }) => [
                      estilos.botao,
                      estilos.botaoClaro,
                      (estado === 'adiada' || estado === 'negada') && estilos.botaoEscolhido,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={estilos.botaoTextoEscuro}>Agora não</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        <Text style={estilos.nota}>
          Câmera e fotos só são pedidas na hora de usar, por exemplo para a foto do pet. Você pode mudar
          tudo em Ajustes.
        </Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo="Continuar"
          icone={<Icone nome="casa" size={22} />}
          onPress={continuar}
        />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: 10 },
  cartao: { borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circulo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 15, lineHeight: 20, fontFamily: typography.h1.fontFamily, color: colors.black },
  descricao: { ...typography.small, lineHeight: 17, color: '#3C4656' },
  botoes: { flexDirection: 'row', gap: 8 },
  botao: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoEscuro: { backgroundColor: colors.black },
  botaoClaro: { backgroundColor: colors.white },
  botaoEscolhido: { borderWidth: 1.5, borderColor: colors.black },
  botaoTextoClaro: { fontSize: 13, fontFamily: typography.h1.fontFamily, color: colors.white },
  botaoTextoEscuro: { fontSize: 13, fontFamily: typography.h1.fontFamily, color: colors.black },
  nota: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.small.fontFamily,
    color: '#6A7484',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
