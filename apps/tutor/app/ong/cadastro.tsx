import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useAuth } from '../../src/auth/AuthProvider';
import { CADASTRO_ONG_VAZIO, dadosCadastroOng, enviarDocumentoOng, obterCadastroOng, salvarCadastroOng, TIPOS_DOCUMENTO, type CadastroOng, type DadosCadastroOng, type TipoDocumentoOng } from '../../src/adocao/cadastroOng';
import { BotaoPrimario } from '../../src/components/BotaoPrimario';
import { CabecalhoTela } from '../../src/components/CabecalhoTela';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
const rotulos={estatuto:'Estatuto da organização',comprovante:'Comprovante da organização',responsavel:'Documento do responsável'};
const nomes:Record<string,string>={pendente:'Em análise',aprovada:'Aprovada',recusada:'Recusada',suspensa:'Suspensa'};
export default function CadastroDaOng(){
 const {user,carregando}=useAuth();const {id}=useLocalSearchParams<{id?:string}>();
 if(carregando)return <ActivityIndicator accessibilityLabel="Carregando conta"/>;
 if(!user)return <Redirect href="/welcome"/>;
 if(id!==undefined&&(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id)))return <View><CabecalhoTela titulo="Cadastro da ONG"/><Text>Link inválido. Volte aos cadastros.</Text></View>;
 return <Formulario key={`${user.id}:${id??'novo'}`} tutor={user.id} inicial={id}/>;
}
function Formulario({tutor,inicial}:{tutor:string;inicial?:string}){
 const [id]=useState(()=>inicial??Crypto.randomUUID()),[versao,setVersao]=useState(0),[registro,setRegistro]=useState<CadastroOng|null>(null);
 const [dados,setDados]=useState<DadosCadastroOng>(()=>({...CADASTRO_ONG_VAZIO,documentos:{}})),[concordo,setConcordo]=useState(false);
 const [ocupado,setOcupado]=useState(false),[erro,setErro]=useState<string|null>(null),[aviso,setAviso]=useState<string|null>(null);
 const foco=useRef(false),epoca=useRef(0),trava=useRef(false);
 const aplicar=useCallback((c:CadastroOng)=>{setRegistro(c);setVersao(c.versao);setDados(dadosCadastroOng(c));setConcordo(false);},[]);
 const carregar=useCallback(async()=>{
  if(trava.current)return;const req=epoca.current;trava.current=true;setOcupado(true);setErro(null);setAviso(null);
  try{const c=await obterCadastroOng(tutor,id);if(foco.current&&req===epoca.current)aplicar(c);}catch(e){if(foco.current&&req===epoca.current)setErro(e instanceof Error?e.message:'Tente novamente.');}
  finally{if(req===epoca.current){trava.current=false;setOcupado(false);}}
 },[tutor,id,aplicar]);
 useFocusEffect(useCallback(()=>{foco.current=true;if(inicial)void carregar();return()=>{foco.current=false;epoca.current++;trava.current=false;setOcupado(false);};},[carregar,inicial]));
 const enviado=registro?.status==='enviado';
 const alterar=(k:keyof DadosCadastroOng,v:string)=>{setDados(d=>({...d,[k]:v}));setAviso(null);setConcordo(false);};
 async function salvar(enviar=false){
  if(trava.current)return;const req=epoca.current;trava.current=true;setOcupado(true);setErro(null);setAviso(null);
  try{const c=await salvarCadastroOng(tutor,id,versao,dados,enviar,concordo);if(foco.current&&req===epoca.current){aplicar(c);setAviso(c.status==='enviado'?'Cadastro enviado para análise. A publicação de pets depende da aprovação.':'Rascunho salvo. Anexe os documentos e envie para análise.');}}
  catch(e){if(foco.current&&req===epoca.current)setErro(e instanceof Error?e.message:'Não foi possível salvar.');}
  finally{if(req===epoca.current){trava.current=false;setOcupado(false);}}
 }
 async function anexar(tipo:TipoDocumentoOng){
  if(trava.current||!versao||enviado)return;const req=epoca.current;trava.current=true;setOcupado(true);setErro(null);setAviso(null);let uri:string|undefined;
  try{
   const r=await DocumentPicker.getDocumentAsync({type:['application/pdf','image/jpeg','image/png','image/webp'],copyToCacheDirectory:true,multiple:false});
   if(r.canceled)return;uri=r.assets[0].uri;if(!foco.current||req!==epoca.current)return;
   const caminho=await enviarDocumentoOng(tutor,id,tipo,r.assets[0]);
   if(foco.current&&req===epoca.current){setDados(d=>({...d,documentos:{...d.documentos,[tipo]:caminho}}));setConcordo(false);setAviso('Documento anexado. Salve o rascunho ou envie para análise para confirmar a inclusão.');}
  }catch(e){if(foco.current&&req===epoca.current)setErro(e instanceof Error?e.message:'Não foi possível anexar.');}
  finally{try{if(uri&&uri.startsWith(Paths.cache.uri))new File(uri).delete();}catch{/* Cache será limpo pelo sistema. */}if(req===epoca.current){trava.current=false;setOcupado(false);}}
 }
 function campo(k:Exclude<keyof DadosCadastroOng,'documentos'>,rotulo:string,max:number){return <View style={s.grupo}><Text style={s.rotulo}>{rotulo}</Text><TextInput accessibilityLabel={rotulo} value={dados[k]} editable={!ocupado&&!enviado} maxLength={max} autoCapitalize={k==='cnpj'?'characters':k==='email'?'none':'words'} keyboardType={k==='email'?'email-address':k==='telefone'?'phone-pad':'default'} autoCorrect={false} onChangeText={v=>alterar(k,v)} style={s.campo}/></View>;}
 if(inicial&&!versao)return <View style={s.tela}><CabecalhoTela titulo="Cadastro da ONG"/><View style={s.conteudo}><Text accessibilityRole={erro?'alert':undefined} style={s.texto}>{erro??'Carregando cadastro…'}</Text><BotaoPrimario titulo="Atualizar" carregando={ocupado} onPress={()=>{void carregar();}}/></View></View>;
 return <KeyboardAvoidingView style={s.tela} behavior={Platform.OS==='ios'?'padding':undefined}><CabecalhoTela titulo="Cadastro da ONG"/><ScrollView contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled">
  <Text style={s.texto}>{enviado?`Situação: ${nomes[registro?.ong_status??'pendente']??'Em análise'}. Dados e documentos enviados não podem ser alterados por este formulário.`:'Preencha os dados e salve um rascunho. Depois anexe os três documentos e envie para análise. Validar o CNPJ não confirma a existência ou aprovação da ONG.'}</Text>
  {registro?.correcao_motivo && !enviado ? <View style={s.grupo}><Text style={s.rotulo}>Correções solicitadas</Text><Text style={s.texto}>{registro.correcao_motivo}</Text><Text style={s.texto}>Revise os dados e documentos e envie novamente para análise. A ONG continua sem aprovação até a nova decisão.</Text></View> : null}
  {campo('cnpj','CNPJ (aceita letras e números)',18)}{campo('nome','Nome da organização',100)}{campo('cidade','Cidade',80)}{campo('bairro','Bairro',80)}{campo('responsavel_nome','Nome do responsável',100)}{campo('email','E-mail de contato',254)}{campo('telefone','Telefone com DDD',20)}
  <Text style={s.rotulo}>Documentos privados · PDF, JPEG, PNG ou WebP · até 10 MB cada</Text><Text style={s.texto}>Envie arquivos completos e legíveis. Os documentos não aparecem no catálogo público; serão usados na análise administrativa do cadastro.</Text>
  {TIPOS_DOCUMENTO.map(tipo=><View key={tipo} style={s.grupo}><Text style={s.rotulo}>{rotulos[tipo]}</Text><Text style={s.texto}>{dados.documentos[tipo]?'Arquivo anexado':'Nenhum arquivo anexado'}</Text>{!enviado?<BotaoPrimario titulo={dados.documentos[tipo]?'Substituir documento':'Anexar documento'} desabilitado={ocupado||!versao} onPress={()=>{void anexar(tipo);}}/>:null}</View>)}
  {!versao?<Text style={s.texto}>Salve o rascunho antes de anexar documentos.</Text>:null}
  {erro?<Text accessibilityRole="alert" style={s.erro}>{erro}</Text>:null}{aviso?<Text accessibilityRole="alert" style={s.texto}>{aviso}</Text>:null}
  {!enviado?<><BotaoPrimario titulo="Salvar rascunho" carregando={ocupado} onPress={()=>{void salvar();}}/><Pressable accessibilityRole="checkbox" accessibilityState={{checked:concordo,disabled:ocupado}} disabled={ocupado} onPress={()=>setConcordo(!concordo)} style={s.opcao}><Text style={s.texto}>{concordo?'☑':'☐'} Confirmo que posso representar esta organização e enviar estes dados e documentos para a análise administrativa do PetLive.</Text></Pressable><BotaoPrimario titulo="Enviar para análise" desabilitado={ocupado||!versao||!concordo} onPress={()=>{const req=epoca.current;Alert.alert('Enviar cadastro?','Confira os dados e documentos. Após enviar, este formulário fica bloqueado durante a análise.',[{text:'Cancelar',style:'cancel'},{text:'Enviar',onPress:()=>{if(foco.current&&req===epoca.current)void salvar(true);}}]);}}/></>:null}
  <BotaoPrimario titulo="Atualizar cadastro" desabilitado={ocupado} onPress={()=>Alert.alert('Atualizar cadastro?','Descartar alterações não salvas e consultar o servidor?',[{text:'Cancelar',style:'cancel'},{text:'Atualizar',onPress:()=>{if(foco.current)void carregar();}}])}/>
 </ScrollView></KeyboardAvoidingView>;
}
const s=StyleSheet.create({tela:{flex:1,backgroundColor:colors.background},conteudo:{paddingHorizontal:24,paddingBottom:48,gap:18},grupo:{gap:8},rotulo:{...typography.body,fontWeight:'700',color:colors.black},texto:{...typography.body,color:colors.textMuted},erro:{...typography.body,color:colors.danger},campo:{...typography.body,color:colors.black,borderWidth:1,borderColor:colors.border,borderRadius:16,padding:14,minHeight:48,backgroundColor:colors.background},opcao:{minHeight:48,paddingVertical:12}});
