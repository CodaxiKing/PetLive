import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Tocavel } from '../../src/components/Animacoes';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { aplicarCurtida, carregarFeed, curtir, urlsDasFotos, type Feed, type Post } from '../../src/comunidade/comunidade';
import { CartaoPost } from '../../src/comunidade/CartaoPost';
import { mensagemDeErro } from '../../src/lib/cacheOffline';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

/** Comunidade (protótipo Comunidade, tela 62; BUSINESS.md 5.28). */
export default function Comunidade() {
  const { pets } = usePets();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [fim, setFim] = useState(false);

  const juntarFotos = (posts: Post[]) => urlsDasFotos(posts).then((u) => setFotos((f) => ({ ...f, ...u })));

  const carregar = useCallback(() => {
    setErro(null);
    return carregarFeed().then(
      (f) => {
        setFeed(f);
        setFim(f.posts.length < 20);
        juntarFotos(f.posts);
      },
      (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  function maisPosts() {
    if (!feed || fim || !feed.posts.length) return;
    carregarFeed(feed.posts[feed.posts.length - 1].criado_em).then((f) => {
      setFim(f.posts.length < 20);
      setFeed((atual) => (atual ? { ...atual, posts: [...atual.posts, ...f.posts.filter((p) => !atual.posts.some((x) => x.id === p.id))] } : atual));
      juntarFotos(f.posts);
    }, () => undefined);
  }

  function alternarCurtida(post: Post) {
    setFeed((f) => (f ? { ...f, posts: aplicarCurtida(f.posts, post.id, !post.curti) } : f));
    curtir(post.id).then(
      (curti) => setFeed((f) => (f ? { ...f, posts: aplicarCurtida(f.posts, post.id, curti) } : f)),
      () => setFeed((f) => (f ? { ...f, posts: aplicarCurtida(f.posts, post.id, post.curti) } : f)),
    );
  }

  const cabecalho = (
    <View style={estilos.cabecalho}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.historias}>
        <Tocavel accessibilityRole="button" accessibilityLabel="Novo post" onPress={() => router.push('/comunidade/novo')} style={estilos.historia}>
          <View style={[estilos.bolinha, estilos.novo]}>
            <Text style={estilos.mais}>+</Text>
          </View>
          <Text style={estilos.historiaNome}>Você</Text>
        </Tocavel>
        {pets.map((p) => (
          <Tocavel key={p.id} accessibilityRole="link" onPress={() => router.push(`/comunidade/pet/${p.id}`)} style={estilos.historia}>
            <AvatarPet especie={p.especie} foto={p.foto_url} size={60} />
            <Text style={estilos.historiaNome} numberOfLines={1}>{p.nome}</Text>
          </Tocavel>
        ))}
        {feed?.seguindo.map((p) => (
          <Tocavel key={p.id} accessibilityRole="link" onPress={() => router.push(`/comunidade/pet/${p.id}`)} style={estilos.historia}>
            <AvatarPet especie={p.especie} foto={p.foto_url} size={60} />
            <Text style={estilos.historiaNome} numberOfLines={1}>{p.nome}</Text>
          </Tocavel>
        ))}
      </ScrollView>
      {feed && feed.seguindo.length === 0 && feed.posts.length > 0 ? (
        <Text style={estilos.dica}>Você ainda não segue nenhum pet. Estes são os posts mais recentes da comunidade.</Text>
      ) : null}
    </View>
  );

  return (
    <View style={estilos.tela}>
      <HeroiOnda subtitulo="Rede social" titulo="Comunidade" altura={180} />
      {!feed ? (
        <View style={estilos.centro}>{erro ? <Text style={estilos.vazio}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>
      ) : (
        <FlatList
          data={feed.posts}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={cabecalho}
          contentContainerStyle={estilos.lista}
          renderItem={({ item }) => <CartaoPost post={item} foto={fotos[item.foto_path]} onCurtir={() => alternarCurtida(item)} onMudou={carregar} />}
          ItemSeparatorComponent={() => <View style={estilos.separador} />}
          onEndReached={maisPosts}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={() => { setAtualizando(true); carregar()?.finally(() => setAtualizando(false)); }} />}
          ListEmptyComponent={
            <View style={estilos.vazioCartao}>
              <Text style={estilos.vazioTitulo}>Ainda não há posts</Text>
              <Text style={estilos.vazio}>Ligue o perfil público de um pet e publique a primeira foto. Tudo começa privado; só aparece o que você publicar.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lista: { paddingHorizontal: 24, paddingBottom: 32 },
  cabecalho: { marginBottom: 12, gap: 8 },
  historias: { gap: 14, paddingVertical: 4 },
  historia: { alignItems: 'center', gap: 6, width: 64 },
  bolinha: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  novo: { backgroundColor: colors.black },
  mais: { fontFamily: fontFamily.medium, fontSize: 28, color: colors.white, marginTop: -2 },
  historiaNome: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.black, maxWidth: 64 },
  dica: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  separador: { height: 12 },
  vazioCartao: { backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 6 },
  vazioTitulo: { fontFamily: fontFamily.bold, fontSize: 16, color: colors.black },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
