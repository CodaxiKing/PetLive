import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { conferirAcao, guardarAcao, type AcaoRapida } from '../src/atalhos/acoes';
import { BotaoPrimario } from '../src/components/BotaoPrimario';
import { CabecalhoTela } from '../src/components/CabecalhoTela';
import { usePets } from '../src/pets/PetsProvider';
import { colors } from '../src/theme/colors';
import { typography } from '../src/theme/typography';

export default function TelaAcaoRapida() {
  const { acao: valor } = useLocalSearchParams<{ acao?: string }>();
  const acao = conferirAcao(valor);
  const { user, carregando } = useAuth();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!acao) return <Redirect href="/atalhos" />;
  if (!user) return <View style={s.tela}><CabecalhoTela titulo="Atalho do PetLive" /><View style={s.conteudo}>
    <Text style={s.titulo}>Entre para continuar</Text><Text style={s.texto}>Acesse sua conta para {acao === 'sos' ? 'abrir o SOS' : acao === 'peso' ? 'registrar o peso do seu pet' : 'iniciar um passeio'}.</Text>
    <BotaoPrimario titulo="Entrar na minha conta" onPress={() => { guardarAcao(acao); router.push({ pathname: '/criar-conta', params: { modo: 'entrar' } }); }} />
  </View></View>;
  return <AcaoDaConta key={user.id} acao={acao} tutorId={user.id} />;
}
function AcaoDaConta({ acao, tutorId }: { acao: AcaoRapida; tutorId: string }) {
  const { pets, carregando, erro, recarregar } = usePets();
  if (acao === 'sos') return <Redirect href="/sos" />;
  if (acao === 'passeio') return <Redirect href="/passeios" />;
  const meus = pets.filter((p) => p.tutor_id === tutorId && p.ativo && !p.em_memoria);
  return <View style={s.tela}><CabecalhoTela titulo="Registrar peso" /><ScrollView contentContainerStyle={s.conteudo}>
    <Text style={s.titulo}>Qual pet você vai pesar?</Text>
    {carregando ? <ActivityIndicator accessibilityLabel="Carregando pets" /> : erro ? <>
      <Text accessibilityRole="alert" style={s.texto}>{erro}</Text><BotaoPrimario titulo="Tentar carregar pets" onPress={() => { void recarregar(); }} />
    </> : meus.length ? meus.map((p) => <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={`Registrar peso de ${p.nome}`} style={s.pet}
      onPress={() => router.replace({ pathname: '/pet/[id]/peso', params: { id: p.id } })}><Text style={s.titulo}>{p.nome}</Text><Text style={s.texto}>Abrir registro de peso →</Text></Pressable>) : <>
      <Text style={s.texto}>Cadastre um pet na sua conta para acompanhar o peso.</Text><BotaoPrimario titulo="Cadastrar meu pet" onPress={() => router.replace('/pet/novo')} />
    </>}
  </ScrollView></View>;
}
const s = StyleSheet.create({ tela: { flex: 1, backgroundColor: colors.background }, conteudo: { padding: 24, gap: 18 },
  titulo: { ...typography.h3, color: colors.black }, texto: { ...typography.body, color: colors.textMuted },
  pet: { minHeight: 80, padding: 18, gap: 6, borderRadius: 24, backgroundColor: colors.surface } });
