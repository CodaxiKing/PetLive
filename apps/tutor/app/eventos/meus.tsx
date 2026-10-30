import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { BotaoRedondo } from '../../src/components/Layout';
import { cancelarEvento, dataHoraEvento, meusEventos, STATUS_EVENTO, TIPO_EVENTO, type EventoMeu } from '../../src/mapa/eventos';
import { colors } from '../../src/theme/colors';
import { radius, shadow, spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

export default function MeusEventos() {
  const insets = useSafeAreaInsets();
  const [eventos, setEventos] = useState<EventoMeu[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [concluido, setConcluido] = useState<string | null>(null);
  const sequencia = useRef(0);
  const foco = useRef(false);
  const ocupado = useRef(false);
  const invalidar = useCallback(() => { sequencia.current++; foco.current = false; ocupado.current = false; }, []);

  const carregar = useCallback(async () => {
    const numero = ++sequencia.current;
    setCarregando(true); setErroCarga(null);
    try { const dados = await meusEventos(); if (numero === sequencia.current) setEventos(dados); }
    catch (erro) { if (numero === sequencia.current) setErroCarga(erro instanceof Error ? erro.message : 'Tente novamente.'); }
    finally { if (numero === sequencia.current) setCarregando(false); }
  }, []);

  useFocusEffect(useCallback(() => { foco.current = true; setCancelando(null); void carregar(); return invalidar; }, [carregar, invalidar]));

  function pedirCancelamento(evento: EventoMeu) {
    if (ocupado.current) return;
    ocupado.current = true;
    Alert.alert('Cancelar evento?', 'O evento sairá do mapa e quem confirmou presença será avisado. Esta ação não pode ser desfeita.', [
      { text: 'Manter evento', style: 'cancel', onPress: () => { ocupado.current = false; } },
      { text: 'Cancelar evento', style: 'destructive', onPress: async () => {
        if (!foco.current) { ocupado.current = false; return; }
        setCancelando(evento.id); setConcluido(null);
        try { await cancelarEvento(evento.id); if (foco.current) { setConcluido('Evento cancelado.'); await carregar(); } }
        catch (erro) { if (foco.current) Alert.alert('Não foi possível cancelar', erro instanceof Error ? erro.message : 'Tente novamente.'); }
        finally { ocupado.current = false; if (foco.current) setCancelando(null); }
      } },
    ], { cancelable: false });
  }

  return (
    <View style={estilos.tela}>
      <View style={[estilos.topo, { paddingTop: insets.top + spacing.lg }]}>
        <View style={estilos.linhaTopo}>
          <BotaoRedondo acessibilidade="Voltar" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/perfil')}><ArrowLeft size={22} color={colors.black} /></BotaoRedondo>
          <Text accessibilityRole="header" style={estilos.tituloTopo}>Meus eventos</Text>
        </View>
        <Text style={estilos.subtitulo}>Acompanhe a análise, as presenças e os eventos encerrados.</Text>
        <Pressable accessibilityRole="button" disabled={cancelando !== null} onPress={() => router.push('/eventos/novo')} style={estilos.editar}><Text style={estilos.link}>Criar evento</Text></Pressable>
      </View>
      {concluido ? <Text accessibilityLiveRegion="polite" style={estilos.subtitulo}>{concluido}</Text> : null}
      {carregando ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primaryDeep} /> : erroCarga ? <View style={estilos.vazio}><Text accessibilityRole="alert" style={estilos.motivo}>{erroCarga}</Text><Pressable accessibilityRole="button" onPress={() => void carregar()} style={estilos.editar}><Text style={estilos.link}>Tentar novamente</Text></Pressable></View> : eventos.length === 0 ? (
        <View style={estilos.vazio}><Text style={estilos.vazioTitulo}>Você ainda não criou eventos</Text><Text style={estilos.vazioTexto}>Os eventos enviados aparecem aqui para acompanhar a análise.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/eventos/novo')}><Text style={estilos.link}>Criar evento</Text></Pressable></View>
      ) : <ScrollView contentContainerStyle={estilos.lista}>
        {eventos.map((evento) => {
          const podeCancelar = ['em_analise','publicado','ajuste_solicitado'].includes(evento.status) && new Date(evento.fim_em) > new Date();
          const podeEditar = podeCancelar && new Date(evento.inicio_em) > new Date();
          return <View key={evento.id} style={estilos.card}>
            <View style={estilos.linha}><Text style={estilos.tipo}>{TIPO_EVENTO[evento.tipo]}</Text><Text style={[estilos.status, evento.status === 'publicado' && estilos.statusPublicado]}>{STATUS_EVENTO[evento.status]}</Text></View>
            <Text style={estilos.nome}>{evento.titulo}</Text>
            <Text style={estilos.dado}>{dataHoraEvento(evento.inicio_em, evento.fim_em)}</Text>
            <Text style={estilos.dado}>{evento.local_nome}</Text>
            {evento.status === 'publicado' ? <Text style={estilos.dado}>{evento.confirmados} confirmados</Text> : null}
            {evento.motivo_status ? <Text style={estilos.motivo}>{evento.motivo_status}</Text> : null}
            {podeEditar ? <Pressable accessibilityRole="button" disabled={cancelando !== null} onPress={() => router.push({ pathname: '/eventos/novo', params: { id: evento.id } })} style={estilos.editar}><Text style={estilos.editarTexto}>Editar evento</Text></Pressable> : null}
            {podeCancelar ? <Pressable accessibilityRole="button" disabled={cancelando !== null} onPress={() => pedirCancelamento(evento)} style={estilos.cancelar}><Text style={estilos.cancelarTexto}>{cancelando === evento.id ? 'Cancelando…' : 'Cancelar evento'}</Text></Pressable> : null}
          </View>;
        })}
      </ScrollView>}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  // Versão 2: voltar e título na mesma linha.
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tituloTopo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.8, color: colors.black },
  topo: { paddingHorizontal: 20, paddingTop: 58, paddingBottom: spacing.lg, gap: 4 },
  voltar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  link: { ...typography.captionMedium, color: colors.primaryDeep },
  titulo: { ...typography.h1, fontFamily: fontFamily.bold, fontSize: 32, lineHeight: 38, letterSpacing: -1.1, color: colors.black },
  subtitulo: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs },
  lista: { paddingHorizontal: spacing.xl, paddingBottom: 48, gap: spacing.md },
  card: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.xl, gap: spacing.sm, ...shadow.card },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  tipo: { ...typography.captionMedium, color: colors.primaryDeep },
  status: { ...typography.captionMedium, color: colors.warningText },
  statusPublicado: { color: colors.successText },
  nome: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.black },
  dado: { ...typography.caption, color: colors.textMuted },
  motivo: { ...typography.caption, color: colors.danger, backgroundColor: colors.dangerSurface, padding: spacing.sm, borderRadius: radius.sm },
  cancelar: { alignSelf: 'flex-start', marginTop: spacing.xs },
  cancelarTexto: { ...typography.captionMedium, color: colors.danger },
  editar: { alignSelf: 'flex-start', marginTop: spacing.xs },
  editarTexto: { ...typography.captionMedium, color: colors.primaryDeep },
  vazio: { margin: spacing.xl, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface, gap: spacing.sm, ...shadow.card },
  vazioTitulo: { ...typography.bodyMedium, fontFamily: fontFamily.bold, color: colors.black },
  vazioTexto: { ...typography.body, color: colors.textMuted },
});
