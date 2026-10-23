import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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

  async function enviar() {
    if (enviandoRef.current || (editando && idCarregado !== id)) return;
    enviandoRef.current = true;
    setEnviando(true);
    let sucesso = false;
    try {
      const { dataInicio, dataFim, latitude, longitude, precoCentavos, numeroVagas } = validarFormularioEvento({
        titulo, descricao, local, inicio, fim, modoLocal, placeId, lat, lng, gratuito, preco, ingresso, vagas,
      });
      const payload = {
        p_titulo: titulo.trim(), p_tipo: tipo, p_descricao: descricao.trim(),
        p_inicio_em: dataInicio.toISOString(), p_fim_em: dataFim.toISOString(), p_local_nome: local.trim(),
        p_place_id: modoLocal === 'google' ? placeId.trim() : null,
        p_lat: modoLocal === 'ponto' ? latitude : null, p_lng: modoLocal === 'ponto' ? longitude : null,
        p_foto_url: null, p_gratuito: gratuito,
        p_preco_centavos: gratuito ? null : precoCentavos, p_ingresso_url: gratuito ? null : ingresso.trim(),
        p_vagas: numeroVagas,
      };
      if (editando && id) {
        await atualizarEvento(id, {
          titulo: titulo.trim(), tipo, descricao: descricao.trim(), inicio_em: dataInicio.toISOString(), fim_em: dataFim.toISOString(), local_nome: local.trim(),
          place_id: modoLocal === 'google' ? placeId.trim() : null, lat: modoLocal === 'ponto' ? latitude : null, lng: modoLocal === 'ponto' ? longitude : null,
          gratuito, preco_centavos: gratuito ? null : precoCentavos, ingresso_url: gratuito ? null : ingresso.trim(), vagas: numeroVagas,
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
        <View style={estilos.opcoes}>
          {(['ponto', 'google'] as const).filter((item) => item !== 'google' || Boolean(placeId)).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: modoLocal === item }} onPress={() => setModoLocal(item)} style={[estilos.opcao, modoLocal === item && estilos.opcaoAtiva]}>
            <Text style={[estilos.opcaoTexto, modoLocal === item && estilos.opcaoTextoAtiva]}>{item === 'ponto' ? 'Ponto no mapa' : 'Lugar do Google'}</Text>
          </Pressable>)}
        </View>
        {modoLocal === 'google' ? <Text style={estilos.dica}>O lugar do Google já vinculado será mantido. Para mudar o local, informe um ponto próprio.</Text> : <View style={estilos.linhaCampos}>
          <TextInput style={[estilos.campo, estilos.campoMetade]} value={lat} onChangeText={setLat} keyboardType="decimal-pad" placeholder="Latitude" />
          <TextInput style={[estilos.campo, estilos.campoMetade]} value={lng} onChangeText={setLng} keyboardType="decimal-pad" placeholder="Longitude" />
        </View>}

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
