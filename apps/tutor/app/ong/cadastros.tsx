import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { listarCadastrosOng, type ResumoCadastroOng } from '../../src/adocao/cadastroOng';
import type { CursorOng } from '../../src/adocao/ong';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
export default function CadastrosOng(){const {user,carregando}=useAuth();if(carregando)return <ActivityIndicator accessibilityLabel="Carregando conta"/>;if(!user)return <Redirect href="/welcome"/>;return <DaConta key={user.id} tutor={user.id}/>;}
function DaConta({tutor}:{tutor:string}){
 const [itens,setItens]=useState<ResumoCadastroOng[]>([]),[mais,setMais]=useState(false),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState<string|null>(null);
 const foco=useRef(false),req=useRef(0),trava=useRef(false),cursor=useRef<CursorOng|null>(null);
 const buscar=useCallback(async(proxima=false)=>{
  if(proxima&&trava.current)return;const r=++req.current;trava.current=true;setOcupado(true);setErro(null);if(!proxima){setItens([]);setMais(false);}
  try{const p=await listarCadastrosOng(tutor,proxima?cursor.current:null);if(foco.current&&req.current===r){setItens(a=>proxima?[...new Map([...a,...p.itens].map(i=>[i.id,i])).values()]:p.itens);setMais(p.tem_mais);cursor.current=p.itens.at(-1)??null;}}
  catch(e){if(foco.current&&req.current===r)setErro(e instanceof Error?e.message:'Tente novamente.');}
  finally{if(req.current===r){trava.current=false;setOcupado(false);}}
 },[tutor]);
 useFocusEffect(useCallback(()=>{foco.current=true;void buscar();return()=>{foco.current=false;req.current++;trava.current=false;setItens([]);};},[buscar]));
 const status:Record<string,string>={pendente:'Em análise',aprovada:'Aprovada',recusada:'Recusada',suspensa:'Suspensa'};
 return <View style={s.tela}><CabecalhoTela titulo="Cadastros de ONG"/><FlatList contentContainerStyle={s.lista} data={itens} keyExtractor={i=>i.id}
 ListHeaderComponent={<View style={s.grupo}><Text style={s.texto}>Dados e documentos ficam privados. A equipe administrativa analisa o cadastro antes de liberar a publicação de pets.</Text><BotaoPrimario titulo="Cadastrar organização" onPress={()=>router.push('/ong/cadastro')}/><BotaoPrimario titulo="Atualizar lista" carregando={ocupado} onPress={()=>{void buscar();}}/>{erro?<Text accessibilityRole="alert" style={s.erro}>{erro}</Text>:null}</View>}
 ListEmptyComponent={!ocupado&&!erro?<Text style={s.texto}>Você ainda não possui cadastros de ONG.</Text>:undefined}
 renderItem={({item})=><View style={s.card}><Text style={s.titulo}>{item.nome}</Text><Text style={s.texto}>{item.status==='rascunho'?'Rascunho':status[item.ong_status??'pendente']??'Enviado'} · {new Date(item.criado_em).toLocaleDateString('pt-BR')}</Text><BotaoPrimario titulo={item.status==='rascunho'?'Continuar cadastro':'Consultar cadastro'} onPress={()=>router.push({pathname:'/ong/cadastro',params:{id:item.id}})}/></View>}
 ListFooterComponent={mais?<BotaoPrimario titulo="Carregar mais" carregando={ocupado} onPress={()=>{void buscar(true);}}/>:undefined}/></View>;
}
const s=StyleSheet.create({tela:{flex:1,backgroundColor:colors.surface},lista:{paddingHorizontal:24,paddingBottom:48,gap:18},grupo:{gap:14},card:{padding:18,borderRadius:24,backgroundColor:colors.background,gap:14},texto:{...typography.body,color:colors.textMuted},titulo:{...typography.h3,color:colors.black},erro:{...typography.body,color:colors.danger}});
