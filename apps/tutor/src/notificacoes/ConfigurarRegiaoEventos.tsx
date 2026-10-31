import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { BotaoPrimario } from '../components/BotaoPrimario';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { carregarRegiaoEventos, desligarRegiaoEventos, RAIOS_EVENTOS, salvarRaioEventos, usarRegiaoAtualEventos, type RegiaoEventos } from './regiaoEventos';
import { textoDeErro } from '../lib/erros';

export function ConfigurarRegiaoEventos({ eventosLigados }: { eventosLigados: boolean }) {
  const { user } = useAuth();
  return user ? <Configuracao key={user.id} tutorId={user.id} eventosLigados={eventosLigados} /> : null;
}
function Configuracao({ tutorId, eventosLigados }: { tutorId: string; eventosLigados: boolean }) {
  const [regiao, setRegiao] = useState<RegiaoEventos | null>(null);
  const [raio, setRaio] = useState(10);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const vida = useRef(false), trava = useRef(false);
  useEffect(() => {
    vida.current = true;
    let ativo = true;
    carregarRegiaoEventos(tutorId).then((r) => {
      if (ativo) { setRegiao(r); setRaio(r.raio_km); }
    }, (e) => { if (ativo) setErro(textoDeErro(e, 'Não foi possível carregar a região.')); });
    return () => { ativo = false; vida.current = false; };
  }, [tutorId, tentativa]);
  async function aplicar(acao: () => Promise<RegiaoEventos>) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true); setErro(null); setAviso(null);
    try {
      const r = await acao();
      if (vida.current) { setRegiao(r); setRaio(r.raio_km); setAviso(r.ativo ? 'Região salva para avisos de eventos próximos.' : 'Avisos próximos desligados e região removida.'); }
    } catch (e) { if (vida.current) setErro(textoDeErro(e, 'Tente novamente.')); }
    finally { trava.current = false; if (vida.current) setOcupado(false); }
  }
  return <View style={s.card}>
    <Text accessibilityRole="header" style={s.titulo}>Eventos perto de você</Text>
    <Text style={s.texto}>Escolha o raio e use sua localização uma vez para salvar uma região aproximada por sete dias. Não acompanhamos seus deslocamentos. Os avisos entram na sua caixa e respeitam o horário e o Não perturbe.</Text>
    {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
    {aviso ? <Text accessibilityLiveRegion="polite" style={s.texto}>{aviso}</Text> : null}
    {!regiao ? erro ? <BotaoPrimario titulo="Tentar carregar região" onPress={() => { setErro(null); setTentativa((n) => n + 1); }} /> : <ActivityIndicator accessibilityLabel="Carregando região de eventos" /> : <>
      <Text style={s.texto}>{regiao.ativo ? `Região ativa até ${new Date(regiao.expira_em!).toLocaleDateString('pt-BR')}.` : 'Nenhuma região ativa. Atualize para receber novos avisos próximos.'}</Text>
      {!eventosLigados ? <Text style={s.texto}>Ligue os avisos de Eventos acima para receber estes avisos. Você pode remover a região mesmo com os avisos desligados.</Text> : null}
      <View style={s.opcoes}>{RAIOS_EVENTOS.map((r) => <Pressable key={r} accessibilityRole="radio" accessibilityLabel={`${r} quilômetros`} accessibilityState={{ checked: raio === r, disabled: ocupado }} disabled={ocupado} onPress={() => setRaio(r)} style={[s.opcao, raio === r && s.selecionado]}><Text style={s.texto}>{r} km</Text></Pressable>)}</View>
      <BotaoPrimario titulo={regiao.ativo ? 'Atualizar minha região' : 'Usar minha região e ativar'} carregando={ocupado} desabilitado={!eventosLigados} onPress={() => { void aplicar(() => usarRegiaoAtualEventos(tutorId, raio)); }} />
      {regiao.ativo && regiao.raio_km !== raio ? <BotaoPrimario titulo="Salvar raio na região atual" desabilitado={ocupado || !eventosLigados} onPress={() => { void aplicar(() => salvarRaioEventos(tutorId, raio)); }} /> : null}
      {regiao.ativo ? <Pressable accessibilityRole="button" disabled={ocupado} onPress={() => { void aplicar(() => desligarRegiaoEventos(tutorId)); }} style={s.acao}><Text style={s.erro}>Desativar e apagar região</Text></Pressable> : null}
    </>}
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, padding: 18, borderRadius: 24, gap: 14 },
  titulo: { ...typography.h3, color: colors.black }, texto: { ...typography.body, color: colors.textMuted },
  erro: { ...typography.body, color: colors.danger }, opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: { minHeight: 48, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 24, borderWidth: 2, borderColor: colors.border },
  selecionado: { borderColor: colors.primaryDeep, backgroundColor: colors.hero }, acao: { minHeight: 48, justifyContent: 'center' },
});
