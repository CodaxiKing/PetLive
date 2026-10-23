import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { carregarEvento, TIPO_EVENTO, type EventoDetalhe } from '../../src/mapa/eventos';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

const quando = (valor: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
}).format(new Date(valor));

export default function FichaEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [evento, setEvento] = useState<EventoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [erroLink, setErroLink] = useState(false);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    setCarregando(true); setEvento(null); setErro(null); setErroLink(false);
    if (typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
      setCarregando(false);
      return;
    }
    carregarEvento(id).then((dados) => { if (ativo) setEvento(dados); })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : 'Tente novamente.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  // A tentativa precisa recriar o efeito de foco para refazer a consulta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tentativa]));

  async function abrirIngresso() {
    if (!evento?.ingresso_url) return;
    try {
      const url = new URL(evento.ingresso_url);
      if (url.protocol !== 'https:' || !url.hostname) throw new Error('Link inválido');
      setErroLink(false);
      await Linking.openURL(url.toString());
    } catch { setErroLink(true); }
  }

  return <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace({ pathname: '/(app)/mapa', params: { aba: 'eventos' } })} style={estilos.botao}>
      <Text style={estilos.link}>Voltar ao mapa</Text>
    </Pressable>
    {carregando ? <ActivityIndicator accessibilityLabel="Carregando evento" color={colors.primaryDeep} /> : erro ? <View style={estilos.card}>
      <Text accessibilityRole="header" style={estilos.titulo}>Não foi possível carregar</Text>
      <Text style={estilos.texto}>{erro}</Text>
      <Pressable accessibilityRole="button" onPress={() => setTentativa((valor) => valor + 1)} style={estilos.botao}><Text style={estilos.link}>Tentar novamente</Text></Pressable>
    </View> : !evento ? <View style={estilos.card}>
      <Text accessibilityRole="header" style={estilos.titulo}>Evento indisponível</Text>
      <Text style={estilos.texto}>Ele pode ter sido encerrado, cancelado ou retirado do mapa.</Text>
    </View> : <>
      {evento.foto_url ? <Image source={{ uri: evento.foto_url }} style={estilos.foto} accessibilityLabel={`Foto de ${evento.titulo}`} /> : null}
      <Text style={estilos.link}>{TIPO_EVENTO[evento.tipo]}</Text>
      <Text accessibilityRole="header" style={estilos.titulo}>{evento.titulo}</Text>
      <View style={estilos.card}>
        <Text style={estilos.rotulo}>Quando</Text>
        <Text style={estilos.texto}>{quando(evento.inicio_em)} até {quando(evento.fim_em)}</Text>
        <Text style={estilos.ajuda}>Horário de Brasília</Text>
        <Text style={estilos.rotulo}>Local</Text><Text style={estilos.texto}>{evento.local_nome}</Text>
        <Text style={estilos.rotulo}>Organização</Text><Text style={estilos.texto}>{evento.organizador}{evento.organizador_verificado ? ' · Verificado' : ''}</Text>
        <Text style={estilos.rotulo}>Entrada</Text><Text style={estilos.texto}>{evento.gratuito ? 'Gratuita' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((evento.preco_centavos ?? 0) / 100)}</Text>
        <Text style={estilos.rotulo}>Vagas</Text><Text style={estilos.texto}>{evento.vagas === null ? 'Sem limite informado' : Math.max(0, evento.vagas - evento.confirmados) === 0 ? 'Vagas esgotadas' : `${Math.max(0, evento.vagas - evento.confirmados)} disponíveis de ${evento.vagas}`}</Text>
        <Text style={estilos.ajuda}>{evento.confirmados} presenças confirmadas</Text>
      </View>
      <View style={estilos.card}><Text style={estilos.rotulo}>Sobre o evento</Text><Text style={estilos.texto}>{evento.descricao}</Text></View>
      {!evento.gratuito && evento.ingresso_url ? <View style={estilos.card}>
        <Text style={estilos.texto}>Ingressos no site do organizador. O PetLive não vende ingressos.</Text>
        <Pressable accessibilityRole="link" onPress={() => void abrirIngresso()} style={estilos.botao}><Text style={estilos.link}>Ver ingresso no site externo</Text></Pressable>
        {erroLink ? <Text accessibilityRole="alert" style={estilos.erro}>Não foi possível abrir o link do ingresso.</Text> : null}
      </View> : null}
      <Text style={estilos.ajuda}>O organizador é responsável pelo evento. Prefira encontros em locais públicos.</Text>
    </>}
  </ScrollView>;
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingHorizontal: spacing.xl, gap: spacing.md },
  card: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.surface, gap: spacing.sm },
  titulo: { ...typography.h2, color: colors.black },
  rotulo: { ...typography.bodyMedium, color: colors.black, marginTop: spacing.xs },
  texto: { ...typography.body, color: colors.text },
  ajuda: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.captionMedium, color: colors.primaryDeep },
  botao: { paddingVertical: spacing.md, minHeight: 44, justifyContent: 'center' },
  foto: { width: '100%', height: 220, borderRadius: radius.xl },
  erro: { ...typography.caption, color: colors.danger },
});
