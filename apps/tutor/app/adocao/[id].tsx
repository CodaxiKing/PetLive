import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { idadeAdocao, type DetalheAdocao } from '../../src/adocao/modelo';
import { carregarDetalheAdocao, enviarInteresseAdocao, favoritarAdocao } from '../../src/adocao/repositorio';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function FichaAdocao() {
  const { user, carregando } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!user) return <Redirect href="/welcome" />;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return <View style={s.tela}><CabecalhoTela titulo="Adoção" /><Text style={s.texto}>Este link de adoção é inválido.</Text></View>;
  }
  return <FichaDaConta key={`${user.id}:${id}`} tutorId={user.id} petId={id} />;
}
function FichaDaConta({ tutorId, petId }: { tutorId: string; petId: string }) {
  const [detalhe, setDetalhe] = useState<DetalheAdocao | null>(null), [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null), [acao, setAcao] = useState<'envio' | 'favorito' | null>(null);
  const [mensagem, setMensagem] = useState(''), [email, setEmail] = useState(''), [concordo, setConcordo] = useState(false);
  const [formulario, setFormulario] = useState(false);
  const epoca = useRef(0), trava = useRef(false);
  const buscar = useCallback(async (inicio: number) => {
    setCarregando(true); setErro(null); setDetalhe(null); setFormulario(false);
    try { const d = await carregarDetalheAdocao(tutorId, petId); if (epoca.current === inicio) setDetalhe(d); }
    catch (e) { if (epoca.current === inicio) setErro(e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { if (epoca.current === inicio) setCarregando(false); }
  }, [tutorId, petId]);
  useFocusEffect(useCallback(() => {
    const inicio = ++epoca.current; void buscar(inicio);
    return () => { epoca.current += 1; };
  }, [buscar]));
  async function agir(tipo: 'envio' | 'favorito') {
    if (trava.current || !detalhe) return;
    trava.current = true; const inicio = epoca.current; setAcao(tipo); setErro(null);
    try {
      if (tipo === 'envio') {
        const contato = await enviarInteresseAdocao(tutorId, petId, mensagem, email, concordo);
        if (epoca.current === inicio) { setDetalhe((d) => d && { ...d, contato }); setMensagem(''); setEmail(''); setConcordo(false); setFormulario(false); }
      } else {
        const favorito = await favoritarAdocao(tutorId, petId, !detalhe.pet.favorito);
        if (epoca.current === inicio) setDetalhe((d) => d && { ...d, pet: { ...d.pet, favorito } });
      }
    } catch (e) { if (epoca.current === inicio) setErro(e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { trava.current = false; setAcao(null); }
  }
  const pet = detalhe?.pet;
  return <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <CabecalhoTela titulo="Pet para adoção" />
    <ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
      {carregando ? <ActivityIndicator accessibilityLabel="Carregando ficha de adoção" /> : null}
      {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
      {!carregando && !pet ? <><Text style={s.texto}>{erro ? 'Confira sua conexão e atualize a ficha.' : 'Este pet não está disponível. Ele pode ter sido adotado ou estar aguardando confirmação da ONG.'}</Text><BotaoPrimario titulo="Atualizar ficha" onPress={() => { void buscar(++epoca.current); }} /></> : null}
      {pet ? <>
        <Text style={s.titulo}>{pet.nome}</Text>
        <Text style={s.texto}>{pet.especie === 'cao' ? 'Cão' : 'Gato'} · {idadeAdocao(pet.nascimento)} · Porte {pet.porte} · {pet.sexo === 'femea' ? 'Fêmea' : pet.sexo === 'macho' ? 'Macho' : 'Sexo não informado'}</Text>
        {pet.fotos.length ? pet.fotos.map((uri, i) => <Foto key={uri} uri={uri} rotulo={`Foto ${i + 1} de ${pet.nome}`} />) : <Text style={s.texto}>A ONG ainda não disponibilizou fotos.</Text>}
        <View style={s.card}><Text style={s.subtitulo}>{pet.ong_nome} · ONG verificada</Text><Text style={s.texto}>{pet.bairro}, {pet.cidade}</Text><Text style={s.texto}>{pet.descricao}</Text>
          <Text style={s.texto}>{[['Castrado', pet.castrado], ['Vacinado', pet.vacinado], ['Vermifugado', pet.vermifugado]].map(([rotulo, valor]) => `${rotulo}: ${valor === null ? 'não informado' : valor ? 'sim' : 'não'}`).join('\n')}</Text>
          <Text style={s.texto}>Informações fornecidas pela ONG. Confirme os cuidados e os critérios de adoção com ela.</Text></View>
        <BotaoPrimario titulo={pet.favorito ? 'Remover favorito' : 'Favoritar'} carregando={acao === 'favorito'} desabilitado={acao !== null} onPress={() => { void agir('favorito'); }} />
        {detalhe?.contato ? <View style={s.card}><Text accessibilityRole="alert" style={s.subtitulo}>Interesse registrado</Text><Text style={s.texto}>Registrado em {new Date(detalhe.contato.criado_em).toLocaleDateString('pt-BR')}. A ONG responsável pode consultar sua mensagem e responder pelo e-mail informado. Isso não reserva o pet nem garante uma resposta ou a adoção.</Text></View>
          : !formulario ? <BotaoPrimario titulo="Tenho interesse" desabilitado={acao !== null} onPress={() => setFormulario(true)} />
            : <View style={s.card}><Text style={s.subtitulo}>Conte um pouco sobre você</Text>
              <Text style={s.texto}>Sua mensagem e o e-mail abaixo serão compartilhados com {pet.ong_nome}, responsável por este pet. O PetLive registra o interesse; a ONG conduz a adoção e responde pelo e-mail informado.</Text>
              <Text style={s.subtitulo}>E-mail para resposta</Text><TextInput accessibilityLabel="E-mail para resposta da ONG" style={s.campo} value={email} onChangeText={setEmail} editable={acao === null} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Text style={s.subtitulo}>Mensagem</Text><TextInput accessibilityLabel="Mensagem de interesse na adoção" style={[s.campo, s.mensagem]} value={mensagem} onChangeText={setMensagem} editable={acao === null} multiline maxLength={1000} textAlignVertical="top" placeholder="Como seria a rotina deste pet com você?" placeholderTextColor={colors.textMuted} /><Text style={s.texto}>{mensagem.trim().length}/1000 · mínimo de 10 caracteres</Text>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: concordo, disabled: acao !== null }} disabled={acao !== null} style={s.consentimento} onPress={() => setConcordo(!concordo)}><Text style={s.texto}>{concordo ? '☑' : '☐'} Concordo em compartilhar esta mensagem e meu e-mail com a ONG responsável.</Text></Pressable>
              {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
              <BotaoPrimario titulo="Enviar interesse" desabilitado={!concordo || acao !== null} carregando={acao === 'envio'} onPress={() => { void agir('envio'); }} />
              <Pressable accessibilityRole="button" disabled={acao !== null} onPress={() => { setFormulario(false); setConcordo(false); }} style={s.consentimento}><Text style={s.texto}>Cancelar</Text></Pressable>
            </View>}
        {erro ? <BotaoPrimario titulo="Conferir ficha atualizada" desabilitado={acao !== null} onPress={() => { void buscar(++epoca.current); }} /> : null}
      </> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}
function Foto({ uri, rotulo }: { uri: string; rotulo: string }) {
  const [falhou, setFalhou] = useState(false);
  return falhou ? <View style={[s.foto, s.semFoto]}><Text style={s.texto}>Foto não disponível</Text></View> : <Image source={{ uri }} accessibilityLabel={rotulo} style={s.foto} resizeMode="cover" onError={() => setFalhou(true)} />;
}
const s = StyleSheet.create({ tela: { flex: 1, backgroundColor: colors.background }, conteudo: { paddingHorizontal: 24, paddingBottom: 48, gap: 18 },
  titulo: { ...typography.h2, color: colors.black }, subtitulo: { ...typography.h3, color: colors.black }, texto: { ...typography.body, color: colors.textMuted }, erro: { ...typography.body, color: colors.danger },
  card: { padding: 18, borderRadius: 24, backgroundColor: colors.surface, gap: 14 }, foto: { width: '100%', height: 280, borderRadius: 24, backgroundColor: colors.hero }, semFoto: { alignItems: 'center', justifyContent: 'center' },
  campo: { ...typography.body, color: colors.black, minHeight: 48, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border }, mensagem: { minHeight: 130 }, consentimento: { minHeight: 48, justifyContent: 'center', paddingVertical: 10 } });
