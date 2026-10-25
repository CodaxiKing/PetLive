import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/auth/AuthProvider';
import { dadosDaEdicao, enviarFotoOng, NOVO_PET_ONG, obterPetOng, salvarPetOng, type DadosPetOng } from '../../src/adocao/editarPetOng';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export default function PetDaOng() {
  const { user, carregando } = useAuth();
  const { pet, ong } = useLocalSearchParams<{ pet?: string; ong?: string }>();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!user) return <Redirect href="/welcome" />;
  if ((!uuid(pet) && !uuid(ong)) || (pet !== undefined && !uuid(pet))) return <View><CabecalhoTela titulo="Pet da ONG" /><Text>Link inválido. Volte ao painel da ONG.</Text></View>;
  return <Editor key={`${user.id}:${pet ?? ong}`} tutor={user.id} petInicial={pet} ongInicial={ong} />;
}
function Editor({ tutor, petInicial, ongInicial }: { tutor: string; petInicial?: string; ongInicial?: string }) {
  const [id] = useState(() => petInicial ?? Crypto.randomUUID());
  const [ong, setOng] = useState(ongInicial ?? ''), [versao, setVersao] = useState(0);
  const [dados, setDados] = useState<DadosPetOng>(() => dadosDaEdicao(NOVO_PET_ONG));
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const trava = useRef(false), foco = useRef(false), epoca = useRef(0);
  const carregar = useCallback(async () => {
    if (trava.current) return;
    const req = epoca.current; trava.current = true; setOcupado(true); setErro(null); setAviso(null);
    try { const p = await obterPetOng(tutor, id); if (foco.current && req === epoca.current) { setDados(dadosDaEdicao(p)); setOng(p.ong_id); setVersao(p.versao); setAviso('Ficha atualizada com os dados salvos no servidor.'); } }
    catch (e) { if (foco.current && req === epoca.current) setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { if (req === epoca.current) { trava.current = false; setOcupado(false); } }
  }, [tutor, id]);
  useFocusEffect(useCallback(() => { foco.current = true; if (petInicial) void carregar(); return () => { foco.current = false; epoca.current += 1; trava.current = false; setOcupado(false); }; }, [carregar, petInicial]));
  const alterar = <K extends keyof DadosPetOng>(campo: K, valor: DadosPetOng[K]) => { setDados((d) => ({ ...d, [campo]: valor })); setAviso(null); };
  async function salvar(publicar = false) {
    if (trava.current) return;
    const req = epoca.current; trava.current = true; setOcupado(true); setErro(null); setAviso(null);
    try {
      const p = await salvarPetOng(tutor, id, ong, versao, { ...dados, status: publicar ? 'publicado' : dados.status });
      if (foco.current && req === epoca.current) { setDados(dadosDaEdicao(p)); setVersao(p.versao); setAviso(p.status === 'publicado' ? 'Pet publicado. A disponibilidade foi confirmada hoje.' : 'Rascunho salvo. Agora você pode adicionar fotos.'); }
    } catch (e) { if (foco.current && req === epoca.current) setErro(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { if (req === epoca.current) { trava.current = false; setOcupado(false); } }
  }
  async function foto() {
    if (trava.current || !versao || dados.fotos.length >= 6) return;
    const req = epoca.current; trava.current = true; setOcupado(true); setErro(null); setAviso(null);
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (r.canceled || !foco.current || req !== epoca.current) return;
      const url = await enviarFotoOng(tutor, id, r.assets[0]);
      if (foco.current && req === epoca.current) { setDados((d) => ({ ...d, fotos: [...d.fotos, url] })); setAviso('Foto enviada. Salve as alterações para incluí-la na ficha.'); }
    } catch (e) { if (foco.current && req === epoca.current) setErro(e instanceof Error ? e.message : 'Não foi possível escolher a foto.'); }
    finally { if (req === epoca.current) { trava.current = false; setOcupado(false); } }
  }
  function escolhas(campo: 'especie' | 'porte' | 'sexo' | 'castrado' | 'vacinado' | 'vermifugado', titulo: string, opcoes: [string | boolean | null, string][]) {
    return <View style={s.grupo}><Text style={s.rotulo}>{titulo}</Text><View style={s.linha}>{opcoes.map(([valor, rotulo]) => <Pressable key={String(valor)} accessibilityRole="radio" accessibilityLabel={`${titulo}: ${rotulo}`} accessibilityState={{ checked: dados[campo] === valor, disabled: ocupado }} disabled={ocupado} onPress={() => alterar(campo, valor as DadosPetOng[typeof campo])} style={[s.opcao, dados[campo] === valor && s.ativo]}><Text style={s.texto}>{rotulo}</Text></Pressable>)}</View></View>;
  }
  if (petInicial && !versao) return <View style={s.tela}><CabecalhoTela titulo="Pet da ONG" /><View style={s.conteudo}>{erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : <Text style={s.texto}>Carregando a ficha do pet…</Text>}<BotaoPrimario titulo="Atualizar ficha" carregando={ocupado} onPress={() => { void carregar(); }} /></View></View>;
  return <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><CabecalhoTela titulo={petInicial ? 'Editar pet da ONG' : 'Novo pet da ONG'} />
    <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      <Text style={s.texto}>Preencha os dados e salve um rascunho. Depois adicione fotos e publique. As fotos são públicas; escolha apenas imagens autorizadas para divulgação. Alterações só entram na ficha ao salvar.</Text>
      <Text style={s.rotulo}>Nome</Text><TextInput accessibilityLabel="Nome do pet para adoção" editable={!ocupado} value={dados.nome} maxLength={60} onChangeText={(v) => alterar('nome', v)} style={s.campo} />
      {escolhas('especie', 'Espécie', [['cao', 'Cão'], ['gato', 'Gato']])}
      <Text style={s.rotulo}>Nascimento (opcional, AAAA-MM-DD)</Text><TextInput accessibilityLabel="Nascimento do pet para adoção" editable={!ocupado} value={dados.nascimento ?? ''} maxLength={10} placeholder="AAAA-MM-DD" onChangeText={(v) => alterar('nascimento', v || null)} style={s.campo} />
      {escolhas('porte', 'Porte', [['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']])}
      {escolhas('sexo', 'Sexo', [['macho', 'Macho'], ['femea', 'Fêmea'], ['nao_informado', 'Não informado']])}
      {(['castrado', 'vacinado', 'vermifugado'] as const).map((c) => <View key={c}>{escolhas(c, c === 'castrado' ? 'Castrado' : c === 'vacinado' ? 'Vacinado' : 'Vermifugado', [[true, 'Sim'], [false, 'Não'], [null, 'Não informado']])}</View>)}
      <Text style={s.rotulo}>Descrição e cuidados</Text><TextInput accessibilityLabel="Descrição do pet para adoção" editable={!ocupado} value={dados.descricao} maxLength={2000} multiline textAlignVertical="top" onChangeText={(v) => alterar('descricao', v)} style={[s.campo, s.descricao]} />
      <Text style={s.rotulo}>Fotos ({dados.fotos.length}/6)</Text>
      {dados.fotos.map((uri, i) => <View key={uri} style={s.grupo}><Image source={{ uri }} accessibilityLabel={`Foto ${i + 1} do pet`} style={s.foto} /><Pressable accessibilityRole="button" disabled={ocupado} onPress={() => alterar('fotos', dados.fotos.filter((f) => f !== uri))} style={s.opcao}><Text style={s.texto}>Remover foto {i + 1} da ficha</Text></Pressable></View>)}
      {versao ? <BotaoPrimario titulo="Adicionar foto" desabilitado={ocupado || dados.fotos.length >= 6} onPress={() => { void foto(); }} /> : <Text style={s.texto}>Salve o rascunho para adicionar as fotos.</Text>}
      {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}{aviso ? <Text accessibilityRole="alert" style={s.texto}>{aviso}</Text> : null}
      <BotaoPrimario titulo={dados.status === 'publicado' ? 'Salvar alterações' : 'Salvar rascunho'} carregando={ocupado} onPress={() => { void salvar(); }} />
      {dados.status === 'rascunho' ? <BotaoPrimario titulo="Publicar no catálogo" desabilitado={ocupado || !dados.fotos.length} onPress={() => { const req = epoca.current; Alert.alert('Publicar para adoção?', 'Confirme os dados, fotos e a disponibilidade deste pet. Ele aparecerá no catálogo público de adoção.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Publicar', onPress: () => { if (foco.current && req === epoca.current) void salvar(true); } }]); }} /> : null}
      <Pressable accessibilityRole="button" disabled={ocupado} style={s.opcao} onPress={() => Alert.alert('Atualizar a ficha?', 'Isso descarta alterações não salvas e busca os dados do servidor.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Atualizar', onPress: () => { if (foco.current) void carregar(); } }])}><Text style={s.texto}>Atualizar ficha do servidor</Text></Pressable>
    </ScrollView></KeyboardAvoidingView>;
}
const s = StyleSheet.create({ tela: { flex: 1, backgroundColor: colors.surface }, conteudo: { paddingHorizontal: 24, paddingBottom: 48, gap: 16 }, grupo: { gap: 10 }, linha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, rotulo: { ...typography.body, fontWeight: '700', color: colors.black }, texto: { ...typography.body, color: colors.textMuted }, erro: { ...typography.body, color: colors.danger }, campo: { ...typography.body, color: colors.black, backgroundColor: colors.background, padding: 14, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 16 }, descricao: { minHeight: 140 }, opcao: { padding: 12, minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 16, justifyContent: 'center' }, ativo: { backgroundColor: colors.hero }, foto: { width: '100%', height: 230, borderRadius: 20 } });
