import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../../src/components/Animacoes';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { Icone } from '../../../src/components/Icone';
import {
  abrirPost,
  apagarComentario,
  aplicarCurtida,
  comentar,
  curtir,
  denunciar,
  MOTIVOS_DENUNCIA,
  urlsDasFotos,
  type Comentario,
  type PostAberto,
} from '../../../src/comunidade/comunidade';
import { CartaoPost } from '../../../src/comunidade/CartaoPost';
import { mensagemDeErro } from '../../../src/lib/cacheOffline';
import { haQuanto } from '../../../src/perdido/perdido';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

/** Post com os comentários. */
export default function PostComunidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [aberto, setAberto] = useState<PostAberto | null>(null);
  const [foto, setFoto] = useState<string | undefined>();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!id) return;
    abrirPost(id).then(
      (a) => {
        setAberto(a);
        if (a.disponivel) urlsDasFotos([a.post]).then((u) => setFoto(u[a.post.foto_path]));
      },
      (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
    );
  }, [id]);
  useFocusEffect(carregar);

  async function enviar() {
    if (!aberto?.disponivel) return;
    setEnviando(true);
    setErro(null);
    try {
      await comentar(aberto.post.id, texto);
      setTexto('');
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  function opcoes(c: Comentario) {
    if (c.meu || (aberto?.disponivel && aberto.post.meu)) {
      Alert.alert('Apagar comentário?', undefined, [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => apagarComentario(c.id).then(carregar, (e: Error) => Alert.alert('Não deu certo', e.message)) },
      ]);
      if (c.meu) return;
    }
    if (!c.meu) {
      Alert.alert('Denunciar comentário', undefined, [
        ...MOTIVOS_DENUNCIA.map((m) => ({ text: m, onPress: () => denunciar('comentario', c.id, m).then(() => Alert.alert('Obrigado', 'Recebemos a denúncia.'), () => undefined) })),
        { text: 'Cancelar', style: 'cancel' as const },
      ]);
    }
  }

  if (!aberto) {
    return <View style={[estilos.tela, estilos.centro]}>{erro ? <Text style={estilos.vazio}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>;
  }
  if (!aberto.disponivel) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Text style={estilos.vazio}>Este post não está mais disponível.</Text>
        <View style={estilos.voltar}>
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const { post } = aberto;
  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.barra}>
        <Tocavel accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.botaoVoltar}>
          <Icone nome="seta" size={18} espessura={2.2} />
        </Tocavel>
        <Text style={estilos.titulo}>Post de {post.pet}</Text>
      </View>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <CartaoPost
          post={post}
          foto={foto}
          onCurtir={() => {
            setAberto({ ...aberto, post: aplicarCurtida([post], post.id, !post.curti)[0] });
            curtir(post.id).then((c) => setAberto((a) => (a?.disponivel ? { ...a, post: aplicarCurtida([a.post], post.id, c)[0] } : a)), () => carregar());
          }}
          onMudou={() => router.back()}
        />
        <Text style={estilos.secao}>Comentários</Text>
        {aberto.comentarios.length === 0 ? <Text style={estilos.vazio}>Seja o primeiro a comentar.</Text> : null}
        {aberto.comentarios.map((c) => (
          <Tocavel key={c.id} accessibilityRole="button" accessibilityHint="Toque e segure para opções" onLongPress={() => opcoes(c)} style={estilos.comentario}>
            <Text style={estilos.comentarioAutor}>
              {c.autor} <Text style={estilos.comentarioQuando}>· {haQuanto(c.criado_em)}</Text>
            </Text>
            <Text style={estilos.comentarioTexto}>{c.texto}</Text>
          </Tocavel>
        ))}
      </ScrollView>
      <View style={estilos.rodape}>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        <View style={estilos.entrada}>
          <TextInput value={texto} onChangeText={setTexto} placeholder="Escreva um comentário" placeholderTextColor={colors.textMuted} maxLength={300} style={estilos.campo} />
          <Tocavel accessibilityRole="button" accessibilityLabel="Enviar comentário" disabled={enviando || !texto.trim()} onPress={enviar} style={[estilos.enviar, (!texto.trim() || enviando) && estilos.desligado]}>
            {enviando ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={estilos.enviarTexto}>Enviar</Text>}
          </Tocavel>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 52, paddingHorizontal: 24, paddingBottom: 12 },
  botaoVoltar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] },
  titulo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 18, color: colors.black },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  comentario: { backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  comentarioAutor: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  comentarioQuando: { fontFamily: fontFamily.regular, color: colors.textMuted },
  comentarioTexto: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.black },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted },
  voltar: { alignSelf: 'stretch', marginTop: 16 },
  rodape: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 6 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  entrada: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  campo: { flex: 1, height: 48, borderRadius: 24, backgroundColor: colors.surface, paddingHorizontal: 18, fontFamily: fontFamily.regular, fontSize: 15, color: colors.black },
  enviar: { height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
  desligado: { opacity: 0.4 },
  enviarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.white },
});
