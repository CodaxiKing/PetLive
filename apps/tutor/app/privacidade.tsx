import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { Icone } from '../src/components/Icone';
import { Interruptor } from '../src/components/Interruptor';
import { LinhaIcone } from '../src/components/LinhaIcone';
import { useAuth } from '../src/auth/AuthProvider';
import {
  carregarConsentimentos,
  registrarConsentimento,
  type EstadoConsentimento,
  type TipoConsentimento,
} from '../src/privacidade/consentimentos';
import { excluirMinhaConta, exportarMeusDados } from '../src/privacidade/conta';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

type Alternavel = { tipo: TipoConsentimento; rotulo: string; descricao: string };

const ALTERNAVEIS: Alternavel[] = [
  { tipo: 'localizacao', rotulo: 'Localização', descricao: 'Mapa, SOS e lugares perto' },
  { tipo: 'dicas_novidades', rotulo: 'Dicas e novidades', descricao: 'Avisos que não são de saúde' },
];

/**
 * Privacidade e dados (tela 99, protótipo PrivacidadeDados; board P0
 * "Privacidade e dados: consentimentos, quem acessa os dados do pet,
 * exportar e excluir conta"). Cada mudança de consentimento é uma nova
 * linha no log (LGPD). Cuidadores e fichas de emergência chegam na Fase 2;
 * até lá a seção mostra que só o tutor vê os dados.
 */
export default function Privacidade() {
  const { user } = useAuth();
  const [estados, setEstados] = useState<Record<string, EstadoConsentimento>>({});
  const [processando, setProcessando] = useState(false);

  const recarregar = useCallback(() => {
    carregarConsentimentos().then(
      (lista) => {
        const porTipo: Record<string, EstadoConsentimento> = {};
        for (const estado of lista) porTipo[estado.tipo] = estado;
        setEstados(porTipo);
      },
      () => undefined,
    );
  }, []);

  useFocusEffect(recarregar);

  async function alternar(item: Alternavel) {
    if (processando) return;
    const ligado = !(estados[item.tipo]?.aceito === true);
    setProcessando(true);
    try {
      await registrarConsentimento(item.tipo, ligado);
      recarregar();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(false);
    }
  }

  function exportar() {
    if (processando) return;
    setProcessando(true);
    exportarMeusDados()
      .catch((e) => Alert.alert('Não foi possível exportar', e instanceof Error ? e.message : String(e)))
      .finally(() => setProcessando(false));
  }

  function excluirConta() {
    if (processando || !user) return;
    Alert.alert(
      'Excluir conta?',
      'Seus dados, pets, remédios, lembretes e fotos serão apagados. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            setProcessando(true);
            excluirMinhaConta(user.id)
              .then(() => router.replace('/welcome'))
              .catch((e) =>
                Alert.alert('Não foi possível excluir', e instanceof Error ? e.message : String(e)),
              )
              .finally(() => setProcessando(false));
          },
        },
      ],
    );
  }

  const seta = <Icone nome="seta" size={16} cor={colors.textMuted} />;

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Conta" titulo="Privacidade e dados" />

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <Text style={estilos.secao}>CONSENTIMENTOS</Text>
        {ALTERNAVEIS.map((item) => (
          <View key={item.tipo} style={estilos.consentimento}>
            <View style={estilos.flex}>
              <Text style={estilos.consentimentoRotulo}>{item.rotulo}</Text>
              <Text style={estilos.consentimentoDescricao}>{item.descricao}</Text>
            </View>
            <Interruptor
              ligado={estados[item.tipo]?.aceito === true}
              rotulo={item.rotulo}
              desabilitado={processando}
              onToggle={() => alternar(item)}
            />
          </View>
        ))}
        <LinhaIcone
          icone={<Icone nome="escudo" />}
          rotulo="Termos de uso e política de privacidade"
          valor="Ler e rever o aceite"
          onPress={() => router.push('/termos')}
          direita={seta}
        />

        <Text style={[estilos.secao, estilos.secaoEspaco]}>QUEM VÊ OS DADOS DO PET</Text>
        <LinhaIcone icone={<Icone nome="pessoas" />} rotulo="Família e cuidadores" valor="Só você, por enquanto" />
        <LinhaIcone
          icone={<Icone nome="escudo" />}
          rotulo="QR da coleira e ficha de emergência"
          valor="Nenhuma ficha ativa"
        />

        <Text style={[estilos.secao, estilos.secaoEspaco]}>MEUS DADOS</Text>
        <LinhaIcone
          icone={<Icone nome="livro" />}
          rotulo="Exportar meus dados"
          valor="Arquivo com tudo, para salvar ou enviar"
          onPress={exportar}
          desabilitado={processando}
          direita={seta}
        />
        <LinhaIcone
          icone={<Icone nome="bandeira" />}
          rotulo="Excluir minha conta"
          valor="Apaga a conta e os dados"
          fundo="#FDE0E6"
          onPress={excluirConta}
          desabilitado={processando}
          direita={seta}
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 40, gap: 8 },
  secao: { fontSize: 12, fontFamily: typography.h1.fontFamily, color: '#6A7484' },
  secaoEspaco: { marginTop: 4 },
  consentimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  consentimentoRotulo: { fontSize: 14, lineHeight: 19, fontFamily: typography.h1.fontFamily, color: colors.black },
  consentimentoDescricao: { ...typography.small, color: colors.textMuted },
});
