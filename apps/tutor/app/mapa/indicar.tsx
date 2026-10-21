import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Surgir, Tocavel } from '../../src/components/Animacoes';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Campo } from '../../src/components/Campo';
import { HeroiOnda } from '../../src/components/HeroiOnda';
import { Icone } from '../../src/components/Icone';
import { MarcaPata } from '../../src/components/MarcaPata';
import { mensagemDeErro } from '../../src/lib/cacheOffline';
import { acharEndereco } from '../../src/mapa/geocodificar';
import { IlustracaoLugar } from '../../src/mapa/IlustracaoLugar';
import {
  indicarLugar,
  minhasSugestoes,
  ROTULO_STATUS,
  type AceitaSugestao,
  type CategoriaSugestao,
  type Sugestao,
} from '../../src/mapa/sugestoes';
import { useLocalizacao } from '../../src/mapa/useLocalizacao';
import { colors } from '../../src/theme/colors';
import { fontFamily } from '../../src/theme/typography';

const CATEGORIAS: { valor: CategoriaSugestao; rotulo: string }[] = [
  { valor: 'restaurante', rotulo: 'Restaurante' },
  { valor: 'hotel', rotulo: 'Hotel' },
  { valor: 'praia', rotulo: 'Praia' },
  { valor: 'parque', rotulo: 'Parque' },
];

const ACEITA: { valor: AceitaSugestao; rotulo: string }[] = [
  { valor: 'caes', rotulo: 'Cães' },
  { valor: 'gatos', rotulo: 'Gatos' },
  { valor: 'caes_e_gatos', rotulo: 'Cães e gatos' },
];

const COR_STATUS: Record<Sugestao['status'], { fundo: string; texto: string }> = {
  em_analise: { fundo: colors.warningSurface, texto: colors.warningText },
  aprovada: { fundo: colors.successSurface, texto: colors.successText },
  recusada: { fundo: '#FDE0E6', texto: '#A3324F' },
};

/**
 * Indicar um lugar pet friendly: os dados abertos quase não marcam quem
 * aceita pets (docs/dados-abertos.md), então os tutores indicam. A equipe
 * confere antes de aparecer no mapa (BUSINESS.md 5.16, mesma regra dos eventos).
 */
export default function IndicarLugar() {
  const { posicao } = useLocalizacao();
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<CategoriaSugestao | null>(null);
  const [aceita, setAceita] = useState<AceitaSugestao>('caes');
  const [endereco, setEndereco] = useState('');
  const [usarPosicao, setUsarPosicao] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [minhas, setMinhas] = useState<Sugestao[]>([]);

  useFocusEffect(
    useCallback(() => {
      minhasSugestoes().then(setMinhas, () => undefined);
    }, []),
  );

  async function usarMinhaLocalizacao() {
    if (!posicao) {
      setErro('Ainda não temos a sua localização. Digite o endereço.');
      return;
    }
    setErro(null);
    setUsarPosicao(true);
    try {
      const [achado] = await Location.reverseGeocodeAsync({ latitude: posicao.lat, longitude: posicao.lng });
      if (achado) {
        setEndereco([achado.street, achado.streetNumber, achado.district].filter(Boolean).join(', '));
      }
    } catch {
      // Sem o endereço por extenso a posição ainda serve.
    }
  }

  async function enviar() {
    setErro(null);
    if (nome.trim().length < 2) return setErro('Diga o nome do lugar.');
    if (!categoria) return setErro('Escolha o tipo de lugar.');
    if (!usarPosicao && endereco.trim().length < 5) return setErro('Diga o endereço ou use a sua localização.');

    setEnviando(true);
    try {
      let ponto = usarPosicao && posicao ? posicao : null;
      if (!ponto) {
        ponto = await acharEndereco(endereco, posicao);
        if (!ponto) throw new Error('Não achamos esse endereço. Confira e tente de novo.');
      }
      await indicarLugar({
        nome: nome.trim(),
        categoria,
        aceita,
        endereco: endereco.trim() || null,
        lat: ponto.lat,
        lng: ponto.lng,
        observacao: observacao.trim() || null,
      });
      setEnviado(true);
      setNome('');
      setCategoria(null);
      setEndereco('');
      setObservacao('');
      setUsarPosicao(false);
      minhasSugestoes().then(setMinhas, () => undefined);
    } catch (e) {
      setErro(mensagemDeErro(e instanceof Error ? e.message : String(e)));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeroiOnda subtitulo="Pet friendly" titulo="Indicar um lugar" altura={196}>
        <MarcaPata size={96} style={estilos.pata} />
      </HeroiOnda>

      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {enviado ? (
          <Surgir style={estilos.obrigado}>
            <Text style={estilos.obrigadoTitulo}>Obrigado pela indicação!</Text>
            <Text style={estilos.obrigadoTexto}>
              A equipe confere em até 1 dia útil. Depois disso, o lugar aparece no mapa para todos os tutores.
            </Text>
          </Surgir>
        ) : null}

        <Text style={estilos.intro}>
          Conhece um restaurante, hotel, praia ou parque que aceita pets? Conte aqui e ajude outros tutores.
        </Text>

        <Campo
          rotulo="Nome do lugar"
          variante="roxo"
          placeholder="Ex.: Café da Praça"
          autoCapitalize="words"
          maxLength={120}
          value={nome}
          onChangeText={setNome}
        />

        <Text style={estilos.secao}>Que tipo de lugar?</Text>
        <View style={estilos.tipos}>
          {CATEGORIAS.map((c) => {
            const ativo = categoria === c.valor;
            return (
              <Tocavel
                key={c.valor}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
                onPress={() => setCategoria(c.valor)}
                estiloExterno={estilos.tipoFora}
                style={[estilos.tipo, ativo && estilos.tipoAtivo]}
              >
                <View style={estilos.tipoFoto}>
                  <IlustracaoLugar categoria={c.valor} tamanho={44} />
                </View>
                <Text style={[estilos.tipoTexto, ativo && estilos.tipoTextoAtivo]}>{c.rotulo}</Text>
              </Tocavel>
            );
          })}
        </View>

        <Text style={estilos.secao}>Aceita</Text>
        <View style={estilos.chips}>
          {ACEITA.map((a) => {
            const ativo = aceita === a.valor;
            return (
              <Pressable
                key={a.valor}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
                onPress={() => setAceita(a.valor)}
                style={[estilos.chip, ativo ? estilos.chipAtivo : estilos.chipInativo]}
              >
                <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>{a.rotulo}</Text>
              </Pressable>
            );
          })}
        </View>

        <Campo
          rotulo="Onde fica"
          variante="azul"
          placeholder="Rua, número e bairro"
          maxLength={200}
          value={endereco}
          onChangeText={(texto) => {
            setEndereco(texto);
            setUsarPosicao(false);
          }}
        />
        <Pressable accessibilityRole="button" onPress={usarMinhaLocalizacao} hitSlop={8} style={estilos.minhaPosicao}>
          <Icone nome="local" size={16} cor={usarPosicao ? colors.successText : colors.primaryDeep} espessura={2.2} />
          <Text style={[estilos.minhaPosicaoTexto, usarPosicao && { color: colors.successText }]}>
            {usarPosicao ? 'Usando a sua localização atual' : 'Estou no lugar agora: usar minha localização'}
          </Text>
        </Pressable>

        <Campo
          rotulo="Algo que ajude? (opcional)"
          variante="amarelo"
          placeholder="Ex.: pets só na área externa"
          maxLength={300}
          value={observacao}
          onChangeText={setObservacao}
        />

        {erro ? (
          <Text style={estilos.erro} accessibilityRole="alert">
            {erro}
          </Text>
        ) : null}

        <Text style={estilos.nota}>A equipe confere cada indicação antes de mostrar no mapa.</Text>
        <BotaoPrimario titulo="Enviar indicação" onPress={enviar} carregando={enviando} icone={<Icone nome="pata" size={22} espessura={2} />} />

        {minhas.length > 0 ? (
          <View style={estilos.minhas}>
            <Text style={estilos.secao}>Minhas indicações</Text>
            {minhas.map((s) => {
              const cor = COR_STATUS[s.status];
              return (
                <View key={s.id} style={estilos.minha}>
                  <View style={estilos.minhaFoto}>
                    <IlustracaoLugar categoria={s.categoria} tamanho={40} />
                  </View>
                  <View style={estilos.flex}>
                    <Text style={estilos.minhaNome} numberOfLines={1}>
                      {s.nome}
                    </Text>
                    {s.status === 'recusada' && s.motivo_recusa ? (
                      <Text style={estilos.minhaSub} numberOfLines={2}>
                        {s.motivo_recusa}
                      </Text>
                    ) : s.endereco ? (
                      <Text style={estilos.minhaSub} numberOfLines={1}>
                        {s.endereco}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[estilos.status, { backgroundColor: cor.fundo, color: cor.texto }]}>{ROTULO_STATUS[s.status]}</Text>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1, minWidth: 0 },
  pata: { position: 'absolute', right: 30, top: 54 },
  conteudo: { paddingHorizontal: 24, paddingBottom: 40, gap: 12 },
  intro: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  secao: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black, marginTop: 4 },
  tipos: { flexDirection: 'row', gap: 8 },
  tipoFora: { flex: 1 },
  tipo: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tipoAtivo: { borderColor: colors.black, backgroundColor: colors.background },
  tipoFoto: { width: 44, height: 44, borderRadius: 14, overflow: 'hidden' },
  tipoTexto: { fontFamily: fontFamily.semiBold, fontSize: 12, color: colors.textMuted },
  tipoTextoAtivo: { color: colors.black, fontFamily: fontFamily.bold },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { height: 40, borderRadius: 20, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  chipAtivo: { backgroundColor: colors.black },
  chipInativo: { borderWidth: 1.5, borderColor: colors.border },
  chipTexto: { fontFamily: fontFamily.bold, fontSize: 13, color: colors.black },
  chipTextoAtivo: { color: colors.white },
  minhaPosicao: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4 },
  minhaPosicaoTexto: { fontFamily: fontFamily.semiBold, fontSize: 13, color: colors.primaryDeep },
  erro: { fontFamily: fontFamily.medium, fontSize: 13, color: colors.danger },
  nota: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  obrigado: { backgroundColor: colors.successSurface, borderRadius: 22, padding: 16, gap: 4 },
  obrigadoTitulo: { fontFamily: fontFamily.bold, fontSize: 15, color: colors.successText },
  obrigadoTexto: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 19, color: colors.successText },
  minhas: { gap: 8, marginTop: 8 },
  minha: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.background, borderRadius: 20, padding: 8 },
  minhaFoto: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden' },
  minhaNome: { fontFamily: fontFamily.bold, fontSize: 14, color: colors.black },
  minhaSub: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  status: {
    fontFamily: fontFamily.bold,
    fontSize: 11,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
