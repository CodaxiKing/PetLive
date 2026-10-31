import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Tocavel } from '../components/Animacoes';
import { Icone } from '../components/Icone';
import { AvatarPet } from '../pets/AvatarPet';
import { haQuanto } from '../perdido/perdido';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';
import { apagarPost, denunciar, MOTIVOS_DENUNCIA, type Post } from './comunidade';
import { textoDeErro } from '../lib/erros';

/** Post da comunidade (protótipo Comunidade): foto, legenda, curtir e comentar. */
export function CartaoPost({ post, foto, onCurtir, onMudou }: { post: Post; foto?: string; onCurtir: () => void; onMudou: () => void }) {
  function opcoes() {
    if (post.meu) {
      Alert.alert('Apagar este post?', 'Ele some da comunidade e do perfil do pet.', [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Apagar', style: 'destructive', onPress: () => apagarPost(post.id).then(onMudou, (e: Error) => Alert.alert('Não deu certo', textoDeErro(e))) },
      ]);
      return;
    }
    Alert.alert('Denunciar post', 'A equipe revisa. Com várias denúncias, o post some até a revisão.', [
      ...MOTIVOS_DENUNCIA.map((m) => ({
        text: m,
        onPress: () => denunciar('post', post.id, m).then(() => Alert.alert('Obrigado', 'Recebemos a denúncia.'), (e: Error) => Alert.alert('Não deu certo', textoDeErro(e))),
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  }

  return (
    <View style={estilos.cartao}>
      <View style={estilos.topo}>
        <Tocavel accessibilityRole="link" accessibilityLabel={`Perfil de ${post.pet}`} onPress={() => router.push(`/comunidade/pet/${post.pet_id}`)} style={estilos.autor}>
          <AvatarPet especie={post.especie} foto={post.pet_foto} size={38} />
          <View style={estilos.flex}>
            <Text style={estilos.pet} numberOfLines={1}>{post.pet}</Text>
            <Text style={estilos.sub} numberOfLines={1}>{post.autor} · {haQuanto(post.criado_em)}</Text>
          </View>
        </Tocavel>
        <Tocavel accessibilityRole="button" accessibilityLabel={post.meu ? 'Apagar post' : 'Denunciar post'} onPress={opcoes} hitSlop={10} style={estilos.mais}>
          <Text style={estilos.maisTexto}>•••</Text>
        </Tocavel>
      </View>
      <Tocavel accessibilityRole="button" accessibilityLabel={`Abrir post de ${post.pet}`} onPress={() => router.push(`/comunidade/post/${post.id}`)}>
        {foto ? <Image source={{ uri: foto }} style={estilos.foto} accessibilityIgnoresInvertColors /> : <View style={[estilos.foto, estilos.semFoto]} />}
      </Tocavel>
      {post.legenda ? <Text style={estilos.legenda}>{post.legenda}</Text> : null}
      <View style={estilos.acoes}>
        <Tocavel accessibilityRole="button" accessibilityState={{ selected: post.curti }} accessibilityLabel={post.curti ? 'Descurtir' : 'Curtir'} onPress={onCurtir} style={estilos.acao}>
          <Icone nome="coracao" size={20} espessura={2} cor={post.curti ? colors.emergency : colors.black} />
          <Text style={[estilos.acaoTexto, post.curti && { color: colors.emergency }]}>{post.curtidas}</Text>
        </Tocavel>
        <Tocavel accessibilityRole="button" onPress={() => router.push(`/comunidade/post/${post.id}`)} style={estilos.acao}>
          <Text style={estilos.acaoTexto}>{post.comentarios ? `${post.comentarios} ${post.comentarios === 1 ? 'comentário' : 'comentários'}` : 'Comentar'}</Text>
        </Tocavel>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: colors.surface, borderRadius: 26, padding: 12, gap: 10 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  autor: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  pet: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  sub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  mais: { paddingHorizontal: 8, paddingVertical: 4 },
  maisTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.textMuted, letterSpacing: 1 },
  foto: { width: '100%', aspectRatio: 1, borderRadius: 20 },
  semFoto: { backgroundColor: colors.primarySurface },
  legenda: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.black, paddingHorizontal: 4 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 4 },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  acaoTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
});
