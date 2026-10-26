import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotaoPrimario } from '../components/BotaoPrimario';
import { useEstadoPlano } from '../lib/plano';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { conferirArquivoCartao, descartarFotoCartao, salvarFotoCartao } from './fotoCartao';
import { guardarLeitura, lerCartao } from './leituraCartao';
import { dadosFotoCartao, tamanhoFotoCartao, type FotoCartao } from './fotoCartaoDados';

type Props = { tutorId: string; petId: string; titulo: string; data: string; onSalvo: () => void };
export function FotografarCartao(props: Props) {
  const plano = useEstadoPlano();
  const [aberta, setAberta] = useState(false), [erro, setErro] = useState<string | null>(null);
  useFocusEffect(useCallback(() => () => setAberta(false), []));
  const abrir = () => {
    if (plano.plano !== 'premium') { router.push('/premium'); return; }
    try { dadosFotoCartao(props.titulo, props.data); setErro(null); setAberta(true); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Confira os campos.'); }
  };
  if (Platform.OS === 'web') return <Text style={s.texto}>A captura com guia está disponível no app do celular.</Text>;
  return <>
    <BotaoPrimario titulo="Fotografar cartão com guia · Premium" desabilitado={plano.carregando || plano.erro} onPress={abrir} />
    {plano.erro ? <BotaoPrimario titulo="Tentar consultar plano" onPress={plano.recarregar} /> : null}
    {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
    {aberta ? <Captura {...props} onFechar={() => setAberta(false)} /> : null}
  </>;
}

function Captura({ tutorId, petId, titulo, data, onSalvo, onFechar }: Props & { onFechar: () => void }) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null), viva = useRef(true), trava = useRef(false), temporaria = useRef<string | null>(null);
  const geracaoCamera = useRef(0);
  const [permissao, pedirPermissao, consultarPermissao] = useCameraPermissions();
  const [ativo, setAtivo] = useState(AppState.currentState === 'active');
  const [pronta, setPronta] = useState(false), [ocupada, setOcupada] = useState(false), [lanterna, setLanterna] = useState(false);
  const [tamanho, setTamanho] = useState<string | undefined>(undefined);
  const [foto, setFoto] = useState<FotoCartao | null>(null), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    viva.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      setAtivo(estado === 'active');
      if (estado !== 'active') { geracaoCamera.current++; setPronta(false); }
      else void consultarPermissao().catch(() => { if (viva.current) setErro('Não foi possível consultar a câmera. Feche esta tela e tente novamente.'); });
    });
    return () => { viva.current = false; sub.remove(); if (temporaria.current) descartarFotoCartao(temporaria.current); };
  }, [consultarPermissao]);
  function refazer() {
    geracaoCamera.current++;
    if (temporaria.current) descartarFotoCartao(temporaria.current);
    temporaria.current = null; setFoto(null); setErro(null); setPronta(false);
  }
  async function prepararCamera() {
    const geracao = ++geracaoCamera.current;
    try {
      const tamanhos = await camera.current?.getAvailablePictureSizesAsync();
      if (viva.current && geracao === geracaoCamera.current && tamanhos) setTamanho(tamanhoFotoCartao(tamanhos));
    } catch { /* O aparelho pode usar sua resolução padrão; o limite de arquivo continua aplicado. */ }
    if (viva.current && geracao === geracaoCamera.current && AppState.currentState === 'active') setPronta(true);
  }
  async function fotografar() {
    if (trava.current || !pronta || !ativo || !camera.current) return;
    trava.current = true; setOcupada(true); setErro(null);
    let capturada: FotoCartao | undefined;
    try {
      capturada = await camera.current.takePictureAsync({ quality: 0.8, exif: false, skipProcessing: false });
      if (!capturada) throw new Error('A câmera não devolveu a foto. Tente novamente.');
      if (!viva.current) { descartarFotoCartao(capturada.uri); return; }
      conferirArquivoCartao(capturada); temporaria.current = capturada.uri; setFoto(capturada);
    } catch (e) {
      if (capturada) descartarFotoCartao(capturada.uri);
      if (viva.current) setErro(e instanceof Error ? e.message : 'Não foi possível fotografar.');
    } finally { trava.current = false; if (viva.current) setOcupada(false); }
  }
  // Lê as vacinas da foto e abre a revisão; a foto não é guardada (BUSINESS.md 5.22).
  async function lerVacinas() {
    if (!foto || trava.current) return;
    trava.current = true; setOcupada(true); setErro(null);
    try {
      const leitura = await lerCartao(petId, foto.uri);
      if (!viva.current) return;
      guardarLeitura(petId, leitura);
      onFechar();
      router.push({ pathname: '/pet/[id]/revisar-vacinas', params: { id: petId } });
    } catch (e) { if (viva.current) setErro(e instanceof Error ? e.message : 'Não foi possível ler o cartão.'); }
    finally { trava.current = false; if (viva.current) setOcupada(false); }
  }
  async function salvar() {
    if (!foto || trava.current) return;
    trava.current = true; setOcupada(true); setErro(null);
    try {
      await salvarFotoCartao(tutorId, petId, foto, titulo, data);
      if (viva.current) { onSalvo(); onFechar(); }
    } catch (e) { if (viva.current) setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { trava.current = false; if (viva.current) setOcupada(false); }
  }
  return <Modal visible animationType="slide" onRequestClose={() => { if (!trava.current) onFechar(); }}><ScrollView style={s.tela} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
    <Text accessibilityRole="header" style={s.titulo}>{foto ? 'Confira a foto do cartão' : 'Fotografar cartão de vacina'}</Text>
    <Text style={s.texto}>{foto ? 'Confira se nomes e datas estão legíveis e se nenhuma borda foi cortada. Leia as vacinas para revisar e salvar na carteirinha, ou guarde só a foto como anexo privado.' : 'Apoie o cartão aberto em uma superfície plana, ilumine sem reflexos e coloque a página inteira dentro da moldura.'}</Text>
    {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
    {foto ? <>
      <Image source={{ uri: foto.uri }} resizeMode="contain" style={s.previa} accessibilityLabel="Prévia completa do cartão capturado" />
      <BotaoPrimario titulo="Ler as vacinas desta foto" carregando={ocupada} onPress={() => { void lerVacinas(); }} />
      <BotaoPrimario titulo="Só salvar a foto como anexo" desabilitado={ocupada} onPress={() => { void salvar(); }} />
      <BotaoPrimario titulo="Refazer foto" desabilitado={ocupada} onPress={refazer} />
    </> : !permissao ? <ActivityIndicator accessibilityLabel="Consultando permissão da câmera" /> : !permissao.granted ? <>
      <Text style={s.texto}>Autorize a câmera para fotografar o cartão. A foto só é enviada quando você confirmar o salvamento.</Text>
      <BotaoPrimario titulo={permissao.canAskAgain ? 'Autorizar câmera' : 'Abrir configurações'} onPress={() => { void (permissao.canAskAgain ? pedirPermissao() : Linking.openSettings()).catch(() => setErro('Não foi possível abrir a permissão da câmera. Tente novamente.')); }} />
    </> : ativo ? <>
      <View style={s.camera}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" autofocus="on" pictureSize={tamanho} enableTorch={lanterna} onCameraReady={() => { void prepararCamera(); }} onMountError={() => { geracaoCamera.current++; setPronta(false); setErro('Não foi possível abrir a câmera. Feche esta tela e tente novamente.'); }} />
        <View pointerEvents="none" style={s.guia}><View style={s.moldura} /><Text style={s.legenda}>Página inteira dentro da moldura</Text></View>
      </View>
      <BotaoPrimario titulo="Capturar foto" desabilitado={!pronta} carregando={ocupada} onPress={() => { void fotografar(); }} />
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: lanterna, disabled: ocupada }} disabled={ocupada} style={s.acao} onPress={() => setLanterna((v) => !v)}><Text style={s.texto}>Lanterna: {lanterna ? 'ligada' : 'desligada'}</Text></Pressable>
    </> : <Text style={s.texto}>Volte ao app para usar a câmera.</Text>}
    <Pressable accessibilityRole="button" disabled={ocupada} style={s.acao} onPress={onFechar}><Text style={s.link}>Cancelar e voltar</Text></Pressable>
  </ScrollView></Modal>;
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface }, titulo: { ...typography.h2, color: colors.black },
  texto: { ...typography.body, color: colors.textMuted }, erro: { ...typography.body, color: colors.danger },
  link: { ...typography.bodyMedium, color: colors.primaryDeep }, acao: { minHeight: 48, justifyContent: 'center' },
  camera: { height: 350, borderRadius: 20, overflow: 'hidden', backgroundColor: '#171D25' },
  guia: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', gap: 8 },
  moldura: { height: 285, aspectRatio: 0.74, borderWidth: 3, borderColor: '#FFFFFF', borderRadius: 10 },
  legenda: { color: '#FFFFFF', backgroundColor: '#17202AD9', padding: 5, fontSize: 12 },
  previa: { height: 350, width: '100%', backgroundColor: '#EDEFF3', borderRadius: 20 },
});
