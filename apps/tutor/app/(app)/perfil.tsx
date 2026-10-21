import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { MarcaPata } from '../../src/components/MarcaPata';
import { Mascote } from '../../src/components/Mascote';
import { supabase } from '../../src/lib/supabase';
import { coresDoPet } from '../../src/pets/coresPet';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

/**
 * Perfil do tutor (protótipo Perfil; board P1 "Perfil do tutor e sair da
 * conta"): avatar com a inicial, nome e cidade; os pets; o convite do
 * Premium; atalhos para Avisos e Privacidade; e sair. Tocar no nome edita.
 */
export default function Perfil() {
  const router = useRouter();
  const { user } = useAuth();
  const { pets, definirPetAtivo } = usePets();

  const [nome, setNome] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nomeEdicao, setNomeEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('nome')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setNome(data?.nome ?? null);
      });
  }, [user]);

  const nomeExibido =
    nome?.trim() ||
    (typeof user?.user_metadata?.nome === 'string' && user.user_metadata.nome.trim()) ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email ||
    'Tutor PetLive';
  const inicial = nomeExibido.trim().charAt(0).toUpperCase();

  function abrirEdicao() {
    setNomeEdicao(nomeExibido);
    setEditando(true);
  }

  async function salvarNome() {
    if (!user) return;
    const limpo = nomeEdicao.trim();
    if (!limpo) return;

    setSalvando(true);
    try {
      const { error } = await supabase.from('profiles').update({ nome: limpo }).eq('id', user.id);
      if (error) throw error;

      // Mantém os metadados do auth em dia (exibidos em outras telas).
      const { error: erroAuth } = await supabase.auth.updateUser({
        data: { nome: limpo, full_name: limpo },
      });
      if (erroAuth) throw erroAuth;

      setNome(limpo);
      setEditando(false);
    } catch (e) {
      Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Não foi possível sair', error.message);
      return;
    }
    // Sem sessão o layout raiz volta para as boas-vindas.
    router.replace('/welcome');
  }

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <HeroiOnda titulo="" semVoltar altura={272}>
          <MarcaPata size={150} style={estilos.pataHeroi} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${nomeExibido}. Editar nome`}
            onPress={abrirEdicao}
            style={estilos.identidade}
          >
            <View style={estilos.avatar}>
              <Text style={estilos.avatarLetra}>{inicial}</Text>
            </View>
            <Text style={estilos.nome} numberOfLines={1}>
              {nomeExibido}
            </Text>
          </Pressable>
          <View style={estilos.cidade}>
            <Icone nome="local" size={12} espessura={2.2} />
            <Text style={estilos.cidadeTexto}>Rio de Janeiro</Text>
          </View>
        </HeroiOnda>

        <View style={estilos.corpo}>
          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Meus pets</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push('/pets')} hitSlop={8}>
              <Text style={estilos.secaoAcao}>Ver todos ›</Text>
            </Pressable>
          </View>

          <View style={estilos.pets}>
            {pets.slice(0, 2).map((pet, indice) => {
              const cores = coresDoPet(pet, indice);
              return (
                <Surgir key={pet.id} indice={indice} style={estilos.petSurgir}>
                  <Tocavel
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${pet.nome}`}
                    onPress={() => {
                      definirPetAtivo(pet.id);
                      router.push({ pathname: '/pet/[id]', params: { id: pet.id } });
                    }}
                    style={[estilos.pet, { backgroundColor: cores.fundo, borderColor: cores.borda }]}
                  >
                    <Text style={estilos.petNome} numberOfLines={1}>
                      {pet.nome}
                    </Text>
                    <Text style={[estilos.petRaca, { color: cores.texto }]} numberOfLines={1}>
                      {pet.raca || (pet.especie === 'gato' ? 'Gato' : 'Cão')}
                    </Text>
                    <View style={estilos.petRetrato}>
                      {pet.foto_url ? (
                        <Image source={{ uri: pet.foto_url }} style={estilos.petFoto} />
                      ) : (
                        <Mascote especie={pet.especie} size={96} recorte />
                      )}
                    </View>
                  </Tocavel>
                </Surgir>
              );
            })}
            {pets.length < 2 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/pet/novo')}
                style={[estilos.pet, estilos.petNovo]}
              >
                <Text style={estilos.petNovoTexto}>+ Adicionar pet</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={estilos.premium}>
            <MarcaPata size={110} cor="#5E86A6" style={estilos.pataPremium} />
            <Text style={estilos.premiumSelo}>Plano Grátis</Text>
            <Text style={estilos.premiumTitulo}>Mais pets, PDF e QR da coleira</Text>
            <Tocavel
              accessibilityRole="button"
              onPress={() =>
                Alert.alert('Premium', 'O Premium chega na próxima fase do PetLive. Avisaremos você por aqui.')
              }
              style={estilos.premiumBotao}
            >
              <Text style={estilos.premiumBotaoTexto}>Conhecer o Premium</Text>
            </Tocavel>
          </View>

          <View style={estilos.atalhos}>
            <Tocavel accessibilityRole="button" onPress={() => router.push('/avisos')} estiloExterno={estilos.flex1} style={estilos.atalho}>
              <View style={[estilos.atalhoIcone, { backgroundColor: colors.hero }]}>
                <Icone nome="sino" />
              </View>
              <Text style={estilos.atalhoTexto}>Avisos</Text>
            </Tocavel>
            <Tocavel accessibilityRole="button" onPress={() => router.push('/privacidade')} estiloExterno={estilos.flex1} style={estilos.atalho}>
              <View style={[estilos.atalhoIcone, { backgroundColor: colors.successSurface }]}>
                <Icone nome="escudo" />
              </View>
              <Text style={estilos.atalhoTexto}>Privacidade</Text>
            </Tocavel>
          </View>

          <Pressable accessibilityRole="button" onPress={sair} hitSlop={12} style={estilos.sair}>
            <Text style={estilos.sairTexto}>Sair</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Editar nome */}
      <Modal visible={editando} animationType="slide" transparent onRequestClose={() => setEditando(false)}>
        <View style={estilos.fundoModal}>
          <View style={estilos.cartaoModal}>
            <Text style={estilos.tituloModal}>Meus dados</Text>
            <Campo
              rotulo="Como você quer ser chamado"
              variante="azul"
              autoCapitalize="words"
              returnKeyType="done"
              value={nomeEdicao}
              onChangeText={setNomeEdicao}
              editable={!salvando}
            />
            <BotaoPrimario
              titulo="Salvar"
              carregando={salvando}
              desabilitado={!nomeEdicao.trim() || salvando}
              onPress={salvarNome}
            />
            <Pressable accessibilityRole="button" onPress={() => setEditando(false)} hitSlop={8} disabled={salvando}>
              <Text style={estilos.fecharModal}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingBottom: 120 },
  pataHeroi: { position: 'absolute', right: 24, top: 48 },
  identidade: { position: 'absolute', left: 24, right: 24, top: 56 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetra: { fontSize: 34, fontFamily: typography.h3.fontFamily, color: colors.black },
  nome: {
    marginTop: 10,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.black,
  },
  cidade: {
    position: 'absolute',
    left: 24,
    top: 198,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
  },
  cidadeTexto: { fontSize: 12, fontFamily: typography.label.fontFamily, color: colors.black },
  corpo: { paddingHorizontal: 24, gap: 12 },
  secao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  secaoTitulo: { fontSize: 16, fontFamily: typography.h1.fontFamily, color: colors.black },
  secaoAcao: { fontSize: 12, fontFamily: typography.small.fontFamily, color: '#6A7484' },
  pets: { flexDirection: 'row', gap: 10 },
  petSurgir: { flex: 1 },
  pet: {
    flex: 1,
    height: 128,
    borderRadius: 28,
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingLeft: 14,
    paddingTop: 12,
  },
  petNome: { fontSize: 18, lineHeight: 22, fontFamily: typography.h1.fontFamily, color: colors.black },
  petRaca: { fontSize: 11, fontFamily: typography.captionMedium.fontFamily },
  petRetrato: { position: 'absolute', right: 6, bottom: -6 },
  petFoto: { width: 70, height: 70, borderRadius: 35, marginBottom: 16, marginRight: 8 },
  petNovo: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 0,
    paddingTop: 0,
  },
  petNovoTexto: { fontSize: 14, fontFamily: typography.captionMedium.fontFamily, color: colors.textMuted },
  premium: {
    backgroundColor: colors.black,
    borderRadius: 30,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 8,
    overflow: 'hidden',
  },
  pataPremium: { position: 'absolute', right: -8, bottom: -10 },
  premiumSelo: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontFamily: typography.h1.fontFamily,
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumTitulo: {
    maxWidth: 230,
    fontSize: 21,
    lineHeight: 25,
    fontFamily: typography.h3.fontFamily,
    color: colors.white,
  },
  premiumBotao: {
    alignSelf: 'flex-start',
    marginTop: 4,
    height: 42,
    paddingHorizontal: 20,
    borderRadius: 21,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  premiumBotaoTexto: { fontSize: 14, fontFamily: typography.h1.fontFamily, color: colors.black },
  atalhos: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  atalho: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 12,
  },
  atalhoIcone: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  atalhoTexto: { fontSize: 14, fontFamily: typography.label.fontFamily, color: colors.black },
  sair: { alignSelf: 'center', paddingVertical: 6 },
  sairTexto: { fontSize: 13, fontFamily: typography.label.fontFamily, color: '#6A7484' },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  cartaoModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  tituloModal: { ...typography.h2, color: colors.text },
  fecharModal: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm },
});
