import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { useEstadoPlano } from '../../src/lib/plano';
import { gravadorPasseioLocal } from '../../src/passeios/sessaoLocal';
import { passeiosVisiveis, formatarTempoPasseio } from '../../src/passeios/historico';
import { FotosPasseioLocal } from '../../src/passeios/fotos';
import { escolherFotoPasseio } from '../../src/passeios/escolherFoto';
import { MapaPasseio } from '../../src/passeios/MapaPasseio';
import { ritmoPasseio } from '../../src/passeios/resumo';
import type { Passeio } from '../../src/passeios/passeio';
import type { GravadorPasseio } from '../../src/passeios/gravador';
import { colors } from '../../src/theme/colors';
import { spacing, radius } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

export default function ResumoPasseio() {
  const { user, carregando } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (Platform.OS === 'web') return <View style={{ padding: 24 }}><Text>Abra o PetLive no celular para revisar o mapa e salvar fotos do passeio.</Text></View>;
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!user) return <Text>Entre na sua conta para revisar o passeio.</Text>;
  return <CarregarResumo key={`${user.id}:${id}`} tutorId={user.id} id={id} />;
}

function CarregarResumo({ tutorId, id }: { tutorId: string; id: string }) {
  const [gravador] = useState(() => gravadorPasseioLocal(tutorId));
  const estado = useSyncExternalStore(gravador.assinar, gravador.snapshot, gravador.snapshot);
  const plano = useEstadoPlano();
  const [agora, setAgora] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    setAgora(Date.now());
    const timer = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []));
  useEffect(() => { void gravador.carregar(); }, [gravador]);
  const passeio = estado.passeios.find((p) => p.id === id && p.tutorId === tutorId);
  const premium = !plano.carregando && !plano.erro && plano.plano === 'premium';
  const permitido = passeio && (passeio.status !== 'concluido' || passeiosVisiveis([passeio], tutorId, agora, premium).length > 0);
  if (estado.carregando || (passeio?.status === 'concluido' && plano.carregando)) return <View style={{ padding: 24, gap: 16 }}>
    <ActivityIndicator accessibilityLabel="Carregando resumo" />
    {estado.erro ? <><Text accessibilityRole="alert">{estado.erro}</Text><BotaoPrimario titulo="Tentar novamente" onPress={() => { void gravador.carregar(); }} /></> : null}
  </View>;
  if (!permitido) return <View style={{ padding: 24, gap: 16 }}><Text>Passeio indisponível ou fora do histórico do seu plano.</Text><BotaoPrimario titulo="Voltar aos passeios" onPress={() => router.replace('/passeios')} /></View>;
  return <EditorResumo passeio={passeio} gravador={gravador} ocupado={estado.ocupado} erro={estado.erro} />;
}

function EditorResumo({ passeio, gravador, ocupado, erro }: { passeio: Passeio; gravador: GravadorPasseio; ocupado: boolean; erro: string | null }) {
  const insets = useSafeAreaInsets();
  const [anotacao, setAnotacao] = useState(passeio.anotacao ?? '');
  const [foto, setFoto] = useState<string | null | undefined>(undefined);
  const [escolhendo, setEscolhendo] = useState(false), [erroFoto, setErroFoto] = useState<string | null>(null);
  const [erroImagem, setErroImagem] = useState(false);
  const vivo = useRef(false), trava = useRef(false);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const fotos = new FotosPasseioLocal(passeio.tutorId);
  const uri = foto === undefined ? passeio.fotoId ? fotos.uri(passeio.fotoId) : null : foto;
  const bloqueado = ocupado || escolhendo;
  async function escolher(origem: 'camera' | 'galeria') {
    if (trava.current || bloqueado) return;
    trava.current = true; setEscolhendo(true); setErroFoto(null);
    try { const uri = await escolherFotoPasseio(origem); if (uri && vivo.current) { setFoto(uri); setErroImagem(false); } }
    catch (e) { if (vivo.current) setErroFoto(e instanceof Error ? e.message : 'Não foi possível escolher a foto.'); }
    finally { trava.current = false; if (vivo.current) setEscolhendo(false); }
  }
  async function salvar() {
    if (trava.current || bloqueado || erroImagem) return;
    trava.current = true;
    try { const salvo = await gravador.salvarResumo(passeio.id, anotacao, foto); if (salvo && vivo.current) router.replace('/passeios/historico'); }
    finally { trava.current = false; }
  }
  return <ScrollView style={s.tela} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
    <CabecalhoTela titulo="Resumo do passeio" />
    <Text accessibilityRole="header" style={s.titulo}>{passeio.nomePet}</Text>
    <Text style={s.texto}>{passeio.status === 'concluido' ? 'Passeio salvo. Você pode editar a foto e a anotação.' : 'O passeio está pausado. Confira o resumo antes de salvar.'}</Text>
    <View style={s.card}>
      <Text style={s.numero}>{(passeio.distanciaM / 1000).toFixed(2).replace('.', ',')} km</Text>
      <Text style={s.texto}>{formatarTempoPasseio(passeio.duracaoMs)} de tempo ativo</Text>
      <Text style={s.texto}>Ritmo médio: {ritmoPasseio(passeio)}</Text>
      <Text style={s.texto}>O ritmo usa apenas o tempo ativo; pausas não entram.</Text>
    </View>
    <MapaPasseio pontos={passeio.pontos} />
    <Text accessibilityRole="header" style={s.titulo}>Foto do passeio (opcional)</Text>
    {uri ? <Image key={uri} source={{ uri }} style={s.foto} accessibilityLabel="Foto escolhida para o passeio" onError={() => setErroImagem(true)} /> : null}
    {erroImagem ? <Text accessibilityRole="alert" style={s.erro}>A foto não carregou. Remova ou escolha outra antes de salvar.</Text> : null}
    <View style={s.opcoes}>
      <Pressable accessibilityRole="button" disabled={bloqueado} onPress={() => { void escolher('camera'); }} style={s.acao}><Text style={s.link}>Tirar foto</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={bloqueado} onPress={() => { void escolher('galeria'); }} style={s.acao}><Text style={s.link}>Escolher da galeria</Text></Pressable>
      {uri ? <Pressable accessibilityRole="button" disabled={bloqueado} onPress={() => { setFoto(null); setErroImagem(false); setErroFoto(null); }} style={s.acao}><Text style={s.link}>Remover foto</Text></Pressable> : null}
    </View>
    {escolhendo ? <ActivityIndicator accessibilityLabel="Escolhendo foto" /> : null}
    {erroFoto ? <Text accessibilityRole="alert" style={s.erro}>{erroFoto}</Text> : null}
    <TextInput accessibilityLabel="Anotação do passeio" placeholder="Como foi o passeio?" multiline maxLength={1000} value={anotacao} onChangeText={setAnotacao} editable={!bloqueado} style={s.campo} />
    <Text style={s.texto}>{anotacao.length}/1000 caracteres. Salvo neste aparelho. Trajeto e anotação podem ser sincronizados na tela Passeios; a foto fica somente aqui.</Text>
    {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
    <BotaoPrimario titulo="Salvar passeio" carregando={ocupado} desabilitado={bloqueado || erroImagem || passeio.status === 'gravando'} onPress={() => { void salvar(); }} />
    <Text style={s.texto}>Só salvamos foto e anotação ao tocar em Salvar passeio. Se sair agora, o trajeto pausado continua guardado.</Text>
  </ScrollView>;
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background }, titulo: { ...typography.h3, color: colors.black },
  texto: { ...typography.body, color: colors.textMuted }, numero: { ...typography.h1, color: colors.primaryDeep },
  card: { padding: spacing.lg, gap: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface },
  foto: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  acao: { minHeight: 48, justifyContent: 'center' }, link: { ...typography.bodyMedium, color: colors.primaryDeep },
  erro: { ...typography.body, color: colors.danger },
  campo: { ...typography.body, minHeight: 120, textAlignVertical: 'top', padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, color: colors.black },
});
