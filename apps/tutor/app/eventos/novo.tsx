import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/auth/AuthProvider';
import { SeletorLocalEvento } from '../../src/mapa/SeletorLocalEvento';
import { enviarFotoEvento } from '../../src/mapa/fotoEvento';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { Icone } from '../../src/components/Icone';
import { supabase } from '../../src/lib/supabase';
import { colors } from '../../src/theme/colors';
import { components, radius, spacing } from '../../src/theme/tokens';
import { fontFamily, typography } from '../../src/theme/typography';
import { atualizarEvento, carregarEventoEditavel, TIPO_EVENTO, type EventoMapa } from '../../src/mapa/eventos';

import { isoLocal, validarFormularioEvento } from '../../src/mapa/formularioEvento';

type Tipo = EventoMapa['tipo'];
const TIPOS: Tipo[] = ['adocao', 'vacinacao', 'passeio', 'encontro', 'palestra', 'outro'];
export default function NovoEvento() {
  const { user } = useAuth();
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [foto, setFoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fotoAtual, setFotoAtual] = useState<string | null>(null);
  const fotoEnviada = useRef<{ uri: string; url: string } | null>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editando = typeof id === 'string';
  const [inicio, setInicio] = useState(() => isoLocal(new Date(Date.now() + 86400000)));
  const [fim, setFim] = useState(() => isoLocal(new Date(Date.now() + 93600000)));
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<Tipo>('encontro');
  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [modoLocal, setModoLocal] = useState<'ponto' | 'google'>('ponto');
  const [placeId, setPlaceId] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [gratuito, setGratuito] = useState(true);
  const [preco, setPreco] = useState('');
  const [ingresso, setIngresso] = useState('');
  const [vagas, setVagas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);
  const [idCarregado, setIdCarregado] = useState<string | null>(null);
  const [falhaCarga, setFalhaCarga] = useState<{ id: string; mensagem: string } | null>(null);
  const erroCarga = falhaCarga && falhaCarga.id === id ? falhaCarga.mensagem : null;
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    carregarEventoEditavel(id).then((evento) => {
      if (!ativo) return;
      if (!['em_analise', 'publicado', 'ajuste_solicitado'].includes(evento.status)) throw new Error('Este evento não pode mais ser editado.');
      setFotoAtual(evento.foto_url);
      setTitulo(evento.titulo); setTipo(evento.tipo); setDescricao(evento.descricao);
      setInicio(isoLocal(new Date(evento.inicio_em))); setFim(isoLocal(new Date(evento.fim_em)));
      setLocal(evento.local_nome); setModoLocal(evento.place_id ? 'google' : 'ponto');
      setPlaceId(evento.place_id ?? ''); setLat(evento.lat == null ? '' : String(evento.lat)); setLng(evento.lng == null ? '' : String(evento.lng));
      setGratuito(evento.gratuito); setPreco(evento.preco_centavos == null ? '' : (evento.preco_centavos / 100).toFixed(2));
      setIngresso(evento.ingresso_url ?? ''); setVagas(evento.vagas == null ? '' : String(evento.vagas));
      setIdCarregado(id);
    }).catch((erro: Error) => { if (ativo) setFalhaCarga({ id, mensagem: erro.message }); });
    return () => { ativo = false; };
  }, [id, tentativa]);

  async function escolherFoto() {
    if (enviandoRef.current) return;
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
      if (resultado.canceled) return;
      const escolhida = resultado.assets[0];
      if (escolhida.fileSize && escolhida.fileSize > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB.');
      setFoto(escolhida);
    } catch (e) { Alert.alert('Não foi possível selecionar a foto', e instanceof Error ? e.message : 'Tente novamente.'); }
  }

  async function enviar() {
    if (enviandoRef.current || (editando && idCarregado !== id)) return;
    enviandoRef.current = true;
    setEnviando(true);
    let sucesso = false;
    try {
      const { dataInicio, dataFim, latitude, longitude, precoCentavos, numeroVagas } = validarFormularioEvento({
        titulo, descricao, local, inicio, fim, modoLocal, placeId, lat, lng, gratuito, preco, ingresso, vagas,
      });
      let fotoUrl = fotoAtual;
      if (foto) {
        if (!user) throw new Error('Entre novamente para enviar a foto.');
        if (fotoEnviada.current?.uri !== foto.uri) {
          const enviada = await enviarFotoEvento(user.id, foto);
          fotoEnviada.current = { uri: foto.uri, url: enviada.url };
        }
        fotoUrl = fotoEnviada.current.url;
      }
      const payload = {
        p_titulo: titulo.trim(), p_tipo: tipo, p_descricao: descricao.trim(),
        p_inicio_em: dataInicio.toISOString(), p_fim_em: dataFim.toISOString(), p_local_nome: local.trim(),
        p_place_id: modoLocal === 'google' ? placeId.trim() : null,
        p_lat: modoLocal === 'ponto' ? latitude : null, p_lng: modoLocal === 'ponto' ? longitude : null,
        p_foto_url: fotoUrl, p_gratuito: gratuito,
        p_preco_centavos: gratuito ? null : precoCentavos, p_ingresso_url: gratuito ? null : ingresso.trim(),
        p_vagas: numeroVagas,
      };
      if (editando && id) {
        await atualizarEvento(id, {
          titulo: titulo.trim(), tipo, descricao: descricao.trim(), inicio_em: dataInicio.toISOString(), fim_em: dataFim.toISOString(), local_nome: local.trim(),
          place_id: modoLocal === 'google' ? placeId.trim() : null, lat: modoLocal === 'ponto' ? latitude : null, lng: modoLocal === 'ponto' ? longitude : null,
          foto_url: fotoUrl, gratuito, preco_centavos: gratuito ? null : precoCentavos, ingresso_url: gratuito ? null : ingresso.trim(), vagas: numeroVagas,
        });
      } else {
        const { error } = await supabase.rpc('evento_criar', payload);
        if (error) throw new Error(error.message);
      }
      sucesso = true;
      Alert.alert(editando ? 'Evento atualizado' : 'Evento enviado', editando ? 'Confira o estado atualizado em Meus eventos. Mudanças de data, horário ou local voltam para análise.' : 'Acompanhe a publicação ou análise em Meus eventos.', [{ text: 'Ver meus eventos', onPress: () => router.replace('/eventos/meus') }], { cancelable: false });
    } catch (erro) {
      Alert.alert('Não foi possível enviar o evento', erro instanceof Error ? erro.message : 'Tente novamente.');
    } finally {
      if (!sucesso) { enviandoRef.current = false; setEnviando(false); }
    }
  }

  if (editando && idCarregado !== id) return <View style={[estilos.tela, estilos.conteudo]}>
    <Pressable accessibilityRole="button" onPress={() => router.replace('/eventos/meus')}><Text style={estilos.voltarTexto}>Voltar aos meus eventos</Text></Pressable>
    {erroCarga ? <><Text accessibilityRole="alert" style={estilos.ajuda}>{erroCarga}</Text><Pressable accessibilityRole="button" onPress={() => { setFalhaCarga(null); setTentativa((n) => n + 1); }}><Text style={estilos.voltarTexto}>Tentar novamente</Text></Pressable></> : <ActivityIndicator accessibilityLabel="Carregando evento para edição" color={colors.primaryDeep} />}
  </View>;

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/eventos/meus')} style={estilos.voltar}>
          <Icone nome="seta" size={18} espessura={2} />
          <Text style={estilos.voltarTexto}>Voltar ao mapa</Text>
        </Pressable>
        <Text style={estilos.tituloTela}>{editando ? 'Editar evento' : 'Criar evento'}</Text>
        <Text style={estilos.ajuda}>{editando ? 'Mudar data, horário ou local envia o evento novamente para análise.' : 'Você pode enviar até 3 eventos por mês. Organizadores verificados publicam direto; os demais passam por análise.'}</Text>

        <Text style={estilos.rotulo}>Título</Text>
        <TextInput style={estilos.campo} value={titulo} onChangeText={setTitulo} maxLength={100} placeholder="Ex.: Feira de adoção responsável" />

        <Text style={estilos.rotulo}>Tipo de evento</Text>
        <View style={estilos.opcoes}>{TIPOS.map((item) => (
          <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: tipo === item }} onPress={() => setTipo(item)} style={[estilos.opcao, tipo === item && estilos.opcaoAtiva]}>
            <Text style={[estilos.opcaoTexto, tipo === item && estilos.opcaoTextoAtiva]}>{TIPO_EVENTO[item]}</Text>
          </Pressable>
        ))}</View>

        <Text style={estilos.rotulo}>Descrição</Text>
        <TextInput style={[estilos.campo, estilos.multilinha]} value={descricao} onChangeText={setDescricao} maxLength={3000} multiline placeholder="Conte o que vai acontecer, para quem é e o que os participantes devem saber." />

        <Text style={estilos.rotulo}>Início (data e hora)</Text>
        <TextInput style={estilos.campo} value={inicio} onChangeText={setInicio} placeholder="AAAA-MM-DDTHH:mm" accessibilityLabel="Data e hora de início" />
        <Text style={estilos.rotulo}>Fim (data e hora)</Text>
        <TextInput style={estilos.campo} value={fim} onChangeText={setFim} placeholder="AAAA-MM-DDTHH:mm" accessibilityLabel="Data e hora de fim" />
        <Text style={estilos.dica}>Formato: AAAA-MM-DDTHH:mm, por exemplo 2026-12-15T14:30.</Text>

        <Text style={estilos.rotulo}>Local</Text>
        <TextInput style={estilos.campo} value={local} onChangeText={setLocal} maxLength={160} placeholder="Nome do parque ou estabelecimento público" />
        <Pressable accessibilityRole="button" disabled={enviando} onPress={() => setSeletorAberto(true)} style={estilos.opcao}>
          <Text style={estilos.opcaoTexto}>{modoLocal === 'google' && placeId ? 'Lugar do Google selecionado · Alterar' : lat && lng ? 'Ponto marcado no mapa · Alterar' : 'Escolher local no mapa'}</Text>
        </Pressable>
        <Text style={estilos.dica}>O nome acima é a descrição do local que você deseja divulgar.</Text>

        <Text style={estilos.rotulo}>Foto de divulgação (opcional)</Text>
        {foto?.uri || fotoAtual ? <Image source={{ uri: foto?.uri ?? fotoAtual! }} style={{ height: 190, width: '100%', borderRadius: radius.lg }} accessibilityLabel="Prévia da foto do evento" /> : null}
        <Pressable accessibilityRole="button" disabled={enviando} onPress={() => void escolherFoto()} style={estilos.opcao}><Text style={estilos.opcaoTexto}>Escolher foto</Text></Pressable>
        {foto || fotoAtual ? <Pressable accessibilityRole="button" disabled={enviando} onPress={() => { setFoto(null); setFotoAtual(null); }}><Text style={estilos.voltarTexto}>Remover foto</Text></Pressable> : null}
        <Text style={estilos.dica}>JPEG, PNG ou WebP, até 5 MB. A foto de divulgação será pública. Evite documentos e dados pessoais.</Text>

        <Text style={estilos.rotulo}>Entrada</Text>
        <View style={estilos.opcoes}>
          {[true, false].map((valor) => <Pressable key={String(valor)} accessibilityRole="button" accessibilityState={{ selected: gratuito === valor }} onPress={() => setGratuito(valor)} style={[estilos.opcao, gratuito === valor && estilos.opcaoAtiva]}>
            <Text style={[estilos.opcaoTexto, gratuito === valor && estilos.opcaoTextoAtiva]}>{valor ? 'Gratuita' : 'Paga (link externo)'}</Text>
          </Pressable>)}
        </View>
        {!gratuito ? <>
          <TextInput style={estilos.campo} value={preco} onChangeText={setPreco} keyboardType="decimal-pad" placeholder="Preço em reais (ex.: 25,00)" accessibilityLabel="Preço do ingresso em reais" />
          <TextInput style={estilos.campo} value={ingresso} onChangeText={setIngresso} keyboardType="url" autoCapitalize="none" placeholder="https://site-do-organizador.com/ingresso" accessibilityLabel="Link externo do ingresso" />
        </> : null}

        <Text style={estilos.rotulo}>Vagas (opcional)</Text>
        <TextInput style={estilos.campo} value={vagas} onChangeText={setVagas} keyboardType="number-pad" placeholder="Sem limite" />

        <View style={estilos.responsabilidade}><Text style={estilos.responsabilidadeTitulo}>Evento em local público</Text><Text style={estilos.dica}>O organizador é responsável pelo evento. Não divulgue telefone ou endereço residencial de pessoas.</Text></View>
        <BotaoPrimario titulo={editando ? 'Salvar alterações' : 'Enviar para análise'} onPress={enviar} carregando={enviando} estilo={estilos.botaoEnviar} />
      </ScrollView>
      {seletorAberto ? <SeletorLocalEvento inicial={lat && lng ? { lat: Number(lat), lng: Number(lng) } : null} onFechar={() => setSeletorAberto(false)} onEscolher={(escolha) => {
        setModoLocal(escolha.modo);
        if (escolha.modo === 'google') { setPlaceId(escolha.placeId); setLat(''); setLng(''); }
        else { setPlaceId(''); setLat(String(escolha.ponto.lat)); setLng(String(escolha.ponto.lng)); }
        setSeletorAberto(false);
      }} /> : null}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background },
  conteudo: { padding: spacing.xl, paddingTop: 58, paddingBottom: 48, gap: spacing.sm },
  voltar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  voltarTexto: { ...typography.captionMedium, color: colors.primaryDeep },
  tituloTela: { ...typography.h1, fontFamily: fontFamily.bold, color: colors.black },
  ajuda: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  rotulo: { ...typography.captionMedium, color: colors.text, fontFamily: fontFamily.bold, marginTop: spacing.sm },
  campo: { ...components.input, minHeight: 50 },
  multilinha: { minHeight: 116, textAlignVertical: 'top' },
  dica: { ...typography.caption, color: colors.textMuted },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  opcao: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  opcaoAtiva: { backgroundColor: colors.black, borderColor: colors.black },
  opcaoTexto: { ...typography.caption, color: colors.text },
  opcaoTextoAtiva: { color: colors.white },
  linhaCampos: { flexDirection: 'row', gap: spacing.sm },
  campoMetade: { flex: 1 },
  responsabilidade: { backgroundColor: colors.warningSurface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, marginTop: spacing.md },
  responsabilidadeTitulo: { ...typography.captionMedium, color: colors.warningText },
  botaoEnviar: { marginTop: spacing.lg },
});
