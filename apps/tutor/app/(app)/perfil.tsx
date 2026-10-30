import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CrownSimple } from 'phosphor-react-native/src/icons/CrownSimple';
import { useAuth } from '../../src/auth/AuthProvider';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { Icone, type NomeIcone } from '../../src/components/Icone';
import { limparCacheOffline } from '../../src/lib/cacheOffline';
import { mascaraTelefone } from '../../src/lib/mascaras';
import { useRecurso } from '../../src/lib/configApp';
import { useEstadoPlano } from '../../src/lib/plano';
import { supabase } from '../../src/lib/supabase';
import { useLembretes } from '../../src/lembretes/LembretesProvider';
import { pushDisponivel, registroPush } from '../../src/notificacoes/push';
import { useCidade } from '../../src/mapa/useCidade';
import { usePets } from '../../src/pets/PetsProvider';
import { urlFotoPerfil } from '../../src/perfil/foto';
import { colors } from '../../src/theme/colors';
import { shadow } from '../../src/theme/tokens';
import { fontFamily } from '../../src/theme/typography';

function fimDeHoje(): number {
  const fim = new Date();
  fim.setHours(23, 59, 59, 999);
  return fim.getTime();
}

/**
 * Perfil do tutor (versão 2 do protótipo, Perfil): avatar, nome e cidade com
 * o lápis de editar; os números do tutor em cartões; o cartão do Premium; a
 * lista Conta e "Sair da conta". Os pets ficam na aba Pets.
 */
export default function Perfil() {
  // Comunidade só abre depois do gate de retenção (BUSINESS.md 5.28): a equipe liga em Sistema.
  const comunidade = useRecurso('comunidade', false);
  const router = useRouter();
  const { user } = useAuth();
  const plano = useEstadoPlano();
  const { pets } = usePets();

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
    { valor: pets.length, rotulo: pets.length === 1 ? 'pet' : 'pets' },
    { valor: lembretesHoje, rotulo: 'lembretes hoje' },
    { valor: salvos ?? '–', rotulo: 'lugares salvos' },
  ];

  const linhas: { rotulo: string; icone: NomeIcone; acao: () => void }[] = [
    { rotulo: 'Editar perfil', icone: 'pessoas', acao: () => router.push('/meus-dados') },
    { rotulo: 'Minha assinatura', icone: 'documento', acao: () => router.push('/premium/assinatura') },
    { rotulo: 'Notificações', icone: 'sino', acao: () => router.push('/avisos') },
    { rotulo: 'Guarda compartilhada', icone: 'pessoas', acao: () => router.push('/guarda') },
    ...(comunidade ? [{ rotulo: 'Comunidade', icone: 'coracao' as const, acao: () => router.push('/comunidade') }] : []),
    { rotulo: 'Minhas solicitações', icone: 'sacola', acao: () => router.push('/pedidos') },
    { rotulo: 'Meus eventos', icone: 'local', acao: () => router.push('/eventos/meus') },
    { rotulo: 'Plano e seguro pet', icone: 'escudo', acao: () => router.push('/parceiros/seguro') },
    { rotulo: 'Privacidade e dados', icone: 'escudo', acao: () => router.push('/privacidade') },
  ];

  const textoPlano = plano.carregando
    ? 'Consultando seu plano…'
    : plano.erro
      ? 'Toque para consultar seu plano'
      : plano.plano === 'premium'
        ? 'Seu plano é Premium'
        : 'Pets ilimitados, PDF e guarda compartilhada';

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.identidade}>
          <Tocavel accessibilityRole="button" accessibilityLabel="Editar perfil" onPress={() => router.push('/meus-dados')} style={estilos.avatar}>
            {fotoUrl ? <Image source={{ uri: fotoUrl }} style={estilos.avatarFoto} /> : <Text style={estilos.avatarLetra}>{inicial}</Text>}
          </Tocavel>
          <View style={estilos.flex1}>
            <Text style={estilos.nome} numberOfLines={1} accessibilityRole="header">
              {nomeExibido}
            </Text>
            <Text style={estilos.cidadeTexto} numberOfLines={1}>
              {[cidadePerfil || cidade, telefone ? mascaraTelefone(telefone) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Tocavel
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
            onPress={() => router.push('/meus-dados')}
            style={estilos.editar}
          >
            <Icone nome="lapis" size={20} />
          </Tocavel>
        </View>

        <View style={estilos.corpo}>
          {/* Sem celular: a clínica, o hotel e o cuidador não têm como falar com o tutor. */}
          {nome !== null && !telefone ? (
            <Tocavel accessibilityRole="button" onPress={() => router.push('/meus-dados')} style={estilos.semCelular}>
              <Icone nome="telefone" size={20} cor={colors.warningText} />
              <View style={estilos.flex1}>
                <Text style={estilos.semCelularTitulo}>Adicione seu celular</Text>
                <Text style={estilos.semCelularTexto}>Para a clínica e o cuidador falarem com você pela carteirinha.</Text>
              </View>
            </Tocavel>
          ) : null}

          <Surgir indice={0} style={estilos.numeros}>
            {numeros.map((n) => (
              <View key={n.rotulo} style={estilos.numero}>
                <Text style={estilos.numeroValor}>{n.valor}</Text>
                <Text style={estilos.numeroRotulo} numberOfLines={1}>
                  {n.rotulo}
                </Text>
              </View>
            ))}
          </Surgir>

          <Surgir indice={1}>
            <Tocavel
              accessibilityRole="button"
              accessibilityLabel="Consultar plano e conhecer o Premium"
              onPress={() => router.push('/premium')}
              escala={0.98}
              style={estilos.premium}
            >
              <View style={estilos.premiumIcone}>
                <CrownSimple size={22} color={colors.premiumText} weight="fill" />
              </View>
              <View style={estilos.flex1}>
                <Text style={estilos.premiumTitulo}>PetLive Premium</Text>
                <Text style={estilos.premiumTexto} numberOfLines={2}>{textoPlano}</Text>
              </View>
              <Icone nome="seta" size={18} cor={colors.premiumText} />
            </Tocavel>
          </Surgir>

          <Text style={estilos.secaoTitulo}>Conta</Text>
          <Surgir indice={2} style={estilos.lista}>
            {linhas.map((linha, i) => (
              <Pressable
                key={linha.rotulo}
                accessibilityRole="button"
                onPress={linha.acao}
                style={({ pressed }) => [estilos.linha, i > 0 && estilos.linhaDivisoria, pressed && { opacity: 0.6 }]}
              >
                <View style={estilos.linhaIcone}>
                  <Icone nome={linha.icone} size={20} cor={colors.textMuted} />
                </View>
                <Text style={estilos.linhaTexto}>{linha.rotulo}</Text>
                <Icone nome="seta" size={18} cor={colors.textMuted} />
              </Pressable>
            ))}
          </Surgir>

          <Pressable
            accessibilityRole="button"
            disabled={saindo}
            onPress={sair}
            hitSlop={8}
            style={({ pressed }) => [estilos.sair, (pressed || saindo) && { opacity: 0.6 }]}
          >
            <Text style={estilos.sairTexto}>{saindo ? 'Saindo…' : 'Sair da conta'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { paddingBottom: 120 },
  flex1: { flex: 1, minWidth: 0 },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 18 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFoto: { width: 64, height: 64, borderRadius: 22 },
  avatarLetra: { fontSize: 28, fontFamily: fontFamily.bold, color: colors.black },
  // Deixa a fonte calcular a altura: lineHeight apertado corta descendentes no Android.
  nome: { fontSize: 26, paddingBottom: 2, letterSpacing: -0.8, fontFamily: fontFamily.bold, color: colors.black },
  cidadeTexto: { fontSize: 14, fontFamily: fontFamily.regular, color: colors.textMuted },
  editar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  corpo: { paddingHorizontal: 20, gap: 12 },
  semCelular: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.warningSurface, borderRadius: 24, padding: 16 },
  semCelularTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  semCelularTexto: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.warningText },
  numeros: { flexDirection: 'row', gap: 10 },
  numero: { flex: 1, minWidth: 0, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 14, backgroundColor: colors.surface, ...shadow.card },
  numeroValor: { fontSize: 24, lineHeight: 28, fontFamily: fontFamily.bold, color: colors.black },
  numeroRotulo: { fontSize: 12, fontFamily: fontFamily.medium, color: colors.textMuted },
  premium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.premiumSurface,
    borderRadius: 24,
    padding: 16,
  },
  premiumIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  premiumTitulo: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.black },
  premiumTexto: { fontSize: 13, lineHeight: 18, fontFamily: fontFamily.regular, color: colors.premiumText },
  secaoTitulo: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.black, marginTop: 14, marginLeft: 4 },
  lista: { backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', ...shadow.card },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16 },
  linhaDivisoria: { borderTopWidth: 1, borderTopColor: colors.border },
  linhaIcone: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  linhaTexto: { flex: 1, fontSize: 15, fontFamily: fontFamily.bold, color: colors.black },
  sair: { alignSelf: 'center', paddingVertical: 14, marginTop: 4 },
  sairTexto: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.healthText },
});
