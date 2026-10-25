import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { MarcaPata } from '../../src/components/MarcaPata';
import { Mascote } from '../../src/components/Mascote';
import { limparCacheOffline } from '../../src/lib/cacheOffline';
import { mascaraTelefone } from '../../src/lib/mascaras';
import { useEstadoPlano } from '../../src/lib/plano';
import { supabase } from '../../src/lib/supabase';
import { useLembretes } from '../../src/lembretes/LembretesProvider';
import { pushDisponivel, registroPush } from '../../src/notificacoes/push';
import { useCidade } from '../../src/mapa/useCidade';
import { coresDoPet } from '../../src/pets/coresPet';
import { usePets } from '../../src/pets/PetsProvider';
import { urlFotoPerfil } from '../../src/perfil/foto';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

function fimDeHoje(): number {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return fim.getTime();
}

/**
 * Perfil do tutor (protótipo Perfil; board P1 "Perfil do tutor e sair da
 * conta"): avatar, nome e cidade com o lápis de editar; números do tutor;
 * os pets; o convite do Premium; e a lista Notificações, Privacidade e Sair.
 */
export default function Perfil() {
  const router = useRouter();
  const { user } = useAuth();
  const plano = useEstadoPlano();
  const { pets, definirPetAtivo } = usePets();

  const [nome, setNome] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [telefone, setTelefone] = useState<string | null>(null);
  const [cidadePerfil, setCidadePerfil] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [salvos, setSalvos] = useState<number | null>(null);
  const [limiteHoje] = useState(fimDeHoje);
  const { lembretes } = useLembretes();
  const cidade = useCidade();
  const lembretesHoje = lembretes.filter((l) => new Date(l.proxima_em).getTime() <= limiteHoje).length;

  useEffect(() => {
    supabase
      .from('saved_places')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setSalvos(count ?? 0));
  }, []);

  // Recarrega ao voltar de Meus dados.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      supabase
        .from('profiles')
        .select('nome, telefone, cidade, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          setNome(data?.nome ?? null);
          setTelefone(data?.telefone ?? null);
          setCidadePerfil(data?.cidade ?? null);
          urlFotoPerfil(data?.avatar_url).then(setFotoUrl);
        });
    }, [user]),
  );

  const nomeExibido =
    nome?.trim() ||
    (typeof user?.user_metadata?.nome === 'string' && user.user_metadata.nome.trim()) ||
    (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
    user?.email ||
    'Tutor PetLive';
  const inicial = nomeExibido.trim().charAt(0).toUpperCase();

  async function sair() {
    if (saindo || !user) return;
    setSaindo(true);
    try {
      if (pushDisponivel()) await registroPush.prepararSaida(user.id);
      // Dados de saúde guardados para uso sem internet saem junto com a conta.
      await limparCacheOffline();
      const { error } = await supabase.auth.signOut();
      if (error) {
        registroPush.retomar();
        Alert.alert('Não foi possível sair', error.message);
        return;
      }
      // Sem sessão o layout raiz volta para as boas-vindas.
      router.replace('/welcome');
    } catch {
      registroPush.retomar();
      Alert.alert('Não foi possível sair', 'Confira sua conexão e tente novamente para desativar os avisos deste aparelho.');
    } finally {
      setSaindo(false);
    }
  }

  const numeros = [
    { valor: pets.length, rotulo: pets.length === 1 ? 'Pet' : 'Pets', fundo: colors.premiumSurface, cor: colors.premiumText },
    { valor: lembretesHoje, rotulo: 'Lembretes hoje', fundo: '#FFF0C9', cor: '#8A6414' },
    { valor: salvos ?? '–', rotulo: 'Lugares salvos', fundo: colors.successSurface, cor: '#1F6B45' },
  ];

  const linhas: { rotulo: string; icone: NomeIcone; fundo: string; acao: () => void; perigo?: boolean }[] = [
    { rotulo: 'Editar perfil', icone: 'pessoas', fundo: '#FFF0C9', acao: () => router.push('/meus-dados') },
    { rotulo: 'Minha assinatura', icone: 'documento', fundo: colors.premiumSurface, acao: () => router.push('/premium/assinatura') },
    { rotulo: 'Notificações', icone: 'sino', fundo: colors.hero, acao: () => router.push('/avisos') },
    { rotulo: 'Guarda compartilhada', icone: 'pessoas', fundo: colors.primarySurface, acao: () => router.push('/guarda') },
    { rotulo: 'Meus eventos', icone: 'local', fundo: colors.hero, acao: () => router.push('/eventos/meus') },
    { rotulo: 'Privacidade e dados', icone: 'escudo', fundo: colors.successSurface, acao: () => router.push('/privacidade') },
    { rotulo: 'Sair', icone: 'sair', fundo: '#FBDADF', acao: sair, perigo: true },
  ];

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <HeroiOnda titulo="" semVoltar altura={206}>
          <MarcaPata size={130} style={estilos.pataHeroi} />
          <View style={estilos.identidade}>
            <Tocavel accessibilityRole="button" accessibilityLabel="Editar perfil" onPress={() => router.push('/meus-dados')} style={estilos.avatar}>
              {fotoUrl ? <Image source={{ uri: fotoUrl }} style={estilos.avatarFoto} /> : <Text style={estilos.avatarLetra}>{inicial}</Text>}
            </Tocavel>
            <View style={estilos.flex1}>
              <Text style={estilos.nome} numberOfLines={1}>
                {nomeExibido}
              </Text>
              <View style={estilos.cidade}>
                <Icone nome="local" size={12} espessura={2.2} />
                <Text style={estilos.cidadeTexto} numberOfLines={1}>
                  {[cidadePerfil || cidade, telefone ? mascaraTelefone(telefone) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel="Editar perfil"
              onPress={() => router.push('/meus-dados')}
              style={estilos.editar}
            >
              <Icone nome="lapis" size={18} cor={colors.white} />
            </Tocavel>
          </View>
        </HeroiOnda>

        <View style={estilos.corpo}>
          {/* Sem celular: a clínica, o hotel e o cuidador não têm como falar com o tutor. */}
          {nome !== null && !telefone ? (
            <Tocavel accessibilityRole="button" onPress={() => router.push('/meus-dados')} style={estilos.semCelular}>
              <Icone nome="telefone" size={20} />
              <View style={estilos.flex1}>
                <Text style={estilos.semCelularTitulo}>Adicione seu celular</Text>
                <Text style={estilos.semCelularTexto}>Para a clínica e o cuidador falarem com você pela carteirinha.</Text>
              </View>
            </Tocavel>
          ) : null}
          <Surgir indice={0} style={estilos.numeros}>
            {numeros.map((n) => (
              <View key={n.rotulo} style={[estilos.numero, { backgroundColor: n.fundo }]}>
                <Text style={estilos.numeroValor}>{n.valor}</Text>
                <Text style={[estilos.numeroRotulo, { color: n.cor }]} numberOfLines={1}>
                  {n.rotulo}
                </Text>
              </View>
            ))}
          </Surgir>

          <View style={estilos.secao}>
            <Text style={estilos.secaoTitulo}>Meus pets</Text>
            <Pressable accessibilityRole="link" onPress={() => router.navigate('/pets')} hitSlop={8}>
              <Text style={estilos.secaoAcao}>Ver todos ›</Text>
            </Pressable>
          </View>

          <View style={estilos.pets}>
            {pets.slice(0, 2).map((pet, indice) => {
              const cores = coresDoPet(pet, indice);
              return (
                <Surgir key={pet.id} indice={indice + 1} style={estilos.flex1}>
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
                        <Mascote especie={pet.especie} size={74} recorte />
                      )}
                    </View>
                  </Tocavel>
                </Surgir>
              );
            })}
            <Surgir indice={3} style={estilos.flex1}>
              <Tocavel
                accessibilityRole="button"
                accessibilityLabel="Novo pet"
                onPress={() => router.push('/pet/novo')}
                style={[estilos.pet, estilos.petNovo]}
              >
                <View style={estilos.petNovoMais}>
                  <Icone nome="cruz" size={16} cor={colors.white} espessura={2.6} />
                </View>
                <Text style={estilos.petNovoTexto}>Novo pet</Text>
              </Tocavel>
            </Surgir>
          </View>

          <Tocavel
            accessibilityRole="button"
            accessibilityLabel="Consultar plano e conhecer o Premium"
            onPress={() => router.push('/premium')}
            escala={0.98}
            style={estilos.premium}
          >
            <View style={estilos.flex1}>
              <Text style={estilos.premiumSelo}>{plano.carregando ? 'Consultando plano…' : plano.erro ? 'Consultar meu plano' : plano.plano === 'premium' ? 'Plano Premium' : 'Plano Grátis'}</Text>
              <Text style={estilos.premiumTitulo}>Mais pets e carteirinha em PDF</Text>
            </View>
            <View style={estilos.premiumBotao}>
              <Text style={estilos.premiumBotaoTexto}>Premium</Text>
            </View>
          </Tocavel>

          <Surgir indice={4} style={estilos.lista}>
            {linhas.map((linha, i) => (
              <Pressable
                key={linha.rotulo}
                accessibilityRole="button"
                onPress={linha.acao}
                style={({ pressed }) => [estilos.linha, i > 0 && estilos.linhaDivisoria, pressed && { opacity: 0.6 }]}
              >
                <View style={[estilos.linhaIcone, { backgroundColor: linha.fundo }]}>
                  <Icone nome={linha.icone} size={17} cor={linha.perigo ? '#B3173A' : colors.black} />
                </View>
                <Text style={[estilos.linhaTexto, linha.perigo && estilos.linhaPerigo]}>{linha.rotulo}</Text>
                {linha.perigo ? null : <Icone nome="seta" size={16} cor={colors.textMuted} espessura={2} />}
              </Pressable>
            ))}
          </Surgir>
        </View>
      </ScrollView>

    </View>
  );
}

const estilos = StyleSheet.create({
  semCelular: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FFF0C9', borderRadius: 24, padding: 16, marginBottom: 12 },
  semCelularTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: '#4A3800' },
  semCelularTexto: { fontFamily: fontFamily.regular, fontSize: 13, color: '#8A6414' },
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingBottom: 120 },
  pataHeroi: { position: 'absolute', right: 6, top: 44 },
  identidade: { position: 'absolute', left: 24, right: 24, top: 52, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFoto: { width: 76, height: 76, borderRadius: 38 },
  avatarLetra: { fontSize: 32, fontFamily: fontFamily.semiBold, color: colors.black },
  // Deixa a fonte calcular a altura: lineHeight apertado corta descendentes no Android.
  nome: { fontSize: 32, paddingBottom: 4, letterSpacing: -1, fontFamily: fontFamily.medium, color: colors.black },
  cidade: {
    alignSelf: 'flex-start',
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 4,
  },
  cidadeTexto: { fontSize: 12, fontFamily: fontFamily.semiBold, color: colors.black },
  editar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
  },
  corpo: { paddingHorizontal: 24, gap: 12 },
  numeros: { flexDirection: 'row', gap: 8 },
  numero: { flex: 1, minWidth: 0, borderRadius: 22, paddingVertical: 10, alignItems: 'center' },
  numeroValor: { fontSize: 20, lineHeight: 22, fontFamily: fontFamily.extraBold, color: colors.black },
  numeroRotulo: { fontSize: 11, fontFamily: fontFamily.semiBold },
  secao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  secaoTitulo: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  secaoAcao: { fontSize: 12, fontFamily: fontFamily.semiBold, color: colors.textMuted },
  pets: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1, minWidth: 0 },
  pet: {
    height: 104,
    borderRadius: 26,
    borderWidth: 1.5,
    overflow: 'hidden',
    paddingLeft: 12,
    paddingTop: 10,
  },
  petNome: { fontSize: 15, lineHeight: 19, fontFamily: fontFamily.bold, color: colors.black },
  petRaca: { fontSize: 10, fontFamily: fontFamily.medium },
  petRetrato: { position: 'absolute', right: 4, bottom: -6 },
  petFoto: { width: 54, height: 54, borderRadius: 27, marginBottom: 12, marginRight: 6 },
  petNovo: {
    backgroundColor: colors.surface,
    borderColor: '#B8C0CC',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingLeft: 0,
    paddingTop: 0,
  },
  petNovoMais: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petNovoTexto: { fontSize: 12, fontFamily: fontFamily.bold, color: '#3C4655' },
  premium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.black,
    borderRadius: 28,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 20,
  },
  premiumSelo: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  premiumTitulo: { marginTop: 6, fontSize: 15, lineHeight: 19, fontFamily: fontFamily.semiBold, color: colors.white },
  premiumBotao: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
  },
  premiumBotaoTexto: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.black },
  lista: { backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 48, paddingLeft: 8, paddingRight: 14 },
  linhaDivisoria: { borderTopWidth: 1, borderTopColor: colors.border },
  linhaIcone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  linhaTexto: { flex: 1, fontSize: 14, fontFamily: fontFamily.semiBold, color: colors.black },
  linhaPerigo: { color: '#B3173A' },
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
