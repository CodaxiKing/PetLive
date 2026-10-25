import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useAuth } from '../../src/auth/AuthProvider';
import { carregarInteressesOng, carregarPetsOng, confirmarDisponibilidadeOng, marcarAdotadoOng, prepararRespostaOng, type ContatoOng, type CursorOng, type PainelOng, type PetOng } from '../../src/adocao/ong';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
const status: Record<string, string> = { pendente: 'Em análise', aprovada: 'Aprovada', suspensa: 'Suspensa', recusada: 'Recusada', publicado: 'Publicado', adotado: 'Adotado', rascunho: 'Rascunho', oculto: 'Oculto' };
export default function ModoOng() {
  const { user, carregando } = useAuth();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando conta" />;
  if (!user) return <Redirect href="/welcome" />;
  return <PainelDaConta key={user.id} tutorId={user.id} />;
}
function PainelDaConta({ tutorId }: { tutorId: string }) {
  const [painel, setPainel] = useState<PainelOng | null>(null), [pet, setPet] = useState<PetOng | null>(null);
  const [contatos, setContatos] = useState<ContatoOng[]>([]), [mais, setMais] = useState(false);
  const [carregando, setCarregando] = useState(true), [erro, setErro] = useState<string | null>(null), [acao, setAcao] = useState(false);
  const epoca = useRef(0), foco = useRef(false), trava = useRef(false), acaoRef = useRef(false), cursor = useRef<CursorOng | null>(null);
  const buscar = useCallback(async (selecionado: PetOng | null, proxima = false) => {
    if (proxima && trava.current) return;
    const req = ++epoca.current; trava.current = true; setCarregando(true); setErro(null);
    if (!proxima) { setMais(false); if (selecionado) setContatos([]); else setPainel(null); }
    try {
      if (selecionado) {
        const p = await carregarInteressesOng(tutorId, selecionado.id, proxima ? cursor.current : null);
        if (!foco.current || epoca.current !== req) return;
        setContatos((antes) => proxima ? [...new Map([...antes, ...p.itens].map((i) => [i.id, i])).values()] : p.itens); setMais(p.tem_mais); cursor.current = p.itens.at(-1) ?? null;
      } else {
        const p = await carregarPetsOng(tutorId, proxima ? cursor.current : null);
        if (!foco.current || epoca.current !== req) return;
        setPainel((antes) => ({ ...p, itens: proxima ? [...new Map([...(antes?.itens ?? []), ...p.itens].map((i) => [i.id, i])).values()] : p.itens })); setMais(p.tem_mais); cursor.current = p.itens.at(-1) ?? null;
      }
    } catch (e) { if (foco.current && epoca.current === req) setErro(e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { if (epoca.current === req) { trava.current = false; setCarregando(false); } }
  }, [tutorId]);
  useFocusEffect(useCallback(() => {
    foco.current = true; setPet(null); setContatos([]); setPainel(null); void buscar(null);
    return () => { foco.current = false; epoca.current += 1; trava.current = false; setContatos([]); setPainel(null); };
  }, [buscar]));
  function selecionar(p: PetOng | null) { if (acaoRef.current) return; setPet(p); setContatos([]); setMais(false); cursor.current = null; void buscar(p); }
  async function responder(c: ContatoOng) {
    if (acaoRef.current || trava.current || !pet) return;
    const inicio = epoca.current; acaoRef.current = true; setAcao(true); setErro(null);
    try {
      const url = await prepararRespostaOng(tutorId, c.id, pet.nome);
      if (!foco.current || epoca.current !== inicio) return;
      await Linking.openURL(url);
    } catch (e) { if (foco.current && epoca.current === inicio) setErro(e instanceof Error && e.message.startsWith('A conta mudou') ? e.message : 'Não foi possível abrir a resposta. Confira a conexão e se há um aplicativo de e-mail configurado. O e-mail abaixo pode ser selecionado para copiar.'); }
    finally { acaoRef.current = false; setAcao(false); }
  }
  function confirmarAdocao(p: PetOng) {
    const inicio = epoca.current;
    Alert.alert('Marcar como adotado?', `${p.nome} sairá do catálogo. Os interesses recebidos serão preservados.`, [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Marcar adotado', onPress: () => { if (foco.current && epoca.current === inicio) void adotar(p, inicio); } },
    ]);
  }
  async function adotar(p: PetOng, inicio: number) {
    if (acaoRef.current || trava.current) return; acaoRef.current = true; setAcao(true); setErro(null);
    try { await marcarAdotadoOng(tutorId, p.id); if (foco.current && epoca.current === inicio) await buscar(null); }
    catch (e) { if (foco.current && epoca.current === inicio) setErro(e instanceof Error ? e.message : 'Atualize o painel.'); }
    finally { acaoRef.current = false; setAcao(false); }
  }
  function confirmarDisponivel(p: PetOng) {
    const inicio = epoca.current;
    Alert.alert('Confirmar disponibilidade?', `Confirma que ${p.nome} continua disponível para adoção?`, [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: async () => {
        if (!foco.current || epoca.current !== inicio || acaoRef.current || trava.current) return;
        acaoRef.current = true; setAcao(true); setErro(null);
        try { await confirmarDisponibilidadeOng(tutorId, p.id); if (foco.current && epoca.current === inicio) await buscar(null); }
        catch (e) { if (foco.current && epoca.current === inicio) setErro(e instanceof Error ? e.message : 'Atualize o painel.'); }
        finally { acaoRef.current = false; setAcao(false); }
      } },
    ]);
  }
  const cabecalho = <View style={s.grupo}>
    <Text style={s.titulo}>{pet ? `Interessados em ${pet.nome}` : 'Pets e interessados'}</Text>
    {pet ? <Pressable accessibilityRole="button" disabled={acao} style={s.voltar} onPress={() => selecionar(null)}><Text style={s.texto}>← Voltar aos pets da ONG</Text></Pressable> : <>
      <Text style={s.texto}>Gerencie os pets das organizações pelas quais você é responsável. O cadastro e a aprovação de ONGs são feitos separadamente.</Text>
      <BotaoPrimario titulo="Cadastro da ONG" desabilitado={acao || carregando} onPress={() => router.push('/ong/cadastros')} />
      {painel?.ongs.map((g, i) => <View key={g.id ?? i} style={s.grupo}><Text style={s.texto}>{g.nome} · {status[g.status]}</Text>{g.status === 'aprovada' && g.id ? <BotaoPrimario titulo="Novo pet para adoção" desabilitado={acao || carregando} onPress={() => router.push({ pathname: '/ong/pet', params: { ong: g.id } })} /> : null}</View>)}
      {painel?.ongs.length === 0 ? <Text style={s.texto}>Sua conta ainda não está vinculada a uma ONG. Abra Cadastro da ONG para enviar os dados e documentos para análise.</Text> : null}
    </>}
    {pet ? <Text style={s.texto}>Responder abre seu aplicativo de e-mail. Revise e envie por lá; o PetLive não envia a mensagem nem confirma a entrega.</Text> : null}
    {erro ? <Text accessibilityRole="alert" style={s.erro}>{erro}</Text> : null}
    <BotaoPrimario titulo="Atualizar" carregando={carregando} desabilitado={acao} onPress={() => { void buscar(pet); }} />
  </View>;
  return <View style={s.tela}><CabecalhoTela titulo="Modo ONG" />
    {pet ? <FlatList data={contatos} key="contatos" keyExtractor={(i) => i.id} contentContainerStyle={s.lista} ListHeaderComponent={cabecalho}
      ListEmptyComponent={!carregando && !erro ? <Text style={s.texto}>Ainda não há interessados neste pet.</Text> : undefined}
      renderItem={({ item }) => <View style={s.card}><Text style={s.texto}>{new Date(item.criado_em).toLocaleDateString('pt-BR')}</Text><Text selectable style={s.texto}>{item.mensagem}</Text>
        {item.email_resposta ? <><Text selectable style={s.texto}>{item.email_resposta}</Text><BotaoPrimario titulo="Responder por e-mail" desabilitado={acao || carregando} onPress={() => { void responder(item); }} /></> : <Text style={s.texto}>Contato antigo sem e-mail para resposta.</Text>}</View>}
      ListFooterComponent={mais ? <BotaoPrimario titulo="Mais interessados" carregando={carregando} desabilitado={acao} onPress={() => { void buscar(pet, true); }} /> : undefined} />
      : <FlatList data={painel?.itens ?? []} key="pets" keyExtractor={(i) => i.id} contentContainerStyle={s.lista} ListHeaderComponent={cabecalho}
        ListEmptyComponent={!carregando && (painel?.ongs.length ?? 0) > 0 && !erro ? <Text style={s.texto}>Esta organização ainda não tem pets cadastrados.</Text> : undefined}
        renderItem={({ item }) => <View style={s.card}><Text style={s.titulo}>{item.nome}</Text><Text style={s.texto}>{item.ong_nome} · {status[item.status]} · {item.interesses} interesse(s)</Text>
          <Text style={s.texto}>Última confirmação: {new Date(item.confirmado_em).toLocaleDateString('pt-BR')}. Pets publicados sem confirmação há 60 dias ficam fora do catálogo.</Text>
          {item.moderacao_motivo ? <Text style={s.texto}>Última moderação: {item.moderacao_motivo}</Text> : null}
          {item.ong_status === 'aprovada' ? <><BotaoPrimario titulo="Ver interessados" desabilitado={acao || carregando} onPress={() => selecionar(item)} />
            {['rascunho', 'publicado'].includes(item.status) ? <BotaoPrimario titulo="Editar dados e fotos" desabilitado={acao || carregando} onPress={() => router.push({ pathname: '/ong/pet', params: { pet: item.id } })} /> : null}
            {item.status === 'publicado' ? <><BotaoPrimario titulo="Confirmar disponível" desabilitado={acao || carregando} onPress={() => confirmarDisponivel(item)} /><BotaoPrimario titulo="Marcar como adotado" desabilitado={acao || carregando} onPress={() => confirmarAdocao(item)} /></> : null}</> : <Text style={s.texto}>As ações ficam disponíveis quando a ONG está aprovada.</Text>}</View>}
        ListFooterComponent={mais ? <BotaoPrimario titulo="Mais pets" carregando={carregando} desabilitado={acao} onPress={() => { void buscar(null, true); }} /> : undefined} />}
  </View>;
}
const s = StyleSheet.create({ tela: { flex: 1, backgroundColor: colors.surface }, lista: { paddingHorizontal: 24, paddingBottom: 48, gap: 18 }, grupo: { gap: 14 },
  card: { padding: 18, borderRadius: 24, backgroundColor: colors.background, gap: 14 }, titulo: { ...typography.h3, color: colors.black }, texto: { ...typography.body, color: colors.textMuted }, erro: { ...typography.body, color: colors.danger }, voltar: { minHeight: 48, justifyContent: 'center' } });
