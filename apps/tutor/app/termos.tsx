import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { Icone } from '../src/components/Icone';
import {
  aceitoNaVersaoAtual,
  carregarConsentimentos,
  registrarConsentimento,
  type EstadoConsentimento,
  type TipoConsentimento,
} from '../src/privacidade/consentimentos';
import { SECOES_TERMOS, VERSAO_TERMOS_TEXTO } from '../src/privacidade/textos';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/tokens';
import { typography } from '../src/theme/typography';
import { textoDeErro } from '../src/lib/erros';

type ItemConsentimento = {
  tipo: TipoConsentimento;
  rotulo: string;
  descricao: string;
  obrigatorio: boolean;
};

const ITENS: ItemConsentimento[] = [
  {
    tipo: 'termos_uso',
    rotulo: 'Termos de uso',
    descricao: 'Li e aceito as regras de uso do PetLive.',
    obrigatorio: true,
  },
  {
    tipo: 'politica_privacidade',
    rotulo: 'Política de privacidade',
    descricao: 'Entendi quais dados o app usa e por quê.',
    obrigatorio: true,
  },
  {
    tipo: 'localizacao',
    rotulo: 'Localização',
    descricao: 'Para mostrar lugares perto de você e o SOS. Você escolhe quando.',
    obrigatorio: false,
  },
  {
    tipo: 'dicas_novidades',
    rotulo: 'Dicas e novidades',
    descricao: 'Receber avisos sobre cuidados e novidades do PetLive.',
    obrigatorio: false,
  },
];

/**
 * Termos e consentimento (tela 97, protótipo TermosConsentimento; board P0
 * "Tela de termos e política de privacidade com consentimentos separados").
 * Termos e política são obrigatórios; localização e dicas são opcionais e
 * marcados à parte. Cada escolha vira uma linha em `consentimentos`, com a
 * versão do texto. No primeiro acesso segue para as Permissões.
 */
export default function Termos() {
  const { primeiroAcesso } = useLocalSearchParams<{ primeiroAcesso?: string }>();
  const ehPrimeiroAcesso = primeiroAcesso === '1';

  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [salvos, setSalvos] = useState<Record<string, EstadoConsentimento>>({});
  const [registrando, setRegistrando] = useState(false);
  const [textoAberto, setTextoAberto] = useState(false);

  const recarregar = useCallback(() => {
    carregarConsentimentos().then(
      (lista) => {
        const porTipo: Record<string, EstadoConsentimento> = {};
        for (const estado of lista) porTipo[estado.tipo] = estado;
        setSalvos(porTipo);
        // Marca o que já vale na versão atual; o resto começa desmarcado.
        setMarcados(
          Object.fromEntries(ITENS.map((item) => [item.tipo, aceitoNaVersaoAtual(porTipo[item.tipo])])),
        );
      },
      () => undefined, // sem rede: tudo desmarcado, o tutor marca de novo
    );
  }, []);

  useFocusEffect(recarregar);

  const obrigatoriosOk = ITENS.every((item) => !item.obrigatorio || marcados[item.tipo]);

  async function aceitar() {
    if (registrando || !obrigatoriosOk) return;
    setRegistrando(true);
    try {
      // Grava só o que mudou em relação ao estado salvo (o log é append-only).
      for (const item of ITENS) {
        const marcado = Boolean(marcados[item.tipo]);
        if (aceitoNaVersaoAtual(salvos[item.tipo]) === marcado && salvos[item.tipo]) continue;
        if (!marcado && !salvos[item.tipo]) continue; // nunca aceito: nada a revogar
        await registrarConsentimento(item.tipo, marcado);
      }
      if (ehPrimeiroAcesso) {
        router.replace('/permissoes?primeiroAcesso=1');
      } else {
        router.back();
      }
    } catch (e) {
      Alert.alert('Não foi possível registrar', textoDeErro(e));
    } finally {
      setRegistrando(false);
    }
  }

  return (
    <View style={estilos.tela}>
      <HeroiOnda
        subtitulo={ehPrimeiroAcesso ? 'Quase lá' : 'Conta'}
        titulo="Termos e privacidade"
        semVoltar={ehPrimeiroAcesso}
      />

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        {ITENS.map((item) => {
          const marcado = Boolean(marcados[item.tipo]);
          return (
            <Pressable
              key={item.tipo}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado }}
              accessibilityLabel={`${item.rotulo}${item.obrigatorio ? ', obrigatório' : ''}`}
              onPress={() => setMarcados((atual) => ({ ...atual, [item.tipo]: !marcado }))}
              style={({ pressed }) => [estilos.item, pressed && { opacity: 0.75 }]}
            >
              <View style={[estilos.caixa, marcado ? estilos.caixaMarcada : estilos.caixaVazia]}>
                {marcado ? <Text style={estilos.check}>✓</Text> : null}
              </View>
              <View style={estilos.flex}>
                <Text style={estilos.itemRotulo}>
                  {item.rotulo}
                  {item.obrigatorio ? <Text style={estilos.obrigatorio}>  obrigatório</Text> : null}
                </Text>
                <Text style={estilos.itemDescricao}>{item.descricao}</Text>
              </View>
            </Pressable>
          );
        })}

        <Pressable accessibilityRole="link" onPress={() => setTextoAberto(true)} hitSlop={8}>
          <Text style={estilos.link}>Ler os termos e a política completos</Text>
        </Pressable>

        <Text style={estilos.nota}>
          O PetLive organiza informações e não substitui o atendimento veterinário. Você muda tudo isso
          depois em Privacidade e dados.
        </Text>
      </ScrollView>

      <View style={estilos.rodape}>
        <BotaoPrimario
          titulo={ehPrimeiroAcesso ? 'Aceitar e continuar' : 'Salvar escolhas'}
          icone={<Icone nome="escudo" size={22} />}
          carregando={registrando}
          desabilitado={!obrigatoriosOk}
          onPress={aceitar}
        />
      </View>

      <Modal
        visible={textoAberto}
        animationType="slide"
        transparent
        onRequestClose={() => setTextoAberto(false)}
      >
        <View style={estilos.fundoModal}>
          <View style={estilos.folha}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={estilos.folhaConteudo}>
              <Text style={estilos.folhaTitulo}>Termos de uso e privacidade</Text>
              {SECOES_TERMOS.map((secao) => (
                <View key={secao.titulo} style={estilos.secao}>
                  <Text style={estilos.secaoTitulo}>{secao.titulo}</Text>
                  <Text style={estilos.secaoTexto}>{secao.paragrafo}</Text>
                </View>
              ))}
              <Text style={estilos.versao}>{VERSAO_TERMOS_TEXTO}</Text>
            </ScrollView>
            <BotaoPrimario titulo="Fechar" onPress={() => setTextoAberto(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  caixa: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  caixaMarcada: { backgroundColor: colors.black },
  caixaVazia: { borderWidth: 2, borderColor: '#D5DAE2' },
  check: { color: colors.primary, fontSize: 14, fontFamily: typography.overline.fontFamily },
  itemRotulo: { ...typography.captionMedium, fontFamily: typography.h1.fontFamily, color: colors.black },
  obrigatorio: { fontSize: 11, fontFamily: typography.h1.fontFamily, color: '#A3324F' },
  itemDescricao: { ...typography.small, lineHeight: 17, color: colors.textMuted },
  link: {
    ...typography.captionMedium,
    color: colors.primaryDeep,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  nota: {
    ...typography.small,
    fontSize: 11,
    lineHeight: 16,
    color: '#566070',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: 32,
    maxHeight: '86%',
    gap: spacing.md,
  },
  folhaConteudo: { gap: spacing.md },
  folhaTitulo: { ...typography.h2, color: colors.black },
  secao: { gap: 2 },
  secaoTitulo: { ...typography.bodyMedium, color: colors.text },
  secaoTexto: { ...typography.caption, lineHeight: 21, color: colors.textMuted },
  versao: { ...typography.small, color: colors.textMuted },
});
