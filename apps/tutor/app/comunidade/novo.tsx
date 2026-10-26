import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { configurarPerfil, publicar } from '../../src/comunidade/comunidade';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { escolherFoto, type AtivoFoto } from '../../src/pets/CampoFoto';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

/** Novo post na comunidade: pet, foto e legenda. */
export default function NovoPost() {
  const { user } = useAuth();
  const { pets, petAtivo } = usePets();
  const [petId, setPetId] = useState(petAtivo?.id ?? pets[0]?.id ?? '');
  const [foto, setFoto] = useState<AtivoFoto | null>(null);
  const [legenda, setLegenda] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  async function enviar() {
    if (!user || !pet || !foto) return;
    setEnviando(true);
    setErro(null);
    try {
      await publicar(user.id, pet.id, foto, legenda);
      router.back();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('perfil público') && pet.tutor_id === user.id) {
        // Perfil desligado: pergunta antes de tornar o pet visível.
        Alert.alert(`Ligar o perfil público do ${pet.nome}?`, 'Quem tem conta no PetLive passa a ver a foto, a raça, a idade e a cidade do pet, e os posts. Você pode desligar quando quiser.', [
          { text: 'Agora não', style: 'cancel' },
          {
            text: 'Ligar e publicar',
            onPress: () =>
              configurarPerfil(pet.id, true, '', true)
                .then(() => publicar(user.id, pet.id, foto, legenda))
                .then(() => router.back(), (e2: Error) => setErro(e2.message)),
          },
        ]);
      } else {
        setErro(msg);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Comunidade" titulo="Novo post" altura={170} />
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {pets.length > 1 ? (
          <View style={estilos.pets}>
            {pets.map((p) => (
              <Tocavel key={p.id} accessibilityRole="radio" accessibilityState={{ selected: p.id === petId }} onPress={() => setPetId(p.id)} style={[estilos.pet, p.id === petId && estilos.petAtivo]}>
                <AvatarPet especie={p.especie} foto={p.foto_url} size={32} />
                <Text style={[estilos.petNome, p.id === petId && estilos.textoClaro]}>{p.nome}</Text>
              </Tocavel>
            ))}
          </View>
        ) : null}
        <Tocavel accessibilityRole="button" accessibilityLabel="Escolher foto" onPress={() => escolherFoto('galeria', true).then((f) => f && setFoto(f))} style={estilos.moldura}>
          {foto ? (
            <Image source={{ uri: foto.uri }} style={estilos.previa} />
          ) : (
            <>
              <Icone nome="camera" size={30} espessura={1.8} cor={colors.primaryDeep} />
              <Text style={estilos.molduraTexto}>Escolher foto</Text>
            </>
          )}
        </Tocavel>
        <Tocavel accessibilityRole="button" onPress={() => escolherFoto('camera', true).then((f) => f && setFoto(f))} style={estilos.camera}>
          <Text style={estilos.cameraTexto}>Tirar foto agora</Text>
        </Tocavel>
        <View style={estilos.campo}>
          <Text style={estilos.rotulo}>Legenda</Text>
          <TextInput value={legenda} onChangeText={setLegenda} placeholder={`${pet?.nome ?? 'Seu pet'} no parque hoje`} placeholderTextColor={colors.textMuted} multiline maxLength={500} style={estilos.texto} />
        </View>
        <Text style={estilos.nota}>Não publique fotos de pessoas sem autorização nem dados como endereço ou telefone.</Text>
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo="Publicar" carregando={enviando} desabilitado={!foto || !pet} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, height: 42, borderRadius: 21, backgroundColor: colors.background },
  petAtivo: { backgroundColor: colors.black },
  petNome: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  textoClaro: { color: colors.white },
  moldura: {
    aspectRatio: 1, borderRadius: 28, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.borderStrong,
    backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center', gap: 8, overflow: 'hidden',
  },
  previa: { width: '100%', height: '100%' },
  molduraTexto: { fontFamily: fontFamily.semiBold, fontSize: 14, color: colors.primaryDeep },
  camera: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6 },
  cameraTexto: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.primaryDeep },
  campo: { backgroundColor: colors.background, borderRadius: 22, padding: 14, gap: 4 },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 60, textAlignVertical: 'top' },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, paddingHorizontal: 4 },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
