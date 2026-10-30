import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/auth/AuthProvider';
import { Tocavel } from '../../../src/components/Animacoes';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../../src/components/HeroiOnda';
import { Icone } from '../../../src/components/Icone';
import { Interruptor } from '../../../src/components/Interruptor';
import { avistar, enviarFotoAvistamento, posicaoAtual } from '../../../src/perdido/perdido';
import { escolherFoto, type AtivoFoto } from '../../../src/pets/CampoFoto';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

const QUANDO = [
  { rotulo: 'Agora', min: 0 },
  { rotulo: 'Há 15 min', min: 15 },
  { rotulo: 'Há 1 h', min: 60 },
];

/** Vi este pet (protótipo PerdidoVisto, tela 66): o tutor recebe o ponto, nunca o telefone de quem avisou. */
export default function ViEstePet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [quando, setQuando] = useState(0);
  const [mensagem, setMensagem] = useState('');
  const [comigo, setComigo] = useState(false);
  const [foto, setFoto] = useState<AtivoFoto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!id || !user) return;
    setErro(null);
    setEnviando(true);
    try {
      // A localização só é lida agora, no toque em Enviar.
      const { lat, lng } = await posicaoAtual();
      const caminho = foto ? await enviarFotoAvistamento(user.id, foto) : null;
      await avistar(id, lat, lng, new Date(Date.now() - QUANDO[quando].min * 60000), mensagem, comigo, caminho);
      Alert.alert('Aviso enviado', 'O tutor recebeu onde você viu o pet. Obrigado por ajudar!');
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Pet perdido" titulo="Vi este pet" altura={180} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={estilos.local}>
          <Icone nome="local" size={20} cor={colors.primaryDeep} espessura={2} />
          <Text style={estilos.localTexto}>Sua localização de agora vai junto quando você tocar em Enviar.</Text>
        </View>
        <Text style={estilos.secao}>Quando você viu</Text>
        <View style={estilos.chips}>
          {QUANDO.map((q, i) => (
            <Tocavel key={q.rotulo} accessibilityRole="radio" accessibilityState={{ selected: i === quando }} onPress={() => setQuando(i)} style={[estilos.chip, i === quando && estilos.chipAtivo]}>
              <Text style={[estilos.chipTexto, i === quando && estilos.textoClaro]}>{q.rotulo}</Text>
            </Tocavel>
          ))}
        </View>
        <View style={estilos.campo}>
          <Text style={estilos.rotulo}>Mensagem para o tutor</Text>
          <TextInput value={mensagem} onChangeText={setMensagem} placeholder="Ex.: correu para a rua de trás" placeholderTextColor={colors.textMuted} multiline maxLength={300} style={estilos.texto} />
        </View>
        <Tocavel
          accessibilityRole="button"
          onPress={() => escolherFoto('camera', false).then((f) => f && setFoto(f))}
          style={estilos.fotoBotao}
        >
          {foto ? <Image source={{ uri: foto.uri }} style={estilos.fotoPrevia} /> : <Icone nome="camera" size={20} espessura={2} />}
          <Text style={estilos.fotoTexto}>{foto ? 'Trocar a foto' : 'Tirar uma foto (opcional)'}</Text>
        </Tocavel>
        <View style={estilos.linha}>
          <View style={estilos.flex}>
            <Text style={estilos.linhaTitulo}>O pet está comigo</Text>
            <Text style={estilos.linhaSub}>Avisa o tutor para vir buscar.</Text>
          </View>
          <Interruptor ligado={comigo} rotulo="O pet está comigo" onToggle={() => setComigo((v) => !v)} />
        </View>
        <Text style={estilos.nota}>Seu nome e seu telefone não vão para o tutor.</Text>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Enviar" carregando={enviando} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  local: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySurface, borderRadius: 20, padding: 14 },
  localTexto: { flex: 1, fontFamily: fontFamily.medium, fontSize: 13, color: colors.primaryDeep },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  chipAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  textoClaro: { color: colors.white },
  campo: { backgroundColor: colors.surface, borderRadius: 22, padding: 14, gap: 4, marginTop: 6 },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 60, textAlignVertical: 'top' },
  fotoBotao: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, borderRadius: 22, padding: 12 },
  fotoPrevia: { width: 48, height: 48, borderRadius: 14 },
  fotoTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.black },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 14 },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  linhaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
