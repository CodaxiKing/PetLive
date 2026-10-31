import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { carregarCompartilhamentos, textoCompartilhamento, type ResumoCompartilhamentos } from '../src/privacidade/compartilhamentos';
import { HeroiOnda } from '../src/components/HeroiOnda';
import { Icone } from '../src/components/Icone';
import { Interruptor } from '../src/components/Interruptor';
import { LinhaIcone } from '../src/components/LinhaIcone';
import {
  carregarConsentimentos,
  registrarConsentimento,
  type EstadoConsentimento,
  type TipoConsentimento,
} from '../src/privacidade/consentimentos';
import {
  cancelarExclusaoConta,
  carregarEstadoPrivacidade,
  type EstadoPrivacidade,
  exportarMeusDados,
  solicitarExclusaoConta,
} from '../src/privacidade/conta';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';
import { textoDeErro } from '../src/lib/erros';

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
  const [exclusao, setExclusao] = useState<EstadoPrivacidade | null>(null);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acessos, setAcessos] = useState<ResumoCompartilhamentos | null>(null);
  const geracao = useRef(0);
  const [estados, setEstados] = useState<Record<string, EstadoConsentimento>>({});
  const [processando, setProcessando] = useState(false);

  const recarregar = useCallback(() => {
    const token = ++geracao.current;
    setExclusao(null); setEstados({}); setAcessos(null); setErroConsulta(null); setCarregando(true); setProcessando(false);
    if (!user) { setCarregando(false); return; }
    Promise.all([carregarConsentimentos(), carregarEstadoPrivacidade(user.id), carregarCompartilhamentos(user.id)]).then(
      ([lista, estado, resumo]) => {
        if (token !== geracao.current) return;
        const porTipo: Record<string, EstadoConsentimento> = {};
        for (const estado of lista) porTipo[estado.tipo] = estado;
        setEstados(porTipo);
        setExclusao(estado);
        setAcessos(resumo);
      },
      (e) => { if (token === geracao.current) setErroConsulta(textoDeErro(e)); },
    ).finally(() => { if (token === geracao.current) setCarregando(false); });
  }, [user]);

  useFocusEffect(useCallback(() => { recarregar(); return () => { geracao.current++; }; }, [recarregar]));

  async function alternar(item: Alternavel) {
    if (processando || carregando || erroConsulta) return;
    const token = geracao.current;
    const ligado = !(estados[item.tipo]?.aceito === true);
    setProcessando(true);
    try {
      await registrarConsentimento(item.tipo, ligado);
      if (token === geracao.current) recarregar();
    } catch (e) {
      if (token === geracao.current) Alert.alert('Não foi possível salvar', textoDeErro(e));
    } finally {
      if (token === geracao.current) setProcessando(false);
    }
  }

  function exportar() {
    if (processando) return;
    const token = geracao.current;
    setProcessando(true);
    exportarMeusDados()
      .catch((e) => { if (token === geracao.current) Alert.alert('Não foi possível exportar', textoDeErro(e)); })
      .finally(() => { if (token === geracao.current) setProcessando(false); });
  }

  function excluirConta() {
    if (processando || !user || !exclusao?.podeSolicitar) return;
    const token = geracao.current;
    Alert.alert(
      'Excluir conta?',
      'Sua conta, pets, remédios, lembretes e fotos serão apagados em 30 dias. Até lá você pode cancelar aqui.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            if (token !== geracao.current) return;
            setProcessando(true);
            solicitarExclusaoConta(user.id)
              .then(() => { if (token === geracao.current) recarregar(); })
              .catch((e) =>
                token === geracao.current && Alert.alert('Não foi possível pedir', textoDeErro(e)),
              )
              .finally(() => { if (token === geracao.current) setProcessando(false); });
          },
        },
      ],
    );
  }

  function cancelarExclusao() {
    if (processando || !user || !exclusao?.pedidoId || !exclusao.podeCancelar) return;
    const token = geracao.current;
    setProcessando(true);
    cancelarExclusaoConta(user.id, exclusao.pedidoId)
      .then(() => { if (token === geracao.current) recarregar(); })
      .catch((e) => { if (token === geracao.current) Alert.alert('Não foi possível cancelar', textoDeErro(e)); })
      .finally(() => { if (token === geracao.current) setProcessando(false); });
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
              desabilitado={processando || carregando || Boolean(erroConsulta)}
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
        <LinhaIcone
          icone={<Icone nome="sino" />}
          rotulo="Permissões do aparelho"
          valor="Avisos e localização"
          onPress={() => router.push('/permissoes')}
          direita={seta}
        />

        <Text style={[estilos.secao, estilos.secaoEspaco]}>QUEM VÊ OS DADOS DO PET</Text>
        <Text style={estilos.consentimentoDescricao}>Confira os acessos de cada pet na carteirinha, em Cuidador e no QR da coleira. Links públicos podem ser abertos por quem os recebe.</Text>
        <LinhaIcone icone={<Icone nome="pessoas" />} rotulo="Guarda compartilhada" valor={textoCompartilhamento(acessos?.familia ?? null, 'vínculos com acesso pelo Premium')} />
        <LinhaIcone icone={<Icone nome="pessoas" />} rotulo="Cuidadores" valor={textoCompartilhamento(acessos?.cuidadores ?? null, 'acessos no período vigente')} />
        <LinhaIcone
          icone={<Icone nome="escudo" />}
          rotulo="Fichas e carteirinhas por link"
          valor={textoCompartilhamento(acessos?.fichas ?? null, 'links ativos')}
        />
        <LinhaIcone icone={<Icone nome="escudo" />} rotulo="QR da coleira" valor={textoCompartilhamento(acessos?.qrs ?? null, 'pets com QR ativo')} />

        <Text style={[estilos.secao, estilos.secaoEspaco]}>MAPAS E LUGARES</Text>
        <LinhaIcone
          icone={<Icone nome="local" />}
          rotulo="Créditos dos mapas"
          valor="OpenStreetMap, Overture Maps e Foursquare"
          onPress={() => Linking.openURL('https://petlive.app/creditos').catch(() => undefined)}
          direita={seta}
        />

        <Text style={[estilos.secao, estilos.secaoEspaco]}>MEUS DADOS</Text>
        {carregando && <Text>Consultando seus pedidos…</Text>}
        {erroConsulta && <LinhaIcone icone={<Icone nome="escudo" />} rotulo="Não foi possível consultar seus pedidos" valor={`${erroConsulta} Toque para tentar novamente.`} onPress={recarregar} />}
        <LinhaIcone
          icone={<Icone nome="livro" />}
          rotulo="Exportar meus dados"
          valor="Arquivo com tudo, para salvar ou enviar"
          onPress={exportar}
          desabilitado={processando}
          direita={seta}
        />
        {exclusao?.pedidoId ? (
          <LinhaIcone
            icone={<Icone nome="bandeira" />}
            rotulo={exclusao.executarEm ? `Exclusão agendada para ${exclusao.executarEm.toLocaleDateString('pt-BR')}` : 'Pedido de exclusão registrado'}
            valor={exclusao.podeCancelar ? 'Tocar para cancelar a exclusão' : 'Pedido em processamento'}
            fundo="#FDE0E6"
            onPress={cancelarExclusao}
            desabilitado={processando || !exclusao.podeCancelar}
            direita={seta}
          />
        ) : (
          <LinhaIcone
            icone={<Icone nome="bandeira" />}
            rotulo="Excluir minha conta"
            valor={exclusao?.podeSolicitar ? 'Apaga a conta e os dados em 30 dias' : 'Solicitação pelo app temporariamente indisponível'}
            fundo="#FDE0E6"
            onPress={excluirConta}
            desabilitado={processando || !exclusao?.podeSolicitar}
            direita={seta}
          />
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 40, gap: 8 },
  secao: { fontSize: 12, fontFamily: typography.h1.fontFamily, color: '#566070' },
  secaoEspaco: { marginTop: 4 },
  consentimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  consentimentoRotulo: { fontSize: 14, lineHeight: 19, fontFamily: typography.h1.fontFamily, color: colors.black },
  consentimentoDescricao: { ...typography.small, color: colors.textMuted },
});
