import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../src/auth/AuthProvider';
import { BotaoPrimario } from '../../../src/components/BotaoPrimario';
import { HeroiOnda } from '../../../src/components/HeroiOnda';
import { carregarLembrancasAlbum, chaveLembranca, fotosAlbum, lembrancasDoAno, LIMITE_ALBUM, montarAlbum, selecaoInicialAlbum } from '../../../src/pets/albumAnual';
import type { ItemLinha } from '../../../src/pets/linhaDoTempo';
import { usePets } from '../../../src/pets/PetsProvider';
import { colors } from '../../../src/theme/colors';
import { fontFamily } from '../../../src/theme/typography';

export default function AlbumAnual() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { pets, petsMemoria } = usePets();
  const pet = [...pets, ...petsMemoria].find(p => p.id === id && p.tutor_id === user?.id);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [itens, setItens] = useState<ItemLinha[]>([]);
  const [escolhidas, setEscolhidas] = useState<Set<string>>(new Set());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [previa, setPrevia] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dono, setDono] = useState('');
  const token = useRef(0);
  const identidade = `${user?.id}/${id}`;

  const carregar = useCallback(() => {
    const atual = ++token.current;
    setItens([]); setUrls({}); setPrevia(false); setErro(null); setCarregando(true); setEscolhidas(new Set());
    if (!user || !id) { setCarregando(false); return; }
    carregarLembrancasAlbum(user.id, id).then(lista => {
      if (atual !== token.current) return;
      setItens(lista); setDono(identidade); setEscolhidas(selecaoInicialAlbum(lista, new Date().getFullYear()));
      setAno(new Date().getFullYear());
    }).catch(e => { if (atual === token.current) setErro(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (atual === token.current) setCarregando(false); });
    return () => { token.current++; };
  }, [user, id, identidade]);
  useFocusEffect(carregar);

  const lista = dono === identidade ? lembrancasDoAno(itens, ano) : [];
  const anos = [...new Set([new Date().getFullYear(), ...itens.filter(i => /^\d{4}-/.test(i.data)).map(i => Number(i.data.slice(0, 4)))])].sort((a,b) => b-a);
  function trocarAno(valor: number) {
    token.current++; setAno(valor); setEscolhidas(selecaoInicialAlbum(itens, valor)); setPrevia(false); setUrls({});
  }
  async function abrirPrevia() {
    if (!user || carregando) return;
    let paginas: ItemLinha[];
    try { paginas = montarAlbum(itens, ano, escolhidas); }
    catch (e) { Alert.alert('Monte seu álbum', e instanceof Error ? e.message : String(e)); return; }
    const atual = ++token.current;
    setCarregando(true); setErro(null);
    try {
      const fotos = await fotosAlbum(user.id, paginas);
      if (atual === token.current) { setUrls(fotos); setPrevia(true); }
    } catch (e) { if (atual === token.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (atual === token.current) setCarregando(false); }
  }
  function alternar(item: ItemLinha) {
    const chave = chaveLembranca(item);
    if (!escolhidas.has(chave) && escolhidas.size >= LIMITE_ALBUM) { Alert.alert('Álbum completo', `Escolha até ${LIMITE_ALBUM} lembranças.`); return; }
    setEscolhidas(atual => { const novo = new Set(atual); if (novo.has(chave)) novo.delete(chave); else novo.add(chave); return novo; });
  }
  if (!pet) return <View style={s.tela}><HeroiOnda titulo="Álbum do ano" subtitulo="Pet" /><Text style={s.texto}>Escolha um pet disponível nesta conta.</Text></View>;
  return <View style={s.tela}>
    <HeroiOnda titulo="Álbum do ano" subtitulo={pet.nome} altura={190} />
    <FlatList key={previa ? 'previa' : 'selecao'} data={previa ? lista.filter(i => escolhidas.has(chaveLembranca(i))) : lista}
      keyExtractor={chaveLembranca} contentContainerStyle={s.conteudo}
      ListHeaderComponent={<View style={s.gap}>
        <Text style={s.texto}>Escolha as lembranças do ano. Registros de saúde só entram se você selecionar. A prévia fica privada no app.</Text>
        <View style={s.anos}>{anos.map(a => <Pressable key={a} accessibilityRole="radio" accessibilityState={{selected: a===ano,disabled:carregando}} disabled={carregando} onPress={() => trocarAno(a)} style={[s.ano,a===ano && s.ativo]}><Text style={a===ano ? s.branco : s.texto}>{a}</Text></Pressable>)}</View>
        <Text style={s.titulo}>{previa ? `${pet.nome} · ${ano}` : `${escolhidas.size} de ${LIMITE_ALBUM} lembranças selecionadas`}</Text>
        {erro && <Text accessibilityRole="alert" style={s.erro}>{erro}</Text>}
        {erro && <BotaoPrimario titulo="Tentar novamente" onPress={() => { carregar(); }} />}
        {carregando && <ActivityIndicator accessibilityLabel="Carregando álbum" />}
        <BotaoPrimario titulo={previa ? 'Editar seleção' : 'Ver prévia'} carregando={carregando} desabilitado={!previa && !escolhidas.size} onPress={previa ? () => {setPrevia(false);setUrls({});} : abrirPrevia} />
      </View>}
      ListEmptyComponent={!carregando && !erro ? <Text style={s.texto}>Nenhuma lembrança neste ano. Escolha outro ano ou registre um marco na linha do tempo.</Text> : undefined}
      renderItem={({item,index}) => <View style={s.pagina}>
        {previa ? <Text style={s.texto}>Página {index+1}</Text> : <Pressable accessibilityRole="checkbox" accessibilityLabel={`Incluir ${item.titulo}, ${item.data.split('-').reverse().join('/')}`} accessibilityState={{checked:escolhidas.has(chaveLembranca(item)),disabled:carregando}} disabled={carregando} onPress={()=>alternar(item)} style={s.seletor}><Text style={s.titulo}>{escolhidas.has(chaveLembranca(item)) ? '✓ Selecionada' : '+ Incluir lembrança'}</Text></Pressable>}
        <Text style={s.texto}>{item.data.split('-').reverse().join('/')}</Text>
        <Text style={s.titulo}>{item.titulo}</Text>
        {item.descricao && <Text style={s.texto}>{item.descricao}</Text>}
        {previa && item.foto_path && (urls[item.foto_path] ? <FotoAlbum uri={urls[item.foto_path]} titulo={item.titulo} /> : <Text style={s.texto}>Foto indisponível. Atualize a prévia para tentar novamente.</Text>)}
      </View>}
      ListFooterComponent={<Text style={s.texto}>Prévia digital. Impressão, frete, pagamento e envio à gráfica ainda não estão disponíveis.</Text>} />
  </View>;
}
function FotoAlbum({uri,titulo}:{uri:string;titulo:string}) {
  const [falhou,setFalhou]=useState(false);
  return falhou ? <Text style={s.texto}>Não foi possível exibir esta foto. Reabra a prévia para renovar o acesso.</Text> : <Image source={{uri}} accessibilityLabel={`Foto: ${titulo}`} resizeMode="contain" style={s.foto} onError={()=>setFalhou(true)} />;
}
const s=StyleSheet.create({tela:{flex:1,backgroundColor:colors.background},conteudo:{padding:24,gap:16,paddingBottom:40},gap:{gap:16},anos:{flexDirection:'row',flexWrap:'wrap',gap:8},ano:{padding:14,borderRadius:20,backgroundColor:'#E0F1FA',minHeight:48},ativo:{backgroundColor:colors.black},branco:{color:'#FFFFFF',fontFamily:fontFamily.bold,fontSize:16},texto:{fontFamily:fontFamily.regular,fontSize:16,lineHeight:24,color:colors.text},titulo:{fontFamily:fontFamily.bold,fontSize:20,lineHeight:28,color:colors.text},pagina:{backgroundColor:'#FFF0C9',padding:20,borderRadius:24,gap:12},seletor:{minHeight:48,justifyContent:'center'},foto:{width:'100%',height:280},erro:{color:'#9D1739',fontSize:16,lineHeight:24}});
