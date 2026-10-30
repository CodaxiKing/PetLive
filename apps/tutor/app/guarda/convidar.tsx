import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { convidar, linkConvite, nomesPets } from '../../src/guarda/guarda';
import { mensagemDeErro } from '../../src/lib/cacheOffline';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

/** Convidar pessoa para a guarda, com um ou mais pets (protótipo GuardaConvidar, tela 102). */
export default function ConvidarGuarda() {
  const { user } = useAuth();
  const { pets } = usePets();
  // Só os pets de que a pessoa é titular podem ser divididos.
  const meus = pets.filter((p) => p.tutor_id === user?.id);
  const [email, setEmail] = useState('');
  const [escolhidos, setEscolhidos] = useState<string[]>(() => meus.map((p) => p.id));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (id: string) => setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  async function enviar() {
    setErro(null);
    if (!email.includes('@')) {
      setErro('Digite o e-mail da pessoa.');
      return;
    }
    if (escolhidos.length === 0) {
      setErro('Escolha pelo menos um pet.');
      return;
    }
    setEnviando(true);
    try {
      const convite = await convidar(escolhidos, email);
      const nomes = nomesPets(meus.filter((p) => escolhidos.includes(p.id)));
      const link = linkConvite(convite.token);
      const mensagem = `Quero dividir os cuidados de ${nomes} com você no PetLive. Aceite o convite: ${link}`;
      Alert.alert(
        'Convite enviado',
        convite.tem_conta
          ? `${email.trim()} recebeu o convite no app. Você também pode mandar o link por mensagem.`
          : `${email.trim()} ainda não tem o PetLive. Mande o link do convite para a pessoa criar a conta e aceitar.`,
        [
          { text: 'Pronto', style: 'cancel', onPress: () => router.back() },
          { text: 'Mandar o link', onPress: () => Share.share({ message: mensagem }).finally(() => router.back()) },
        ],
      );
    } catch (e) {
      setErro(mensagemDeErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Guarda compartilhada" titulo="Convidar pessoa" altura={196} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Campo
          rotulo="E-mail da pessoa"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          maxLength={254}
        />

        <Text style={estilos.secao}>
          Quais pets? <Text style={estilos.secaoSub}>Escolha um ou mais</Text>
        </Text>
        {meus.length === 0 ? <Text style={estilos.nota}>Você ainda não é titular de nenhum pet.</Text> : null}
        {meus.map((p) => {
          const marcado = escolhidos.includes(p.id);
          return (
            <Tocavel
              key={p.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcado }}
              onPress={() => alternar(p.id)}
              style={[estilos.pet, marcado && estilos.petMarcado]}
            >
              <AvatarPet especie={p.especie} foto={p.foto_url} size={48} />
              <View style={estilos.flex}>
                <Text style={estilos.petNome}>{p.nome}</Text>
                <Text style={estilos.petSub}>{p.especie === 'gato' ? 'Gato' : 'Cão'}</Text>
              </View>
              <View style={[estilos.check, marcado && estilos.checkMarcado]}>
                {marcado ? <Icone nome="check" size={14} cor={colors.white} espessura={3} /> : null}
              </View>
            </Tocavel>
          );
        })}

        <View style={estilos.regras}>
          <View style={[estilos.regra, estilos.regraPode]}>
            <Text style={[estilos.regraTitulo, estilos.textoOk]}>Pode</Text>
            <Text style={[estilos.regraTexto, estilos.textoOk]}>Ver e atualizar vacinas, remédios e doses, peso, consultas e lembretes</Text>
          </View>
          <View style={[estilos.regra, estilos.regraNao]}>
            <Text style={estilos.regraTitulo}>Não pode</Text>
            <Text style={estilos.regraTexto}>Apagar o pet, convidar pessoas, ver seu contato e pagamentos</Text>
          </View>
        </View>

        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        <Text style={estilos.nota}>A pessoa recebe o convite no app. O acesso só começa quando ela aceitar. O convite vale 7 dias.</Text>
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Enviar convite" carregando={enviando} desabilitado={meus.length === 0} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 4 },
  secaoSub: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.textMuted },
  pet: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white,
    borderWidth: 2, borderColor: colors.border, borderRadius: 24, paddingVertical: 10, paddingLeft: 10, paddingRight: 14,
  },
  petMarcado: { borderColor: colors.black },
  petNome: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  petSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkMarcado: { backgroundColor: colors.black, borderColor: colors.black },
  regras: { flexDirection: 'row', gap: 8 },
  regra: { flex: 1, borderRadius: 22, padding: 12, gap: 2 },
  regraPode: { backgroundColor: colors.successSurface },
  regraNao: { backgroundColor: colors.surface },
  regraTitulo: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  regraTexto: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted },
  textoOk: { color: colors.successText },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
