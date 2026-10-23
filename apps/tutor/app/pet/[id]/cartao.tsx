import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { dadosCartaoPet } from '../../../src/pets/cartaoPet';
import { usePets } from '../../../src/pets/PetsProvider';
import { conferirSelos, SELOS, type Selo } from '../../../src/pets/selos';
import { colors } from '../../../src/theme/colors';
import { radius, spacing } from '../../../src/theme/tokens';
import { fontFamily, typography } from '../../../src/theme/typography';

export default function CartaoPet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, petsMemoria, carregando } = usePets();
  const pet = [...pets, ...petsMemoria].find((p) => p.id === id);
  const insets = useSafeAreaInsets();
  const cartao = useRef<ViewInstance>(null);
  const ocupado = useRef(false);
  const ciclo = useRef(0);
  const invalidar = useCallback(() => { ciclo.current++; ocupado.current = false; }, []);
  const [selos, setSelos] = useState<Set<Selo> | null>(null);
  const [erroSelos, setErroSelos] = useState<string | null>(null);
  const [fotoCarregada, setFotoCarregada] = useState<string | null>(null);
  const [fotoFalhou, setFotoFalhou] = useState<string | null>(null);
  const [tentativaFoto, setTentativaFoto] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [pronto, setPronto] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    const finalizar = () => { ativo = false; invalidar(); };
    setSelos(null); setErroSelos(null); setGerando(false);
    if (!pet) return finalizar;
    if (pet.em_memoria) { setSelos(new Set()); return finalizar; }
    conferirSelos(pet.id).then((dados) => { if (ativo) setSelos(dados); })
      .catch(() => { if (ativo) setErroSelos('Não foi possível carregar os selos. Tente novamente antes de gerar o cartão.'); });
    return finalizar;
  // A tentativa permite repetir uma consulta que falhou.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.id, pet?.em_memoria, tentativa, invalidar]));

  const dados = pet ? dadosCartaoPet(pet, selos ?? []) : null;
  const fotoPronta = !dados?.foto || fotoCarregada === dados.foto;

  async function compartilhar() {
    if (ocupado.current || !dados || !pronto || !fotoPronta || selos === null) return;
    ocupado.current = true; setGerando(true); setErro(null);
    const versao = ciclo.current;
    try {
      if (Platform.OS === 'web') throw new Error('Abra o PetLive no celular para gerar a imagem do cartão.');
      const Sharing = await import('expo-sharing');
      if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de imagens não está disponível neste aparelho.');
      const { captureRef } = await import('react-native-view-shot');
      if (versao !== ciclo.current) return;
      const arquivo = await captureRef(cartao, { format: 'png', quality: 1, result: 'tmpfile' });
      if (versao !== ciclo.current) return;
      await Sharing.shareAsync(arquivo, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `Cartão de ${dados.nome}` });
    } catch (e) {
      if (versao === ciclo.current) setErro(e instanceof Error && !/native module|RNViewShot|ExpoSharing/i.test(e.message) ? e.message : 'Não foi possível gerar a imagem. Atualize o PetLive e tente novamente.');
    } finally { if (versao === ciclo.current) { ocupado.current = false; setGerando(false); } }
  }

  return <ScrollView style={estilos.tela} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/pets')} style={estilos.acao}><Text style={estilos.link}>Voltar</Text></Pressable>
    <Text accessibilityRole="header" style={estilos.titulo}>Cartão do pet</Text>
    {carregando ? <ActivityIndicator accessibilityLabel="Carregando pet" /> : !dados ? <Text style={estilos.texto}>Pet não encontrado. Volte à lista de pets.</Text> : <>
      <View ref={cartao} collapsable={false} onLayout={() => setPronto(true)} style={[estilos.cartao, dados.emMemoria && { backgroundColor: '#EEF0F2' }]}>
        <Text style={estilos.marca}>PetLive</Text>
        {dados.foto ? <Image key={`${dados.foto}-${tentativaFoto}`} source={{ uri: dados.foto }} style={estilos.foto} accessibilityLabel={`Foto de ${dados.nome}`} onLoad={() => { setFotoCarregada(dados.foto); setFotoFalhou(null); }} onError={() => setFotoFalhou(dados.foto)} /> : <View style={[estilos.foto, estilos.semFoto]}><Text style={estilos.inicial}>{dados.nome.charAt(0).toUpperCase()}</Text></View>}
        <Text style={estilos.nome}>{dados.nome}</Text>
        <Text style={estilos.raca}>{dados.especie} · {dados.raca}</Text>
        {dados.emMemoria ? <Text style={estilos.memoria}>Em memória</Text> : <View style={estilos.selos}>
          {SELOS.filter((s) => dados.selos.includes(s.chave)).map((s) => <View key={s.chave} style={[estilos.selo, { backgroundColor: s.fundo }]}><Text style={estilos.seloTexto}>{s.rotulo}</Text></View>)}
        </View>}
        <Text style={estilos.rodape}>{dados.emMemoria ? 'Uma história que fica.' : 'Cuidados que fazem parte da nossa história.'}</Text>
      </View>
      <Text style={estilos.texto}>Confira a prévia. A imagem inclui apenas foto, nome, espécie, raça e selos exibidos. Seus contatos e dados de saúde não aparecem.</Text>
      {selos === null && !erroSelos ? <ActivityIndicator accessibilityLabel="Carregando selos" /> : null}
      {erroSelos ? <View><Text accessibilityRole="alert" style={estilos.erro}>{erroSelos}</Text><Pressable accessibilityRole="button" onPress={() => setTentativa((n) => n + 1)} style={estilos.acao}><Text style={estilos.link}>Recarregar selos</Text></Pressable></View> : null}
      {dados.foto && fotoFalhou === dados.foto ? <View><Text accessibilityRole="alert" style={estilos.erro}>A foto não carregou. Confira sua conexão antes de gerar a imagem.</Text><Pressable accessibilityRole="button" onPress={() => { setFotoFalhou(null); setTentativaFoto((n) => n + 1); }} style={estilos.acao}><Text style={estilos.link}>Recarregar foto</Text></Pressable></View> : null}
      {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
      <BotaoPrimario titulo="Gerar e compartilhar imagem" onPress={() => void compartilhar()} carregando={gerando} desabilitado={!pronto || !fotoPronta || selos === null} />
    </>}
  </ScrollView>;
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  titulo: { ...typography.h2, color: colors.black },
  texto: { ...typography.body, color: colors.textMuted },
  link: { ...typography.bodyMedium, color: colors.primaryDeep },
  acao: { minHeight: 44, justifyContent: 'center' },
  cartao: { padding: spacing.xl, borderRadius: radius.xl, backgroundColor: '#E3F3FC', gap: spacing.md },
  marca: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.primaryDeep },
  foto: { width: '100%', aspectRatio: 1.25, borderRadius: radius.lg, backgroundColor: colors.surface },
  semFoto: { alignItems: 'center', justifyContent: 'center' },
  inicial: { ...typography.h1, fontSize: 64, color: colors.primaryDeep },
  nome: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 38, color: colors.black },
  raca: { ...typography.body, color: colors.text },
  memoria: { ...typography.bodyMedium, color: colors.textMuted },
  selos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selo: { padding: spacing.sm, borderRadius: radius.pill },
  seloTexto: { ...typography.captionMedium, color: colors.black },
  rodape: { ...typography.caption, color: colors.textMuted },
  erro: { ...typography.body, color: colors.danger },
});
