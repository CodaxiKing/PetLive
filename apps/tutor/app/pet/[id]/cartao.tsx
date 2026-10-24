import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, PixelRatio, Platform, Pressable, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View, type ViewInstance } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { conviteCartao, dadosCartaoPet, dimensoesCapturaCartao, FORMATOS_CARTAO, TEMAS_CARTAO, temaCartaoPermitido, type FormatoCartao, type TemaCartao } from '../../../src/pets/cartaoPet';
import { CodigoQR } from '../../../src/components/CodigoQR';
import { useEstadoPlano } from '../../../src/lib/plano';
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
  const { width: larguraTela } = useWindowDimensions();
  const plano = useEstadoPlano();
  const premium = !plano.carregando && !plano.erro && plano.plano === 'premium';
  const [temaEscolhido, setTema] = useState<TemaCartao>('azul');
  const [formato, setFormato] = useState<FormatoCartao>('post');
  const tema = temaCartaoPermitido(temaEscolhido, premium);
  const convite = conviteCartao(process.env.EXPO_PUBLIC_SITE_URL);
  const largura = Math.max(1, Math.min(larguraTela - spacing.xl * 2, 420));
  const escala = largura / 360;
  const vertical = formato === 'stories';
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
  const [pronto, setPronto] = useState<string | null>(null);
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
  const assinatura = JSON.stringify([pet?.id, tema.id, formato, largura, dados, tentativaFoto]);
  const fotoPronta = !dados?.foto || fotoCarregada === assinatura;

  async function compartilhar() {
    if (ocupado.current || !dados || pronto !== assinatura || !fotoPronta || selos === null) return;
    ocupado.current = true; setGerando(true); setErro(null);
    const versao = ciclo.current;
    try {
      if (Platform.OS === 'web') throw new Error('Abra o PetLive no celular para gerar a imagem do cartão.');
      const Sharing = await import('expo-sharing');
      if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento de imagens não está disponível neste aparelho.');
      const { captureRef } = await import('react-native-view-shot');
      if (versao !== ciclo.current) return;
      const arquivo = await captureRef(cartao, { format: 'png', quality: 1, result: 'tmpfile', ...dimensoesCapturaCartao(formato, Platform.OS, PixelRatio.get()) });
      if (versao !== ciclo.current) return;
      await Sharing.shareAsync(arquivo, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: `Cartão de ${dados.nome}` });
    } catch (e) {
      if (versao === ciclo.current) setErro(e instanceof Error && !/native module|RNViewShot|ExpoSharing/i.test(e.message) ? e.message : 'Não foi possível gerar a imagem. Atualize o PetLive e tente novamente.');
    } finally { if (versao === ciclo.current) { ocupado.current = false; setGerando(false); } }
  }

  async function compartilharConvite() {
    if (ocupado.current || !convite) return;
    ocupado.current = true; setGerando(true); setErro(null);
    const versao = ciclo.current;
    try { await Share.share({ message: `Conheça o PetLive e organize os cuidados do seu pet: ${convite}`, title: 'Conheça o PetLive' }); }
    catch { if (versao === ciclo.current) setErro('Não foi possível compartilhar o convite. Tente novamente.'); }
    finally { if (versao === ciclo.current) { ocupado.current = false; setGerando(false); } }
  }

  return <ScrollView style={estilos.tela} contentContainerStyle={{ padding: spacing.xl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(app)/pets')} style={estilos.acao}><Text style={estilos.link}>Voltar</Text></Pressable>
    <Text accessibilityRole="header" style={estilos.titulo}>Cartão do pet</Text>
    {carregando ? <ActivityIndicator accessibilityLabel="Carregando pet" /> : !dados ? <Text style={estilos.texto}>Pet não encontrado. Volte à lista de pets.</Text> : <>
      <Text accessibilityRole="header" style={estilos.secao}>Formato</Text>
      <View style={estilos.opcoes}>
        {(Object.keys(FORMATOS_CARTAO) as FormatoCartao[]).map((opcao) => <Pressable key={opcao} accessibilityRole="radio" accessibilityState={{ checked: formato === opcao, disabled: gerando }} disabled={gerando} onPress={() => setFormato(opcao)} style={[estilos.opcao, formato === opcao && estilos.selecionado]}><Text style={estilos.link}>{FORMATOS_CARTAO[opcao].nome} · {opcao === 'post' ? '1:1' : '9:16'}</Text></Pressable>)}
      </View>
      <Text accessibilityRole="header" style={estilos.secao}>Tema de cor</Text>
      <View style={estilos.opcoes}>
        {TEMAS_CARTAO.map((opcao, indice) => {
          const bloqueado = indice > 0 && !premium;
          return <Pressable key={opcao.id} accessibilityRole="radio" accessibilityLabel={`${opcao.nome}${bloqueado ? ', requer Premium' : ''}`} accessibilityState={{ checked: tema.id === opcao.id, disabled: gerando || bloqueado }} disabled={gerando || bloqueado} onPress={() => setTema(opcao.id)} style={[estilos.opcao, { backgroundColor: opcao.fundo }, tema.id === opcao.id && estilos.selecionado, bloqueado && { opacity: 0.55 }]}><Text style={[estilos.temaNome, { color: opcao.tinta }]}>{opcao.nome}{bloqueado ? ' · Premium' : ''}</Text></Pressable>;
        })}
      </View>
      {!premium ? <Text style={estilos.texto}>O tema Céu está disponível no plano grátis. Os cinco temas fazem parte do Premium.</Text> : null}
      {plano.erro ? <Pressable accessibilityRole="button" disabled={gerando} onPress={plano.recarregar} style={estilos.acao}><Text style={estilos.link}>Não foi possível consultar o plano. Tentar novamente</Text></Pressable> : null}
      <View key={assinatura} ref={cartao} collapsable={false} onLayout={() => setPronto(assinatura)} style={[estilos.cartao, { width: largura, height: largura * FORMATOS_CARTAO[formato].altura / FORMATOS_CARTAO[formato].largura, padding: 18 * escala, gap: 10 * escala, backgroundColor: tema.fundo }]}>
        <Text allowFontScaling={false} style={[estilos.marca, { color: tema.tinta, fontSize: 15 * escala }]}>PetLive</Text>
        <View style={[estilos.corpo, { gap: 14 * escala }, vertical && estilos.corpoVertical]}>
          {dados.foto ? <Image source={{ uri: dados.foto }} style={[estilos.foto, { width: largura * (vertical ? 0.68 : 0.34) }]} accessibilityLabel={`Foto de ${dados.nome}`} onLoad={() => { setFotoCarregada(assinatura); setFotoFalhou(null); }} onError={() => setFotoFalhou(dados.foto)} /> : <View style={[estilos.foto, estilos.semFoto, { width: largura * (vertical ? 0.68 : 0.34), backgroundColor: tema.detalhe }]}><Text allowFontScaling={false} style={[estilos.inicial, { color: tema.tinta }]}>{dados.nome.charAt(0).toUpperCase()}</Text></View>}
          <View style={[estilos.identidade, vertical && { alignItems: 'center' }]}>
            <Text allowFontScaling={false} numberOfLines={2} ellipsizeMode="tail" style={[estilos.nome, { color: tema.tinta, fontSize: 26 * escala, lineHeight: 31 * escala }, vertical && { textAlign: 'center' }]}>{dados.nome}</Text>
            <Text allowFontScaling={false} numberOfLines={2} style={[estilos.raca, { color: tema.tinta, fontSize: 12 * escala }, vertical && { textAlign: 'center' }]}>{dados.especie} · {dados.raca}</Text>
            {dados.emMemoria ? <Text allowFontScaling={false} style={[estilos.memoria, { color: tema.tinta, fontSize: 13 * escala }]}>Em memória</Text> : null}
          </View>
        </View>
        {!dados.emMemoria ? <View style={[estilos.selos, { gap: 4 * escala }]}>
          {SELOS.filter((s) => dados.selos.includes(s.chave)).map((s) => <View key={s.chave} style={[estilos.selo, { backgroundColor: tema.detalhe, padding: 5 * escala }]}><Text allowFontScaling={false} style={[estilos.seloTexto, { color: tema.tinta, fontSize: 9 * escala }]}>{s.rotulo}</Text></View>)}
        </View> : null}
        <View style={[estilos.convite, { gap: 10 * escala }]}>
          {convite ? <CodigoQR valor={convite} tamanho={64 * escala} rotulo="QR Code do convite para conhecer o PetLive" /> : null}
          <View style={estilos.conviteTexto}>
            <Text allowFontScaling={false} style={[estilos.rodape, { color: tema.tinta, fontSize: 11 * escala }]}>{dados.emMemoria ? 'Uma história que fica.' : 'Cuidados que fazem parte da nossa história.'}</Text>
            {convite ? <Text allowFontScaling={false} style={[estilos.temaNome, { color: tema.tinta, fontSize: 11 * escala }]}>Conheça o PetLive</Text> : null}
          </View>
        </View>
      </View>
      <Text style={estilos.texto}>Prévia de {FORMATOS_CARTAO[formato].largura} × {FORMATOS_CARTAO[formato].altura}. A imagem inclui foto, nome, espécie, raça e selos exibidos. O QR do convite abre o site do PetLive. Seus contatos e dados de saúde não aparecem.</Text>
      {selos === null && !erroSelos ? <ActivityIndicator accessibilityLabel="Carregando selos" /> : null}
      {erroSelos ? <View><Text accessibilityRole="alert" style={estilos.erro}>{erroSelos}</Text><Pressable accessibilityRole="button" onPress={() => setTentativa((n) => n + 1)} style={estilos.acao}><Text style={estilos.link}>Recarregar selos</Text></Pressable></View> : null}
      {dados.foto && fotoFalhou === dados.foto ? <View><Text accessibilityRole="alert" style={estilos.erro}>A foto não carregou. Confira sua conexão antes de gerar a imagem.</Text><Pressable accessibilityRole="button" onPress={() => { setFotoFalhou(null); setTentativaFoto((n) => n + 1); }} style={estilos.acao}><Text style={estilos.link}>Recarregar foto</Text></Pressable></View> : null}
      {erro ? <Text accessibilityRole="alert" style={estilos.erro}>{erro}</Text> : null}
      <BotaoPrimario titulo="Gerar e compartilhar imagem" onPress={() => void compartilhar()} carregando={gerando} desabilitado={pronto !== assinatura || !fotoPronta || selos === null} />
      {convite ? <Pressable accessibilityRole="button" disabled={gerando} onPress={() => void compartilharConvite()} style={estilos.acao}><Text style={estilos.link}>Compartilhar link de convite</Text></Pressable> : <Text style={estilos.erro}>O endereço do convite não está configurado. A imagem pode ser gerada sem o convite.</Text>}
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
  secao: { ...typography.bodyMedium, color: colors.black },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcao: { minHeight: 44, justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: radius.pill, paddingHorizontal: spacing.md },
  selecionado: { borderColor: colors.primaryDeep },
  temaNome: { fontFamily: fontFamily.semiBold, fontSize: 13 },
  corpo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  corpoVertical: { flexDirection: 'column' },
  identidade: { flexShrink: 1, gap: 6 },
  convite: { flexDirection: 'row', alignItems: 'center' },
  conviteTexto: { flex: 1, gap: 4 },
  marca: { fontFamily: fontFamily.bold, fontSize: 18, color: colors.primaryDeep },
  foto: { aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surface },
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
