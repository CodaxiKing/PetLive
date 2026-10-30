import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../../src/components/Animacoes';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { Icone } from '../../../src/components/Icone';
import { Interruptor } from '../../../src/components/Interruptor';
import { Mascote } from '../../../src/components/Mascote';
import { abrirPerfil, configurarPerfil, idadeTexto, seguir, urlsDasFotos, type PerfilPublico } from '../../../src/comunidade/comunidade';
import { mensagemDeErro } from '../../../src/lib/cacheOffline';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

/** Perfil público do pet (protótipo PerfilPet, tela 63). Tudo privado até o titular ligar. */
export default function PerfilPet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ ativo: boolean; bio: string; cidade: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(() => {
    if (!id) return;
    abrirPerfil(id).then(
      (p) => {
        setPerfil(p);
        if (p.disponivel) urlsDasFotos(p.posts).then(setFotos);
      },
      (e: unknown) => setErro(mensagemDeErro(e instanceof Error ? e.message : String(e))),
    );
  }, [id]);
  useFocusEffect(carregar);

  async function alternarSeguir() {
    if (!perfil?.disponivel) return;
    setOcupado(true);
    try {
      const segue = await seguir(perfil.pet.id);
      setPerfil({ ...perfil, seguindo: segue, seguidores: perfil.seguidores + (segue ? 1 : -1) });
    } catch (e) {
      Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  async function salvar() {
    if (!perfil?.disponivel || !editando) return;
    setOcupado(true);
    try {
      await configurarPerfil(perfil.pet.id, editando.ativo, editando.bio, editando.cidade);
      setEditando(null);
      carregar();
    } catch (e) {
      Alert.alert('Não deu certo', e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  }

  if (!perfil) {
    return <View style={[estilos.tela, estilos.centro]}>{erro ? <Text style={estilos.texto}>{erro}</Text> : <ActivityIndicator color={colors.primaryDeep} />}</View>;
  }
  if (!perfil.disponivel) {
    return (
      <View style={[estilos.tela, estilos.centro]}>
        <Text style={estilos.fimTitulo}>Perfil indisponível</Text>
        <Text style={estilos.texto}>Este pet não tem perfil público ou o tutor desligou.</Text>
        <View style={estilos.voltar}>
          <BotaoPrimario titulo="Voltar" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const { pet } = perfil;
  const linha = [pet.raca ?? (pet.especie === 'gato' ? 'Gato' : 'Cão'), idadeTexto(pet.nascimento), perfil.cidade].filter(Boolean).join(' · ');
  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.topo}>
          <Tocavel accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={estilos.botaoVoltar}>
            <Icone nome="seta" size={18} espessura={2.2} />
          </Tocavel>
          {pet.foto_url ? <Image source={{ uri: pet.foto_url }} style={estilos.avatar} accessibilityLabel={`Foto de ${pet.nome}`} /> : <Mascote especie={pet.especie} size={120} />}
          <Text style={estilos.nome}>{pet.nome}</Text>
          <Text style={estilos.sub}>{linha}</Text>
          {perfil.bio ? <Text style={estilos.bio}>{perfil.bio}</Text> : null}
          <View style={estilos.numeros}>
            <View style={estilos.numero}>
              <Text style={estilos.numeroValor}>{perfil.total_posts}</Text>
              <Text style={estilos.numeroRotulo}>posts</Text>
            </View>
            <View style={estilos.numero}>
              <Text style={estilos.numeroValor}>{perfil.seguidores}</Text>
              <Text style={estilos.numeroRotulo}>seguidores</Text>
            </View>
          </View>
          {perfil.dono ? (
            <View style={estilos.botao}>
              {!perfil.ativo ? <Text style={estilos.privado}>Perfil privado: só você vê esta página.</Text> : null}
              <BotaoPrimario
                titulo={perfil.ativo ? 'Editar perfil público' : 'Ligar perfil público'}
                onPress={() => setEditando({ ativo: true, bio: perfil.bio ?? '', cidade: perfil.mostrar_cidade })}
              />
            </View>
          ) : (
            <View style={estilos.botao}>
              <BotaoPrimario titulo={perfil.seguindo ? 'Seguindo' : 'Seguir'} carregando={ocupado} onPress={alternarSeguir} />
            </View>
          )}
        </View>

        {editando ? (
          <View style={estilos.edicao}>
            <View style={estilos.linha}>
              <View style={estilos.flex}>
                <Text style={estilos.linhaTitulo}>Perfil público</Text>
                <Text style={estilos.linhaSub}>Quem tem conta vê a foto, a raça, a idade e os posts.</Text>
              </View>
              <Interruptor ligado={editando.ativo} rotulo="Perfil público" onToggle={() => setEditando({ ...editando, ativo: !editando.ativo })} />
            </View>
            <View style={estilos.linha}>
              <View style={estilos.flex}>
                <Text style={estilos.linhaTitulo}>Mostrar a cidade</Text>
                <Text style={estilos.linhaSub}>Só a cidade do seu perfil, nunca o endereço.</Text>
              </View>
              <Interruptor ligado={editando.cidade} rotulo="Mostrar a cidade" onToggle={() => setEditando({ ...editando, cidade: !editando.cidade })} />
            </View>
            <TextInput
              value={editando.bio}
              onChangeText={(bio) => setEditando({ ...editando, bio })}
              placeholder="Uma frase sobre o pet (opcional)"
              placeholderTextColor={colors.textMuted}
              maxLength={160}
              style={estilos.campo}
            />
            <BotaoPrimario titulo="Salvar" carregando={ocupado} onPress={salvar} />
            <Tocavel accessibilityRole="button" onPress={() => setEditando(null)} style={estilos.cancelar}>
              <Text style={estilos.cancelarTexto}>Cancelar</Text>
            </Tocavel>
          </View>
        ) : null}

        {perfil.posts.length === 0 ? (
          <Text style={estilos.vazio}>{perfil.dono ? 'Nenhum post ainda. Publique pela Comunidade.' : 'Nenhum post ainda.'}</Text>
        ) : (
          <View style={estilos.grade}>
            {perfil.posts.map((p) => (
              <Tocavel key={p.id} accessibilityRole="button" accessibilityLabel={p.legenda ?? `Post de ${pet.nome}`} onPress={() => router.push(`/comunidade/post/${p.id}`)} style={estilos.celula}>
                {fotos[p.foto_path] ? <Image source={{ uri: fotos[p.foto_path] }} style={estilos.miniatura} /> : <View style={[estilos.miniatura, estilos.semFoto]} />}
              </Tocavel>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingBottom: 32 },
  topo: { alignItems: 'center', paddingTop: 52, paddingHorizontal: 24, gap: 6, backgroundColor: colors.primarySurface, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, paddingBottom: 22 },
  botaoVoltar: { position: 'absolute', left: 24, top: 52, width: 46, height: 46, borderRadius: 23, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: -1 }] },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: colors.white },
  nome: { fontFamily: fontFamily.medium, fontSize: 30, letterSpacing: -0.8, color: colors.black, marginTop: 6 },
  sub: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  bio: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: colors.black, textAlign: 'center', marginTop: 4 },
  numeros: { flexDirection: 'row', gap: 36, marginTop: 10 },
  numero: { alignItems: 'center' },
  numeroValor: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  numeroRotulo: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  botao: { alignSelf: 'stretch', marginTop: 12, gap: 8 },
  privado: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.primaryDeep, textAlign: 'center' },
  edicao: { margin: 24, marginBottom: 0, backgroundColor: colors.background, borderRadius: 24, padding: 16, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  linhaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  campo: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  cancelar: { alignSelf: 'center', padding: 6 },
  cancelarTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.textMuted },
  grade: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 22, paddingTop: 18 },
  celula: { width: '33.33%', padding: 2 },
  miniatura: { width: '100%', aspectRatio: 1, borderRadius: 14 },
  semFoto: { backgroundColor: colors.primarySurface },
  vazio: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', padding: 24 },
  texto: { fontFamily: fontFamily.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  fimTitulo: { fontFamily: fontFamily.bold, fontSize: 20, color: colors.black },
  voltar: { alignSelf: 'stretch', marginTop: 16 },
});
