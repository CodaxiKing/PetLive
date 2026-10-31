import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { useEstadoPlano } from '../../src/lib/plano';
import { filtrarHistorico, formatarTempoPasseio, passeiosVisiveis, progressoMeta, totaisPasseios, type PeriodoHistorico } from '../../src/passeios/historico';
import { repositorioMetaPasseiosLocal } from '../../src/passeios/local';
import { interpretarMeta } from '../../src/passeios/meta';
import { gravadorPasseioLocal } from '../../src/passeios/sessaoLocal';
import { TrajetoPasseio } from '../../src/passeios/TrajetoPasseio';
import { colors } from '../../src/theme/colors';
import { radius, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { textoDeErro } from '../../src/lib/erros';

const km = (metros: number) => (metros / 1000).toFixed(2).replace('.', ',');

export default function HistoricoPasseios() {
  const { user, carregando } = useAuth();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!user) return <Text>Entre na sua conta para ver os passeios.</Text>;
  return <Historico key={user.id} tutorId={user.id} />;
}

function Historico({ tutorId }: { tutorId: string }) {
  const insets = useSafeAreaInsets();
  const [gravador] = useState(() => gravadorPasseioLocal(tutorId));
  const estado = useSyncExternalStore(gravador.assinar, gravador.snapshot, gravador.snapshot);
  const plano = useEstadoPlano();
  const [agora, setAgora] = useState(Date.now);
  const [periodo, setPeriodo] = useState<PeriodoHistorico>('semana');
  const [petId, setPetId] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [repoMeta] = useState(() => repositorioMetaPasseiosLocal(tutorId));
  const [meta, setMeta] = useState<number | null>(null);
  const [textoMeta, setTextoMeta] = useState('');
  const [carregandoMeta, setCarregandoMeta] = useState(true);
  const [erroMeta, setErroMeta] = useState<string | null>(null);
  const [tentativaMeta, setTentativaMeta] = useState(0);
  const [salvandoMeta, setSalvandoMeta] = useState(false);
  const [avisoMeta, setAvisoMeta] = useState<string | null>(null);
  const vivo = useRef(false), trava = useRef(false);

  useEffect(() => { void gravador.carregar(); }, [gravador]);
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    setAgora(Date.now());
    const timer = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []));
  useEffect(() => {
    let ativo = true;
    repoMeta.carregar().then((valor) => {
      if (!ativo) return;
      setMeta(valor); setTextoMeta(valor === null ? '' : String(valor).replace('.', ','));
      setErroMeta(null); setCarregandoMeta(false);
    }).catch(() => { if (ativo) setErroMeta('Não foi possível carregar sua meta. Tente novamente antes de editar.'); });
    return () => { ativo = false; };
  }, [repoMeta, tentativaMeta]);

  async function salvarMeta(remover = false) {
    if (trava.current || carregandoMeta) return;
    trava.current = true; setSalvandoMeta(true); setErroMeta(null); setAvisoMeta(null);
    try {
      const valor = remover ? null : interpretarMeta(textoMeta);
      await repoMeta.salvar(valor);
      if (vivo.current) { setMeta(valor); setTextoMeta(valor === null ? '' : String(valor).replace('.', ',')); setAvisoMeta(valor === null ? 'Meta removida.' : 'Meta semanal salva neste aparelho.'); }
    } catch (e) { if (vivo.current) setErroMeta(textoDeErro(e, 'Não foi possível salvar sua meta. Tente novamente.')); }
    finally { trava.current = false; if (vivo.current) setSalvandoMeta(false); }
  }

  const premium = !plano.carregando && !plano.erro && plano.plano === 'premium';
  const visiveis = passeiosVisiveis(estado.passeios, tutorId, agora, premium);
  const pets = [...new Map([...visiveis].reverse().map((p) => [p.petId, p.nomePet])).entries()];
  const filtroPet = pets.some(([id]) => id === petId) ? petId : null;
  const lista = filtrarHistorico(visiveis, periodo, filtroPet, agora);
  const semana = totaisPasseios(filtrarHistorico(visiveis, 'semana', filtroPet, agora));
  const mes = totaisPasseios(filtrarHistorico(visiveis, 'mes', filtroPet, agora));
  const semanaConta = totaisPasseios(filtrarHistorico(visiveis, 'semana', null, agora));
  const progresso = progressoMeta(semanaConta.distanciaM, meta);
  // Só pode expandir trajetos que continuam visíveis no plano e filtro atuais.
  const carregando = estado.carregando || plano.carregando;

  return <FlatList
    style={s.tela} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
    keyboardShouldPersistTaps="handled" data={carregando ? [] : lista} keyExtractor={(p) => p.id}
    ListHeaderComponent={<View style={s.cabecalho}>
      <View style={s.cabecalhoLargo}><CabecalhoTela titulo="Histórico de passeios" /></View>
      <Text style={s.texto}>Passeios concluídos salvos ou recuperados neste aparelho. Para atualizar com a nuvem, use Sincronizar na tela Passeios. A semana começa na segunda-feira; as datas seguem o horário do aparelho.</Text>
      <Text style={s.texto}>{plano.carregando ? 'Consultando seu plano…' : premium ? 'Histórico completo disponível nesta conta Premium.' : 'Plano grátis: últimos 30 dias, incluindo hoje. Os passeios antigos continuam salvos; a lista e os totais respeitam esse limite.'}</Text>
      {plano.erro ? <Pressable accessibilityRole="button" onPress={plano.recarregar} style={s.acao}><Text style={s.link}>Não foi possível consultar o plano. Tentar novamente</Text></Pressable> : null}
      {estado.erro ? <Text accessibilityRole="alert" style={s.erro}>{estado.erro}</Text> : null}
      {estado.erro && estado.carregando ? <BotaoPrimario titulo="Tentar carregar histórico novamente" onPress={() => { void gravador.carregar(); }} /> : null}
      {carregando ? <ActivityIndicator accessibilityLabel="Carregando histórico" /> : <>
        <Text accessibilityRole="header" style={s.titulo}>Filtrar por pet</Text>
        <View style={s.opcoes}>
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: filtroPet === null }} onPress={() => setPetId(null)} style={[s.opcao, filtroPet === null && s.selecionado]}><Text style={s.texto}>Todos os pets</Text></Pressable>
          {pets.map(([id, nome]) => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: filtroPet === id }} onPress={() => setPetId(id)} style={[s.opcao, filtroPet === id && s.selecionado]}><Text style={s.texto}>{nome}</Text></Pressable>)}
        </View>
        <View style={s.card}><Text accessibilityRole="header" style={s.titulo}>Esta semana</Text><Text style={s.numero}>{km(semana.distanciaM)} km</Text><Text style={s.texto}>{formatarTempoPasseio(semana.duracaoMs)} · {semana.quantidade} passeios</Text></View>
        <View style={s.card}><Text accessibilityRole="header" style={s.titulo}>Este mês</Text><Text style={s.numero}>{km(mes.distanciaM)} km</Text><Text style={s.texto}>{formatarTempoPasseio(mes.duracaoMs)} · {mes.quantidade} passeios</Text></View>
      </>}
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.titulo}>Meta semanal opcional</Text>
        <Text style={s.texto}>Em quilômetros, somando todos os pets desta conta. O filtro da lista não muda a meta.</Text>
        {carregandoMeta ? <ActivityIndicator accessibilityLabel="Carregando meta semanal" /> : <>
          {meta !== null && !carregando ? <>
            <Text style={s.texto}>{km(semanaConta.distanciaM)} de {String(meta).replace('.', ',')} km · {Math.floor(progresso)}%</Text>
            <View accessibilityRole="progressbar" accessibilityLabel="Progresso da meta semanal" accessibilityValue={{ min: 0, max: 100, now: Math.floor(progresso) }} style={s.barra}><View style={[s.preenchimento, { width: `${progresso}%` }]} /></View>
          </> : null}
          <TextInput accessibilityLabel="Meta semanal em quilômetros" placeholder="Ex.: 5 ou 2,5" value={textoMeta} onChangeText={setTextoMeta} keyboardType="decimal-pad" maxLength={5} editable={!salvandoMeta} style={s.campo} />
          <BotaoPrimario titulo="Salvar meta" carregando={salvandoMeta} onPress={() => { void salvarMeta(); }} />
          {meta !== null ? <Pressable accessibilityRole="button" disabled={salvandoMeta} onPress={() => { void salvarMeta(true); }} style={s.acao}><Text style={s.link}>Remover meta</Text></Pressable> : null}
        </>}
        {erroMeta ? <Text accessibilityRole="alert" style={s.erro}>{erroMeta}</Text> : null}
        {erroMeta && carregandoMeta ? <Pressable accessibilityRole="button" onPress={() => setTentativaMeta((n) => n + 1)} style={s.acao}><Text style={s.link}>Tentar carregar meta novamente</Text></Pressable> : null}
        {avisoMeta ? <Text accessibilityLiveRegion="polite" style={s.link}>{avisoMeta}</Text> : null}
      </View>
      <Text accessibilityRole="header" style={s.titulo}>Passeios concluídos</Text>
      <View style={s.opcoes}>{(['semana', 'mes', 'todos'] as PeriodoHistorico[]).map((valor) => <Pressable key={valor} accessibilityRole="radio" accessibilityState={{ checked: periodo === valor }} onPress={() => setPeriodo(valor)} style={[s.opcao, periodo === valor && s.selecionado]}><Text style={s.texto}>{valor === 'semana' ? 'Semana' : valor === 'mes' ? 'Mês' : 'Todos'}</Text></Pressable>)}</View>
    </View>}
    ListEmptyComponent={!carregando ? <Text style={s.texto}>Nenhum passeio concluído neste período e filtro.</Text> : undefined}
    renderItem={({ item }) => <View style={s.card}>
      <Text accessibilityRole="header" style={s.titulo}>{item.nomePet}</Text>
      <Text style={s.texto}>{new Date(item.fim!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</Text>
      <Text style={s.texto}>{km(item.distanciaM)} km · {formatarTempoPasseio(item.duracaoMs)}</Text>
      {item.anotacao ? <Text numberOfLines={2} style={s.texto}>{item.anotacao}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/passeios/resumo', params: { id: item.id } })} style={s.acao}><Text style={s.link}>Ver resumo, foto e anotação</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expandido === item.id }} onPress={() => setExpandido(expandido === item.id ? null : item.id)} style={s.acao}><Text style={s.link}>{expandido === item.id ? 'Ocultar trajeto' : 'Ver trajeto salvo'}</Text></Pressable>
      {expandido === item.id ? <TrajetoPasseio pontos={item.pontos} /> : null}
    </View>}
  />;
}

const s = StyleSheet.create({
  // O cabeçalho traz o próprio recuo lateral; aqui ele ocupa a largura toda.
  cabecalhoLargo: { marginHorizontal: -20 },
  tela: { flex: 1, backgroundColor: colors.background }, cabecalho: { gap: spacing.lg },
  texto: { ...typography.body, color: colors.textMuted }, titulo: { ...typography.h3, color: colors.black },
  numero: { ...typography.h2, color: colors.primaryDeep }, link: { ...typography.bodyMedium, color: colors.primaryDeep },
  erro: { ...typography.body, color: colors.danger }, acao: { minHeight: 48, justifyContent: 'center' },
  card: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, gap: spacing.sm },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcao: { minHeight: 48, justifyContent: 'center', padding: spacing.md, borderWidth: 2, borderColor: colors.border, borderRadius: radius.pill },
  selecionado: { borderColor: colors.primaryDeep, backgroundColor: colors.hero },
  campo: { ...typography.body, minHeight: 48, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.black },
  barra: { height: 10, borderRadius: radius.pill, backgroundColor: colors.background, overflow: 'hidden' },
  preenchimento: { height: '100%', backgroundColor: colors.primaryDeep },
});
