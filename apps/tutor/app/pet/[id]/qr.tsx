import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View, type ViewInstance } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { BotaoRedondo } from '../../../src/components/Layout';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { EtiquetaColeira } from '../../../src/pets/EtiquetaColeira';
import { usePets } from '../../../src/pets/PetsProvider';
import { carregarQr, salvarQr, urlQr, type QrPet } from '../../../src/pets/qrColeira';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

const escolhas = { show_photo: 'Foto do pet', show_phone: 'Seu telefone', show_allergies: 'Alergias e condições', active: 'QR ativo' } as const;
const iniciais = { show_photo: false, show_phone: false, show_allergies: false, active: true };

export default function QrColeira() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { pets, carregando } = usePets();
  const pet = pets.find((p) => p.id === id);
  return carregando ? <ActivityIndicator /> : !pet ? <Text>Pet não encontrado ou em memória.</Text> : <EditorQr key={pet.id} pet={pet.id} nome={pet.nome} />;
}

function EditorQr({ pet, nome }: { pet: string; nome: string }) {
  const insets = useSafeAreaInsets();
  const [salvo, setSalvo] = useState<QrPet | null>(null);
  const [campos, setCampos] = useState(iniciais);
  const [carregando, setCarregando] = useState(true);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const trava = useRef(false);
  const ciclo = useRef(0);
  const etiqueta = useRef<ViewInstance>(null);
  useFocusEffect(useCallback(() => {
    let vivo = true;
    carregarQr(pet).then((q) => {
      if (!vivo) return;
      setSalvo(q); setCampos(q ?? iniciais); setErro(null); setCarregando(false); setCarregado(true);
    }).catch(() => { if (vivo) { setErro('Não foi possível carregar o QR. Tente novamente.'); setCarregando(false); setCarregado(false); } });
    return () => { vivo = false; ciclo.current++; };
  // A tentativa permite repetir a consulta após falha de rede.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet, tentativa]));
  const alterado = !salvo || (Object.keys(escolhas) as (keyof typeof escolhas)[]).some((k) => campos[k] !== salvo[k]);
  async function executar(enviar: boolean) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    const versao = ciclo.current;
    try {
      if (!enviar) {
        const q = await salvarQr(pet, campos);
        if (versao === ciclo.current) setSalvo(q);
      } else {
        if (!salvo?.active || alterado || !pronto) return;
        if (Platform.OS === 'web') throw new Error('Use o app no celular para salvar a etiqueta.');
        const Sharing = await import('expo-sharing');
        if (!await Sharing.isAvailableAsync()) throw new Error('O compartilhamento não está disponível neste aparelho.');
        const { captureRef } = await import('react-native-view-shot');
        if (versao !== ciclo.current) return;
        const arquivo = await captureRef(etiqueta, { format: 'png', quality: 1, result: 'tmpfile' });
        if (versao !== ciclo.current) return;
        await Sharing.shareAsync(arquivo, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Salvar etiqueta da coleira' });
      }
    } catch (e) {
      if (versao === ciclo.current) setErro(e instanceof Error && !/native module|RNViewShot|ExpoSharing/i.test(e.message) ? e.message : 'Não foi possível salvar a etiqueta. Atualize o app e tente novamente.');
    } finally { trava.current = false; setOcupado(false); }
  }
  return <ScrollView style={s.tela} contentContainerStyle={{ padding: 24, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24, gap: 18 }}>
    <BotaoRedondo acessibilidade="Voltar" onPress={() => router.back()}><ArrowLeft size={22} color={colors.black} /></BotaoRedondo>
    <Text accessibilityRole="header" style={s.titulo}>QR da coleira</Text>
    <Text style={s.texto}>Quem escanear verá o nome e a espécie de {nome}. Escolha os dados adicionais. As alterações valem também para etiquetas já impressas.</Text>
    {carregando ? <ActivityIndicator /> : carregado ? <>
      {(Object.keys(escolhas) as (keyof typeof escolhas)[]).map((k) => <View key={k} style={s.linha}>
        <Text style={s.texto}>{escolhas[k]}</Text><Switch accessibilityLabel={escolhas[k]} value={campos[k]} disabled={ocupado} onValueChange={(v) => setCampos((c) => ({ ...c, [k]: v }))} />
      </View>)}
      <BotaoPrimario titulo={salvo ? 'Salvar permissões' : 'Gerar QR'} carregando={ocupado} onPress={() => { void executar(false); }} />
      {salvo?.active ? <>
        <View ref={etiqueta} collapsable={false} onLayout={() => setPronto(true)} style={s.etiqueta}>
          <EtiquetaColeira nome={nome} url={urlQr(salvo.code)} />
        </View>
        <Text style={s.texto}>Página pública: nome e espécie{salvo.show_photo ? ', foto' : ''}{salvo.show_phone ? ', telefone do tutor' : ''}{salvo.show_allergies ? ', alergias e condições' : ''}. O endereço permanece o mesmo ao salvar.</Text>
        {alterado ? <Text style={s.texto}>Salve as permissões antes de baixar.</Text> : null}
        <BotaoPrimario titulo="Baixar etiqueta PNG" desabilitado={alterado || !pronto || ocupado} onPress={() => { void executar(true); }} />
      </> : salvo ? <Text style={s.texto}>QR desativado. A etiqueta não mostra dados até você ativar novamente.</Text> : null}
    </> : null}
    {erro ? <View><Text accessibilityRole="alert" style={s.erro}>{erro}</Text><Pressable accessibilityRole="button" onPress={() => setTentativa((n) => n + 1)}><Text style={s.link}>Recarregar QR</Text></Pressable></View> : null}
    <Text style={s.texto}>Ao ativar foto, telefone ou alergias, você permite que qualquer pessoa com a etiqueta ou o link veja esses dados. Você pode desativar o QR a qualquer momento. Não incluímos endereço ou histórico de saúde.</Text>
  </ScrollView>;
}
const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface }, titulo: { fontFamily: fontFamily.bold, fontSize: 25, color: colors.black },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.black },
  link: { color: colors.primaryDeep, fontFamily: fontFamily.bold, paddingVertical: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiqueta: { backgroundColor: colors.white, width: '100%', maxWidth: 360, alignSelf: 'center', borderRadius: 28, overflow: 'hidden' },
  erro: { color: '#A32035', fontSize: 14 },
});
