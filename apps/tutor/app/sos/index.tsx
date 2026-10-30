import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { Car } from 'phosphor-react-native/src/icons/Car';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { FirstAidKit } from 'phosphor-react-native/src/icons/FirstAidKit';
import { Flask } from 'phosphor-react-native/src/icons/Flask';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { Stethoscope } from 'phosphor-react-native/src/icons/Stethoscope';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { BotaoRedondo } from '../../src/components/Layout';
import { voltarOuInicio } from '../../src/lib/voltar';
import { AvatarPet } from '../../src/pets/AvatarPet';
import { usePets } from '../../src/pets/PetsProvider';
import { useRecurso } from '../../src/lib/configApp';
import { registrarEvento } from '../../src/lib/eventos';
import { ligarPara, tracarRota } from '../../src/mapa/acoes';
import { formatarDistancia } from '../../src/mapa/lugares';
import {
  buscarClinicaEmergencia,
  carregarVeterinario,
  minutosDeCarro,
  pontoDoBairro,
  salvarVeterinario,
  type ClinicaEmergencia,
  type MeuVeterinario,
  type ResultadoEmergencia,
} from '../../src/sos/emergencia';
import { chegadaAtual } from '../../src/sos/chegada';
import { colors } from '../../src/theme/colors';
import { shadow, spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';

/**
 * SOS (versão 2 do protótipo, SOS; board P1 "Tela SOS com a clínica 24 h
 * mais perto, ligar e rota"). Só o essencial: o cartão vermelho da clínica
 * 24 h mais perto com Ligar agora e Rota, enviar a ficha do pet e, em
 * "Enquanto isso", os guias offline e o veterinário do pet. Sem sinal,
 * mostra a última clínica 24 h guardada no aparelho.
 */
export default function Sos() {
  // Achei um pet por foto: começa desligado até a equipe medir a precisão (BUSINESS.md 5.38).
  const acheiFoto = useRecurso('achei_foto', false);
  const { pets, petAtivo } = usePets();
  const [clinica, setClinica] = useState<ClinicaEmergencia | null>(null);
  const [buscando, setBuscando] = useState(true);
  const [semLocalizacao, setSemLocalizacao] = useState(false);
  const [bairro, setBairro] = useState('');
  const [veterinario, setVeterinario] = useState<MeuVeterinario | null>(null);
  const [editandoVet, setEditandoVet] = useState(false);
  const [formVet, setFormVet] = useState<MeuVeterinario>({ nome: '', telefone: '' });
  // Aviso "Estou a caminho" em curso: o SOS leva direto ao acompanhamento.
  const [chegadaId, setChegadaId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      chegadaAtual().then(setChegadaId, () => undefined);
    }, []),
  );

  // Métrica do SOS (BUSINESS.md 14): quantos segundos até ligar.
  const abertoEm = useRef(0);
  useEffect(() => {
    abertoEm.current = Date.now();
    registrarEvento('sos_aberto');
  }, []);

  function ligar(telefone: string, destino: 'clinica' | 'veterinario') {
    registrarEvento('sos_ligou', { destino, segundos: Math.round((Date.now() - abertoEm.current) / 1000) });
    ligarPara(telefone);
  }

  function rota(lugar: Parameters<typeof tracarRota>[0]) {
    registrarEvento('sos_rota');
    tracarRota(lugar);
  }

  const aplicar = useCallback((resultado: ResultadoEmergencia) => {
    setClinica(resultado.clinica);
    setSemLocalizacao(resultado.semLocalizacao);
    setBuscando(false);
  }, []);

  useEffect(() => {
    buscarClinicaEmergencia().then(aplicar);
    carregarVeterinario().then(setVeterinario);
  }, [aplicar]);

  async function buscarPeloBairro() {
    if (!bairro.trim()) return;
    setBuscando(true);
    const ponto = await pontoDoBairro(bairro);
    if (!ponto) {
      setBuscando(false);
      Alert.alert('Bairro não encontrado', 'Confira o nome ou tente um bairro vizinho.');
      return;
    }
    aplicar(await buscarClinicaEmergencia(ponto));
  }

  function abrirEdicaoVet() {
    setFormVet(veterinario ?? { nome: '', telefone: '' });
    setEditandoVet(true);
  }

  async function salvarVet() {
    const nome = formVet.nome.trim();
    const telefone = formVet.telefone.trim();
    const novo = telefone ? { nome: nome || 'Meu veterinário', telefone } : null;
    await salvarVeterinario(novo).catch(() => undefined);
    setVeterinario(novo);
    setEditandoVet(false);
  }

  const telefoneClinica = clinica?.lugar.telefone ?? null;
  const distancia = formatarDistancia(clinica?.lugar.distancia_km);
  const minutos = minutosDeCarro(clinica?.lugar.distancia_km);
  const detalhes = [
    clinica?.doAparelho ? null : distancia,
    clinica?.doAparelho || minutos === null ? null : `${minutos} min de carro`,
    clinica?.confirmada24h ? 'Aberta 24 h' : null,
  ].filter(Boolean);

  const nomePet = petAtivo?.nome ?? pets[0]?.nome;
  const fotoPet = petAtivo ?? pets[0] ?? null;

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.topo}>
          <BotaoRedondo acessibilidade="Voltar" onPress={voltarOuInicio}>
            <ArrowLeft size={22} color={colors.black} />
          </BotaoRedondo>
          <Text style={estilos.titulo} accessibilityRole="header">Emergência</Text>
          <Text style={estilos.offline}>Funciona sem internet</Text>
        </View>

        <View style={estilos.cartaoClinica} accessibilityLiveRegion="polite">
          <Text style={estilos.cartaoRotulo}>
            {clinica && !clinica.confirmada24h ? 'Clínica mais perto · confirme por telefone' : 'Clínica 24 h mais perto'}
          </Text>

          {buscando ? (
            <View style={estilos.buscando}>
              <ActivityIndicator color={colors.white} />
              <Text style={estilos.detalhe}>Procurando a clínica mais perto…</Text>
            </View>
          ) : clinica ? (
            <>
              <Text style={estilos.nomeClinica}>{clinica.lugar.nome}</Text>
              {detalhes.length ? <Text style={estilos.detalhe}>{detalhes.join(' · ')}</Text> : null}
              {clinica.doAparelho ? (
                <Text style={estilos.detalhe}>
                  Sem sinal: última consultada em{' '}
                  {new Date(clinica.consultadaEm).toLocaleDateString('pt-BR')}
                </Text>
              ) : null}
              <View style={estilos.acoes}>
                {telefoneClinica ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={clinica.confirmada24h ? 'Ligar para a clínica 24 h' : 'Ligar para a clínica'}
                    onPress={() => ligar(telefoneClinica, 'clinica')}
                    style={({ pressed }) => [estilos.ligar, pressed && { opacity: 0.85 }]}
                  >
                    <Phone size={20} color={colors.emergency} weight="fill" />
                    <Text style={estilos.ligarTexto}>Ligar agora</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Traçar rota até a clínica"
                  onPress={() => rota(clinica.lugar)}
                  style={({ pressed }) => [estilos.rota, !telefoneClinica && estilos.rotaSozinha, pressed && { opacity: 0.85 }]}
                >
                  <NavigationArrow size={18} color={colors.white} />
                  <Text style={estilos.rotaTexto}>Rota</Text>
                </Pressable>
              </View>
              {clinica.doAparelho ? null : (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: '/lugar', params: { id: clinica.lugar.id } })}
                  hitSlop={6}
                >
                  <Text style={estilos.verFicha}>Ver a ficha da clínica</Text>
                </Pressable>
              )}
            </>
          ) : (
            <Text style={estilos.detalhe}>
              Não achamos uma clínica por perto agora. Use os guias abaixo e ligue para o seu
              veterinário.
            </Text>
          )}

          {semLocalizacao && !buscando ? (
            <View style={estilos.bairro}>
              <Campo
                rotulo="Sem localização: digite o bairro"
                placeholder="Ex.: Tijuca"
                value={bairro}
                onChangeText={setBairro}
                returnKeyType="search"
                onSubmitEditing={buscarPeloBairro}
                autoCapitalize="words"
              />
              <Pressable
                accessibilityRole="button"
                onPress={buscarPeloBairro}
                style={({ pressed }) => [estilos.botaoBairro, pressed && { opacity: 0.8 }]}
              >
                <Text style={estilos.botaoBairroTexto}>Buscar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {pets.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => (chegadaId ? router.push({ pathname: '/sos/chegada/[id]', params: { id: chegadaId } }) : router.push('/sos/caminho'))}
            style={({ pressed }) => [estilos.ficha, pressed && { opacity: 0.85 }]}
          >
            <View style={[estilos.linhaIcone, estilos.caminhoIcone]}>
              <Car size={22} color={colors.emergency} weight="fill" />
            </View>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo} numberOfLines={1}>{chegadaId ? 'Acompanhar a chegada' : 'Estou a caminho'}</Text>
              <Text style={estilos.linhaSub} numberOfLines={1}>
                {chegadaId ? 'Veja a resposta da clínica e toque em Cheguei' : 'Avise uma clínica 24 h do PetLive com a ficha'}
              </Text>
            </View>
            <CaretRight size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {clinica ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/ficha/enviar',
                params: { lugar: clinica.lugar.id, nome: clinica.lugar.nome, telefone: telefoneClinica ?? '' },
              })
            }
            style={({ pressed }) => [estilos.ficha, pressed && { opacity: 0.85 }]}
          >
            {fotoPet ? <AvatarPet especie={fotoPet.especie} foto={fotoPet.foto_url} size={46} /> : null}
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo} numberOfLines={1}>
                {nomePet ? `Enviar a ficha ${fotoPet?.sexo === 'femea' ? 'da' : 'do'} ${nomePet} à clínica` : 'Enviar a ficha à clínica'}
              </Text>
              <Text style={estilos.linhaSub} numberOfLines={1}>A equipe chega sabendo das alergias</Text>
            </View>
            <CaretRight size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}

        <Text style={estilos.secao}>Enquanto isso</Text>
        <View style={estilos.lista}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/sos/primeiros-socorros')} style={({ pressed }) => [estilos.linha, pressed && { opacity: 0.6 }]}>
            <View style={[estilos.linhaIcone, { backgroundColor: colors.warningSurface }]}><FirstAidKit size={20} color={colors.warningText} /></View>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo}>Primeiros socorros</Text>
              <Text style={estilos.linhaSub}>Passo a passo, funciona sem internet</Text>
            </View>
            <CaretRight size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/sos/intoxicacao')} style={({ pressed }) => [estilos.linha, estilos.divisoria, pressed && { opacity: 0.6 }]}>
            <View style={[estilos.linhaIcone, { backgroundColor: colors.warningSurface }]}><Flask size={20} color={colors.warningText} /></View>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo}>O que intoxica o pet</Text>
              <Text style={estilos.linhaSub}>Chocolate, uva, cebola e mais</Text>
            </View>
            <CaretRight size={18} color={colors.textMuted} />
          </Pressable>
          {acheiFoto ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/achei')} style={({ pressed }) => [estilos.linha, estilos.divisoria, pressed && { opacity: 0.6 }]}>
              <View style={[estilos.linhaIcone, { backgroundColor: colors.primarySurface }]}><Camera size={20} color={colors.primaryDeep} /></View>
              <View style={estilos.flex}>
                <Text style={estilos.linhaTitulo}>Achei um pet</Text>
                <Text style={estilos.linhaSub}>Compare a foto com alertas por perto</Text>
              </View>
              <CaretRight size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => (veterinario ? ligar(veterinario.telefone, 'veterinario') : abrirEdicaoVet())}
            style={({ pressed }) => [estilos.linha, estilos.divisoria, pressed && { opacity: 0.6 }]}
          >
            <View style={[estilos.linhaIcone, { backgroundColor: colors.background }]}><Stethoscope size={20} color={colors.textMuted} /></View>
            <View style={estilos.flex}>
              <Text style={estilos.linhaTitulo}>Meu veterinário</Text>
              <Text style={estilos.linhaSub} numberOfLines={1}>{veterinario ? veterinario.nome : 'Adicionar o telefone'}</Text>
            </View>
            {veterinario ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Editar o veterinário" onPress={abrirEdicaoVet} hitSlop={10}>
                  <PencilSimple size={18} color={colors.textMuted} />
                </Pressable>
                <Phone size={20} color={colors.black} />
              </>
            ) : (
              <CaretRight size={18} color={colors.textMuted} />
            )}
          </Pressable>
        </View>

        <Text style={estilos.nota}>
          O PetLive organiza informações e não substitui o atendimento veterinário. Em emergência, vá à clínica.
        </Text>
      </ScrollView>

      <Modal visible={editandoVet} animationType="slide" transparent onRequestClose={() => setEditandoVet(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={estilos.fundoModal}
        >
          <View style={estilos.folha}>
            <Text style={estilos.folhaTitulo}>Meu veterinário</Text>
            <Text style={estilos.folhaTexto}>Fica guardado só neste aparelho, para ligar mesmo sem internet.</Text>
            <Campo
              rotulo="Nome"
              variante="azul"
              placeholder="Ex.: Dra. Ana"
              value={formVet.nome}
              onChangeText={(nome) => setFormVet((atual) => ({ ...atual, nome }))}
              autoCapitalize="words"
            />
            <Campo
              rotulo="Telefone"
              variante="azul"
              placeholder="(21) 99999-9999"
              mascara="telefone"
              value={formVet.telefone}
              onChangeText={(telefone) => setFormVet((atual) => ({ ...atual, telefone }))}
            />
            <BotaoPrimario titulo="Salvar" onPress={salvarVet} />
            <Pressable accessibilityRole="button" onPress={() => setEditandoVet(false)} hitSlop={8}>
              <Text style={estilos.cancelar}>Cancelar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40, gap: 12 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  titulo: { flex: 1, fontFamily: fontFamily.bold, fontSize: 28, letterSpacing: -0.9, color: colors.black },
  offline: {
    fontSize: 11,
    fontFamily: fontFamily.bold,
    color: colors.successText,
    backgroundColor: colors.successSurface,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // Versão 2: o cartão vermelho é o único lugar do app com o vermelho do SOS.
  cartaoClinica: { backgroundColor: colors.emergency, borderRadius: 28, padding: 20, gap: 8 },
  cartaoRotulo: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontFamily: fontFamily.bold,
    color: colors.white,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  buscando: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  nomeClinica: { fontSize: 24, lineHeight: 29, letterSpacing: -0.6, fontFamily: fontFamily.bold, color: colors.white },
  detalhe: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.regular, color: '#FFE1DD' },
  acoes: { flexDirection: 'row', gap: 10, marginTop: 8 },
  ligar: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ligarTexto: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.emergency },
  rota: {
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rotaSozinha: { flex: 1 },
  rotaTexto: { fontSize: 16, fontFamily: fontFamily.bold, color: colors.white },
  verFicha: { fontSize: 13, fontFamily: fontFamily.bold, color: colors.white, textDecorationLine: 'underline', marginTop: 4 },
  bairro: { gap: 8, marginTop: 4 },
  botaoBairro: {
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoBairroTexto: { fontSize: 14, fontFamily: fontFamily.bold, color: colors.emergency },
  caminhoIcone: { width: 46, height: 46, backgroundColor: '#FDE0E6' },
  ficha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 14,
    ...shadow.card,
  },
  secao: { fontSize: 17, fontFamily: fontFamily.bold, color: colors.black, marginTop: 12, marginLeft: 4 },
  lista: { backgroundColor: colors.surface, borderRadius: 24, overflow: 'hidden', ...shadow.card },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  divisoria: { borderTopWidth: 1, borderTopColor: colors.border },
  linhaIcone: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  linhaTitulo: { fontSize: 15, fontFamily: fontFamily.bold, color: colors.black },
  linhaSub: { fontSize: 13, fontFamily: fontFamily.regular, color: colors.textMuted, marginTop: 1 },
  nota: { fontSize: 12, lineHeight: 18, fontFamily: fontFamily.regular, color: colors.textMuted, marginHorizontal: 4, marginTop: 4 },
  fundoModal: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    paddingBottom: 36,
    gap: spacing.md,
  },
  folhaTitulo: { ...typography.h2, color: colors.black },
  folhaTexto: { ...typography.caption, color: colors.textMuted },
  cancelar: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xs },
});
