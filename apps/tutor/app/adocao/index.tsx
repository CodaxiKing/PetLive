import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { FiltrosCatalogo } from '../../src/adocao/FiltrosCatalogo';
import { FILTROS_ADOCAO, idadeAdocao, juntarPaginaAdocao, type CursorAdocao, type FiltrosAdocao, type PetAdocao } from '../../src/adocao/modelo';
import { carregarPaginaAdocao, favoritarAdocao } from '../../src/adocao/repositorio';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

export default function Adocao() {
  const { user, carregando } = useAuth();
  if (carregando) return <ActivityIndicator accessibilityLabel="Carregando sua conta" />;
  if (!user) return <Redirect href="/welcome" />;
  return <AdocaoDaConta key={user.id} tutorId={user.id} />;
}
function AdocaoDaConta({ tutorId }: { tutorId: string }) {
  const [filtros, setFiltros] = useState<FiltrosAdocao>({ ...FILTROS_ADOCAO }), [rascunho, setRascunho] = useState(filtros), [editando, setEditando] = useState(false);
  const painel = editando ? <FiltrosCatalogo valor={rascunho} alterar={setRascunho} aplicar={() => { setFiltros({ ...rascunho, cidade: rascunho.cidade.trim() }); setEditando(false); }} /> : null;
  return <View style={s.tela}><CabecalhoTela titulo="Adoção" acao={editando ? 'Fechar filtros' : 'Filtros'} onAcao={() => { if (!editando) setRascunho({ ...filtros }); setEditando(!editando); }} />
    <Catalogo key={JSON.stringify(filtros)} tutorId={tutorId} filtros={filtros} painel={painel} />
  </View>;
}
function Catalogo({ tutorId, filtros, painel }: { tutorId: string; filtros: FiltrosAdocao; painel: ReactNode }) {
  const [itens, setItens] = useState<PetAdocao[]>([]), [carregando, setCarregando] = useState(true), [paginando, setPaginando] = useState(false);
  const [mais, setMais] = useState(false), [erro, setErro] = useState<string | null>(null), [favoritando, setFavoritando] = useState<string[]>([]);
  const vida = useRef(false), epoca = useRef(0), requisicao = useRef(0), ocupado = useRef(false), cursor = useRef<CursorAdocao | null>(null), favs = useRef(new Set<string>());
  const buscar = useCallback(async (proxima = false) => {
    if (proxima && ocupado.current) return;
    const req = ++requisicao.current; ocupado.current = true;
    if (proxima) setPaginando(true); else setCarregando(true);
    setErro(null);
    try {
      const p = await carregarPaginaAdocao(tutorId, filtros, proxima ? cursor.current : null);
      if (!vida.current || requisicao.current !== req) return;
      setItens((anteriores) => proxima ? juntarPaginaAdocao(anteriores, p.itens) : p.itens); setMais(p.tem_mais);
      const ultimo = p.itens.at(-1); cursor.current = ultimo ? { criado_em: ultimo.criado_em, id: ultimo.id } : null;
    } catch (e) { if (vida.current && requisicao.current === req) setErro(e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { if (vida.current && requisicao.current === req) { ocupado.current = false; setCarregando(false); setPaginando(false); } }
  }, [tutorId, filtros]);
  useFocusEffect(useCallback(() => { vida.current = true; epoca.current += 1; void buscar(); return () => { vida.current = false; epoca.current += 1; requisicao.current += 1; ocupado.current = false; }; }, [buscar]));
  async function favorito(pet: PetAdocao) {
    if (favs.current.has(pet.id)) return;
    const inicio = epoca.current;
    favs.current.add(pet.id); setFavoritando([...favs.current]); setErro(null);
    try {
      const ativo = await favoritarAdocao(tutorId, pet.id, !pet.favorito);
      if (vida.current && epoca.current === inicio) setItens((anteriores) => anteriores.flatMap((p) => p.id !== pet.id ? [p] : filtros.favoritos && !ativo ? [] : [{ ...p, favorito: ativo }]));
    } catch (e) { if (vida.current && epoca.current === inicio) setErro(e instanceof Error ? e.message : 'Não foi possível salvar o favorito.'); }
    finally { favs.current.delete(pet.id); if (vida.current) setFavoritando([...favs.current]); }
  }
  const resumo = [filtros.especie === 'cao' ? 'Cães' : filtros.especie === 'gato' ? 'Gatos' : 'Cães e gatos', filtros.filhote ? 'até 1 ano' : null,
    filtros.porte || null, filtros.sexo === 'femea' ? 'fêmeas' : filtros.sexo === 'macho' ? 'machos' : null, filtros.cidade || 'todas as cidades', filtros.favoritos ? 'meus favoritos' : null].filter(Boolean).join(' · ');
  return <FlatList style={s.lista} contentContainerStyle={s.conteudo} data={carregando ? [] : itens} keyExtractor={(p) => p.id} keyboardShouldPersistTaps="handled"
    refreshing={carregando && itens.length > 0} onRefresh={() => { void buscar(); }}
    ListHeaderComponent={<View style={s.cabecalho}><Text style={s.titulo}>Um novo encontro começa aqui</Text><Text style={s.texto}>Pets de ONGs verificadas, com disponibilidade confirmada nos últimos 60 dias. O PetLive não vende animais nem intermedia a adoção.</Text><Text style={s.filtro}>{resumo}</Text>{painel}
      {erro ? <View style={s.aviso}><Text accessibilityRole="alert" style={s.erro}>{erro}</Text><BotaoPrimario titulo="Atualizar lista" onPress={() => { void buscar(); }} /></View> : null}</View>}
    ListEmptyComponent={carregando ? <ActivityIndicator accessibilityLabel="Carregando pets para adoção" /> : !erro ? <Text style={s.texto}>{filtros.favoritos ? 'Nenhum favorito disponível com estes filtros. Pets adotados ou sem confirmação recente deixam de aparecer.' : 'Nenhum pet disponível com estes filtros. Tente outra cidade ou amplie a seleção.'}</Text> : undefined}
    renderItem={({ item }) => <Cartao pet={item} ocupado={favoritando.includes(item.id)} favoritar={() => { void favorito(item); }} />}
    ListFooterComponent={!carregando && mais ? <BotaoPrimario titulo="Carregar mais pets" carregando={paginando} onPress={() => { void buscar(true); }} /> : undefined} />;
}
function Cartao({ pet, ocupado, favoritar }: { pet: PetAdocao; ocupado: boolean; favoritar: () => void }) {
  const [expandido, setExpandido] = useState(false), [fotoFalhou, setFotoFalhou] = useState<string | null>(null);
  return <View style={s.card}>{pet.fotos[0] && fotoFalhou !== pet.fotos[0] ? <Image source={{ uri: pet.fotos[0] }} accessibilityLabel={`Foto de ${pet.nome}`} style={s.foto} resizeMode="cover" onError={() => setFotoFalhou(pet.fotos[0])} /> : <View style={[s.foto, s.semFoto]}><Text style={s.texto}>Foto não disponível</Text></View>}
    <View style={s.dados}><Text style={s.titulo}>{pet.nome}</Text><Text style={s.texto}>{pet.especie === 'cao' ? 'Cão' : 'Gato'} · {idadeAdocao(pet.nascimento)} · {pet.porte}{pet.sexo === 'nao_informado' ? '' : ` · ${pet.sexo === 'femea' ? 'fêmea' : 'macho'}`}</Text>
      <Text style={s.texto}>{pet.bairro}, {pet.cidade}</Text><Text style={s.filtro}>{pet.ong_nome} · ONG verificada</Text>
      <BotaoPrimario titulo="Ver ficha e interesse" onPress={() => router.push({ pathname: '/adocao/[id]', params: { id: pet.id } })} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${pet.favorito ? 'Remover' : 'Adicionar'} ${pet.nome} ${pet.favorito ? 'dos' : 'aos'} favoritos`} accessibilityState={{ selected: pet.favorito, disabled: ocupado }} disabled={ocupado} onPress={favoritar} style={[s.acao, pet.favorito && s.ativo]}><Text style={s.filtro}>{ocupado ? 'Salvando…' : pet.favorito ? '♥ Favoritado' : '♡ Favoritar'}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expandido }} onPress={() => setExpandido(!expandido)} style={s.acao}><Text style={s.filtro}>{expandido ? 'Recolher informações' : `Sobre ${pet.nome}`}</Text></Pressable>
      {expandido ? <><Text style={s.texto}>{pet.descricao}</Text><Text style={s.texto}>{[['Castrado', pet.castrado], ['Vacinado', pet.vacinado], ['Vermifugado', pet.vermifugado]].map(([rotulo, valor]) => `${rotulo}: ${valor === null ? 'não informado' : valor ? 'sim' : 'não'}`).join(' · ')}</Text><Text style={s.texto}>Informações fornecidas pela ONG. Confirme os cuidados e a disponibilidade com ela.</Text></> : null}
    </View></View>;
}
const s = StyleSheet.create({ tela: { flex: 1, backgroundColor: colors.surface }, lista: { flex: 1 }, conteudo: { paddingHorizontal: 24, paddingBottom: 40, gap: 18 },
  cabecalho: { gap: 14, paddingBottom: 8 }, titulo: { ...typography.h3, color: colors.black }, texto: { ...typography.body, color: colors.textMuted },
  filtro: { ...typography.body, fontWeight: '700', color: colors.black }, aviso: { gap: 12 }, erro: { ...typography.body, color: colors.danger },
  card: { backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden' }, dados: { padding: 18, gap: 10 }, foto: { width: '100%', height: 220, backgroundColor: colors.hero },
  semFoto: { justifyContent: 'center', alignItems: 'center' }, acao: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 12 }, ativo: { backgroundColor: colors.hero } });
