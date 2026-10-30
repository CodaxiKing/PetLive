import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { Interruptor } from '../../src/components/Interruptor';
import { alertaAtivoDoPet, alertar, posicaoAtual, RAIOS_PERDIDO } from '../../src/perdido/perdido';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { usePets } from '../../src/pets/PetsProvider';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

const QUANDO = [
  { rotulo: 'Agora', min: 0 },
  { rotulo: 'Há 30 min', min: 30 },
  { rotulo: 'Há 1 h', min: 60 },
  { rotulo: 'Há 3 h', min: 180 },
];

/** Meu pet sumiu (protótipo PetPerdido, tela 60; BUSINESS.md 5.29). */
export default function PetPerdido() {
  const { pet: petParam } = useLocalSearchParams<{ pet?: string }>();
  const { pets, petAtivo } = usePets();
  const [petId, setPetId] = useState(petParam ?? petAtivo?.id ?? pets[0]?.id ?? '');
  const pet = pets.find((p) => p.id === petId);
  const [local, setLocal] = useState<{ lat: number; lng: number; precisao: number | null } | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [quando, setQuando] = useState(0);
  const [raio, setRaio] = useState<number>(2);
  const [mensagem, setMensagem] = useState('');
  const [telefone, setTelefone] = useState(false);
  const [reconhecimento, setReconhecimento] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Pet que já tem alerta abre o alerta em andamento.
  useEffect(() => {
    if (!petId) return;
    alertaAtivoDoPet(petId).then((id) => id && router.replace(`/pet-perdido/${id}`), () => undefined);
  }, [petId]);

  async function usarLocal() {
    setErro(null);
    setLocalizando(true);
    try {
      setLocal(await posicaoAtual());
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setLocalizando(false);
    }
  }

  async function enviar() {
    if (!pet || !local) {
      setErro(!local ? 'Marque onde o pet foi visto pela última vez.' : 'Escolha o pet.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await alertar(pet.id, local.lat, local.lng, new Date(Date.now() - QUANDO[quando].min * 60000), raio, mensagem, telefone, reconhecimento && Boolean(pet.foto_url));
      Alert.alert(
        'Alerta enviado',
        r.avisados
          ? `${r.avisados} ${r.avisados === 1 ? 'pessoa por perto recebeu' : 'pessoas por perto receberam'} o alerta. O QR da coleira agora mostra que ${pet.nome} está sendo procurado.`
          : `Ninguém com avisos ligados está nesse raio agora. O QR da coleira já mostra que ${pet.nome} está sendo procurado; compartilhe o alerta também.`,
      );
      router.replace(`/pet-perdido/${r.id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Alerta para quem está perto" titulo="Meu pet sumiu" altura={196} />
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

        <Text style={estilos.secao}>Onde foi visto pela última vez</Text>
        <Tocavel accessibilityRole="button" onPress={usarLocal} disabled={localizando} style={[estilos.local, local && estilos.localOk]}>
          <Icone nome="local" size={20} cor={local ? colors.successText : colors.primaryDeep} espessura={2} />
          <View style={estilos.flex}>
            <Text style={estilos.localTitulo}>{localizando ? 'Pegando a localização…' : local ? 'Local marcado aqui' : 'Usar onde estou agora'}</Text>
            <Text style={estilos.localSub}>{local ? `Precisão de ~${Math.round(local.precisao ?? 0)} m · toque para atualizar` : 'Vá até onde ele sumiu ou marque daqui mesmo'}</Text>
          </View>
        </Tocavel>

        <Text style={estilos.secao}>Quando</Text>
        <View style={estilos.chips}>
          {QUANDO.map((q, i) => (
            <Tocavel key={q.rotulo} accessibilityRole="radio" accessibilityState={{ selected: i === quando }} onPress={() => setQuando(i)} style={[estilos.chip, i === quando && estilos.chipAtivo]}>
              <Text style={[estilos.chipTexto, i === quando && estilos.textoClaro]}>{q.rotulo}</Text>
            </Tocavel>
          ))}
        </View>

        <Text style={estilos.secao}>Avisar quem está a até</Text>
        <View style={estilos.chips}>
          {RAIOS_PERDIDO.map((r) => (
            <Tocavel key={r} accessibilityRole="radio" accessibilityState={{ selected: r === raio }} onPress={() => setRaio(r)} style={[estilos.chip, r === raio && estilos.chipAtivo]}>
              <Text style={[estilos.chipTexto, r === raio && estilos.textoClaro]}>{r} km</Text>
            </Tocavel>
          ))}
        </View>

        <View style={estilos.campo}>
          <Text style={estilos.rotulo}>Recado para quem encontrar</Text>
          <TextInput
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Ex.: assustado, não corra atrás. Coleira vermelha."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={300}
            style={estilos.texto}
          />
        </View>
        <View style={estilos.linha}>
          <View style={estilos.flex}>
            <Text style={estilos.linhaTitulo}>Mostrar meu telefone</Text>
            <Text style={estilos.linhaSub}>Quem vir o alerta pode ligar para você. Sem isso, a pessoa avisa pelo app.</Text>
          </View>
          <Interruptor ligado={telefone} rotulo="Mostrar meu telefone" onToggle={() => setTelefone((v) => !v)} />
        </View>
        {pet?.foto_url ? (
          <View style={estilos.linha}>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo}>Busca por foto</Text>
              <Text style={estilos.linhaSub}>Quem achar um pet pode comparar a foto dele com a foto do {pet.nome}. O app só sugere; ninguém vê seus dados por isso.</Text>
            </View>
            <Interruptor ligado={reconhecimento} rotulo="Permitir busca por foto" onToggle={() => setReconhecimento((v) => !v)} />
          </View>
        ) : null}
        {erro ? <Text style={estilos.erro} accessibilityRole="alert">{erro}</Text> : null}
        <Text style={estilos.nota}>O alerta vale 7 dias e você pode renovar. Só você encerra.</Text>
      </ScrollView>
      <View style={estilos.rodape}>
        <BotaoPrimario titulo={`Enviar alerta do ${pet?.nome ?? 'pet'}`} carregando={enviando} desabilitado={!pet} onPress={enviar} />
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, paddingRight: 14, height: 42, borderRadius: 21, backgroundColor: colors.surface },
  petAtivo: { backgroundColor: colors.black },
  petNome: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  textoClaro: { color: colors.white },
  secao: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black, marginTop: 6 },
  local: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySurface, borderRadius: 22, padding: 14 },
  localOk: { backgroundColor: colors.successSurface },
  localTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  localSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  chipAtivo: { backgroundColor: colors.black, borderColor: colors.black },
  chipTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.black },
  campo: { backgroundColor: colors.surface, borderRadius: 22, padding: 14, gap: 4, marginTop: 6 },
  rotulo: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  texto: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.black, minHeight: 60, textAlignVertical: 'top' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 22, padding: 14 },
  linhaTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.black },
  linhaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
});
