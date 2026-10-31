import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { BotaoPrimario } from '../components/BotaoPrimario';
import { Interruptor } from '../components/Interruptor';
import { useEstadoPlano } from '../lib/plano';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { exportarDespesas } from './exportar';
import { textoDeErro } from '../lib/erros';

export function AcoesDespesas({ mes, petId }: { mes: string; petId: string | null }) {
  const { user } = useAuth();
  return user ? <Acoes key={user.id} tutorId={user.id} mes={mes} petId={petId} /> : null;
}
function Acoes({ tutorId, mes, petId }: { tutorId: string; mes: string; petId: string | null }) {
  const plano = useEstadoPlano();
  const [resumo, setResumo] = useState<boolean | null>(null), [erroResumo, setErroResumo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null), [ocupado, setOcupado] = useState(false), [tentativa, setTentativa] = useState(0);
  const trava = useRef(false), vida = useRef(false), geracao = useRef(0);
  useFocusEffect(useCallback(() => {
    vida.current = true; geracao.current += 1; let atual = true;
    supabase.from('despesas_resumo_preferencias').select('ativo').eq('tutor_id', tutorId).maybeSingle().then(({ data, error }) => {
      if (atual) { if (error) setErroResumo('Não foi possível carregar a opção de resumo mensal.'); else { setResumo(data?.ativo ?? false); setErroResumo(null); } }
    }, () => { if (atual) setErroResumo('Não foi possível carregar a opção de resumo mensal.'); });
    return () => { atual = false; vida.current = false; geracao.current += 1; };
  // Reconsulta por solicitação explícita após falha.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorId, tentativa]));
  async function executar(acao: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try { await acao(); } catch (e) { if (vida.current) setErro(textoDeErro(e, 'Tente novamente.')); }
    finally { trava.current = false; if (vida.current) setOcupado(false); }
  }
  async function alterarResumo() {
    const { data, error } = await supabase.rpc('despesas_resumo_configurar', { p_tutor: tutorId, p_ativo: !resumo });
    if (error) throw new Error(error.message);
    if (vida.current) setResumo(data === true);
  }
  function exportar(formato: 'csv' | 'pdf') {
    const inicio = geracao.current;
    return executar(() => exportarDespesas(tutorId, mes, petId, formato, () => vida.current && geracao.current === inicio));
  }
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.titulo}>Leve seu relatório</Text>
    <Text style={s.texto}>Exporte o mês e o pet selecionados, incluindo os gastos de todos os pets. CSV para planilhas ou PDF para guardar.</Text>
    {plano.carregando ? <ActivityIndicator accessibilityLabel="Conferindo Premium" /> : plano.erro ?
      <BotaoPrimario titulo="Tentar conferir plano" onPress={plano.recarregar} /> : plano.plano === 'premium' ?
      <View style={s.botoes}>{(['csv', 'pdf'] as const).map((formato) => <View key={formato} style={s.botao}><BotaoPrimario titulo={`Exportar ${formato.toUpperCase()}`} desabilitado={ocupado} onPress={() => { void exportar(formato); }} /></View>)}</View> :
      <BotaoPrimario titulo="Exportar com Premium" onPress={() => router.push('/premium')} />}
    <View style={s.linha}><Text style={[s.titulo, s.flex]}>Resumo mensal na caixa de avisos</Text>
      <Interruptor ligado={resumo === true} rotulo="Receber resumo mensal de despesas" desabilitado={ocupado || resumo === null || Boolean(erroResumo)} onToggle={() => { void executar(alterarResumo); }} /></View>
    <Text style={s.texto}>Opcional e desligado inicialmente. No mês seguinte, veja o total do mês anterior na sua caixa de avisos, no horário escolhido em Avisos. Os avisos gerais precisam estar ligados. Você pode desativar aqui a qualquer momento.</Text>
    {erroResumo ? <><Text accessibilityRole="alert" style={s.erro}>{erroResumo}</Text><Pressable accessibilityRole="button" onPress={() => setTentativa((n) => n + 1)} style={s.repetir}><Text style={s.texto}>Tentar carregar opção</Text></Pressable></> : resumo === null ? <ActivityIndicator accessibilityLabel="Carregando resumo mensal" /> : null}
    {ocupado ? <ActivityIndicator accessibilityLabel="Preparando despesas" /> : null}
    {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 14 },
  titulo: { ...typography.h3, color: colors.black }, texto: { ...typography.body, color: colors.textMuted },
  erro: { ...typography.body, color: colors.danger }, botoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  botao: { flex: 1, minWidth: 130 }, linha: { flexDirection: 'row', alignItems: 'center', gap: 12 }, flex: { flex: 1 }, repetir: { minHeight: 48, justifyContent: 'center' },
});
