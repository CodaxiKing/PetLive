import { useCallback, useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { LinhaIcone } from '../../src/components/LinhaIcone';
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
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

const ROSA = '#FDE0E6';
const ROSA_TEXTO = '#A3324F';

/**
 * SOS (tela 46, protótipo SOS; board P1 "Tela SOS com a clínica 24 h mais
 * perto, ligar e rota"). Só o essencial: a clínica 24 h mais perto, os
 * guias offline e o veterinário do pet. Ligar fica sempre à vista no
 * rodapé. Sem sinal, mostra a última clínica 24 h guardada no aparelho.
 */
export default function Sos() {
  const [clinica, setClinica] = useState<ClinicaEmergencia | null>(null);
  const [buscando, setBuscando] = useState(true);
  const [semLocalizacao, setSemLocalizacao] = useState(false);
  const [bairro, setBairro] = useState('');
  const [veterinario, setVeterinario] = useState<MeuVeterinario | null>(null);
  const [editandoVet, setEditandoVet] = useState(false);
  const [formVet, setFormVet] = useState<MeuVeterinario>({ nome: '', telefone: '' });

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

  return (
    <View style={estilos.tela}>
      <HeroiOnda fundo={ROSA} subtitulo="Emergência" titulo="SOS" selo="Funciona sem internet" />

      <ScrollView contentContainerStyle={estilos.conteudo} showsVerticalScrollIndicator={false}>
        <View style={estilos.cartaoClinica} accessibilityLiveRegion="polite">
          <Text style={estilos.cartaoRotulo}>
            {clinica && !clinica.confirmada24h ? 'Clínica mais perto' : 'Clínica 24 h mais perto'}
          </Text>

          {buscando ? (
            <View style={estilos.buscando}>
              <ActivityIndicator color={ROSA_TEXTO} />
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
              <View style={estilos.chips}>
                {clinica.confirmada24h ? (
                  <Text style={[estilos.chip, estilos.chipVerde]}>Atende 24 h</Text>
                ) : (
                  <Text style={[estilos.chip, estilos.chipAmarelo]}>Confirme por telefone</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => tracarRota(clinica.lugar)}
                  hitSlop={6}
                >
                  <Text style={[estilos.chip, estilos.chipCinza]}>Rota</Text>
                </Pressable>
                {clinica.doAparelho ? null : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/lugar', params: { id: clinica.lugar.id } })}
                    hitSlop={6}
                  >
                    <Text style={[estilos.chip, estilos.chipCinza]}>Ver ficha</Text>
                  </Pressable>
                )}
              </View>
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

        <LinhaIcone
          icone={<Icone nome="cruz" />}
          rotulo="Primeiros socorros"
          valor="Passo a passo para agir agora"
          fundo="#FFF0C9"
          onPress={() => router.push('/sos/primeiros-socorros')}
        />
        <LinhaIcone
          icone={<Icone nome="frasco" />}
          rotulo="O que intoxica o pet"
          valor="Chocolate, uva, cebola e mais"
          fundo="#FFF0C9"
          onPress={() => router.push('/sos/intoxicacao')}
        />
        <LinhaIcone
          icone={<Icone nome="telefone" />}
          rotulo="Meu veterinário"
          valor={veterinario ? `Ligar para ${veterinario.nome}` : 'Adicionar o telefone'}
          onPress={() => (veterinario ? ligarPara(veterinario.telefone) : abrirEdicaoVet())}
          direita={
            veterinario ? (
              <Pressable accessibilityRole="button" onPress={abrirEdicaoVet} hitSlop={10}>
                <Text style={estilos.editar}>Editar</Text>
              </Pressable>
            ) : null
          }
        />

        <Text style={estilos.nota}>
          Em emergência, vá à clínica. O app não substitui o atendimento veterinário.
        </Text>
      </ScrollView>

      <View style={estilos.rodape}>
        {telefoneClinica ? (
          <BotaoPrimario
            titulo={clinica?.confirmada24h ? 'Ligar para a clínica 24 h' : 'Ligar para a clínica'}
            icone={<Icone nome="telefone" size={22} />}
            onPress={() => ligarPara(telefoneClinica)}
          />
        ) : clinica ? (
          <BotaoPrimario
            titulo="Traçar rota até a clínica"
            icone={<Icone nome="rota" size={22} />}
            onPress={() => tracarRota(clinica.lugar)}
          />
        ) : veterinario ? (
          <BotaoPrimario
            titulo="Ligar para o veterinário"
            icone={<Icone nome="telefone" size={22} />}
            onPress={() => ligarPara(veterinario.telefone)}
          />
        ) : null}
      </View>

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
              keyboardType="phone-pad"
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
  tela: { flex: 1, backgroundColor: colors.surface },
  conteudo: { paddingHorizontal: 24, paddingBottom: spacing.lg, gap: 10 },
  cartaoClinica: {
    backgroundColor: ROSA,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
  },
  cartaoRotulo: { fontSize: 12, fontFamily: typography.h1.fontFamily, color: ROSA_TEXTO },
  buscando: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nomeClinica: {
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.44,
    fontFamily: typography.h3.fontFamily,
    color: colors.black,
  },
  detalhe: { fontSize: 13, lineHeight: 18, fontFamily: typography.caption.fontFamily, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontSize: 11,
    fontFamily: typography.h1.fontFamily,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipVerde: { backgroundColor: '#D8F2E3', color: '#1F6B45' },
  chipAmarelo: { backgroundColor: '#FFF0C9', color: '#8A6414' },
  chipCinza: { backgroundColor: '#F1F3F7', color: '#4A5568' },
  bairro: { gap: 8 },
  botaoBairro: {
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoBairroTexto: { fontSize: 13, fontFamily: typography.h1.fontFamily, color: colors.white },
  editar: { fontSize: 12, fontFamily: typography.label.fontFamily, color: colors.primaryDeep },
  nota: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: typography.small.fontFamily,
    color: '#6A7484',
    textAlign: 'center',
    paddingHorizontal: 6,
  },
  rodape: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28 },
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
