import * as Crypto from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { conferirContaOng, conferirPaginaOng, type CursorOng } from './ong';
export const TIPOS_DOCUMENTO = ['estatuto','comprovante','responsavel'] as const;
export type TipoDocumentoOng = typeof TIPOS_DOCUMENTO[number];
export type DadosCadastroOng = { cnpj: string; nome: string; cidade: string; bairro: string; responsavel_nome: string; email: string; telefone: string; documentos: Partial<Record<TipoDocumentoOng,string>> };
export type CadastroOng = DadosCadastroOng & { id: string; versao: number; status: 'rascunho'|'enviado'; criado_em: string; ong_status: string|null; correcao_motivo?: string|null };
export const CADASTRO_ONG_VAZIO: DadosCadastroOng = { cnpj:'',nome:'',cidade:'',bairro:'',responsavel_nome:'',email:'',telefone:'',documentos:{} };
export const normalizarCnpj = (v:string) => v.trim().toUpperCase().replace(/[.\s\/-]/g,'');
export function cnpjValido(valor:string) {
 const v=normalizarCnpj(valor); if(!/^[A-Z0-9]{12}\d{2}$/.test(v)||/^(\d)\1{13}$/.test(v))return false;
 let base=v.slice(0,12);
 for(let etapa=0;etapa<2;etapa++){let soma=0;for(let i=0;i<base.length;i++)soma+=(base.charCodeAt(i)-48)*((base.length-1-i)%8+2);const resto=soma%11,dv=resto<2?0:11-resto;if(v[12+etapa]!==String(dv))return false;base+=dv;}
 return true;
}
export function dadosCadastroOng(d:DadosCadastroOng):DadosCadastroOng {
 return {cnpj:normalizarCnpj(d.cnpj),nome:d.nome.trim(),cidade:d.cidade.trim(),bairro:d.bairro.trim(),responsavel_nome:d.responsavel_nome.trim(),email:d.email.trim().toLowerCase(),telefone:d.telefone.replace(/[\s()+-]/g,''),documentos:{...d.documentos}};
}
export function validarCadastroOng(d:DadosCadastroOng,enviar=false,concordo=false) {
 const v=dadosCadastroOng(d);
 if(!cnpjValido(v.cnpj))throw new Error('Informe um CNPJ válido, numérico ou alfanumérico.');
 for(const [campo,max] of [['nome',100],['cidade',80],['bairro',80],['responsavel_nome',100]] as const)if(v[campo].length<2||v[campo].length>max)throw new Error('Preencha nome da ONG, cidade, bairro e nome do responsável com pelo menos 2 caracteres.');
 if(v.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw new Error('Informe um e-mail válido para contato.');
 if(!/^\d{10,13}$/.test(v.telefone))throw new Error('Informe um telefone com DDD, de 10 a 13 dígitos.');
 if(enviar&&TIPOS_DOCUMENTO.some(k=>!v.documentos[k]))throw new Error('Anexe os três documentos antes de enviar.');
 if(enviar&&!concordo)throw new Error('Confirme o envio dos dados e documentos para análise.');
 return v;
}
export function conferirCadastroOng(valor:unknown):CadastroOng {
 const c=valor as CadastroOng;
 if(!c||typeof c.id!=='string'||['cnpj','nome','cidade','bairro','responsavel_nome','email','telefone'].some(k=>typeof (c as unknown as Record<string,unknown>)[k]!=='string')||!Number.isSafeInteger(c.versao)||c.versao<1||!['rascunho','enviado'].includes(c.status)||!Number.isFinite(Date.parse(c.criado_em))||!c.documentos||typeof c.documentos!=='object'||Array.isArray(c.documentos)||Object.entries(c.documentos).some(([k,v])=>!TIPOS_DOCUMENTO.includes(k as TipoDocumentoOng)||typeof v!=='string')||![null,'pendente','aprovada','suspensa','recusada'].includes(c.ong_status))throw new Error('Cadastro recebido incompleto. Atualize a tela.');
 if(c.correcao_motivo!==undefined&&c.correcao_motivo!==null&&(typeof c.correcao_motivo!=='string'||c.correcao_motivo.trim().length<5||c.correcao_motivo.length>500))throw new Error('Motivo da correção inválido. Atualize o cadastro.');
 validarCadastroOng(c); return c;
}
async function chamar(tutor:string,nome:string,args:Record<string,unknown>) {
 await conferirContaOng(tutor);const {data,error}=await supabase.rpc(nome,{p_tutor:tutor,...args});await conferirContaOng(tutor);
 if(error)throw new Error(['Cadastro indisponível','Este cadastro já','O cadastro foi alterado','Este CNPJ já','Um documento','Anexe os três','Confirme o envio'].some(v=>error.message.startsWith(v))?error.message:'Não foi possível confirmar o cadastro. Atualize para conferir antes de tentar novamente.');return data;
}
export async function obterCadastroOng(tutor:string,id:string) {const c=conferirCadastroOng(await chamar(tutor,'ong_cadastro_obter',{p_id:id}));if(c.id!==id)throw new Error('Cadastro recebido não corresponde a esta ficha.');return c;}
export async function salvarCadastroOng(tutor:string,id:string,versao:number,dados:DadosCadastroOng,enviar=false,concordo=false) {
 const d=validarCadastroOng(dados,enviar,concordo);const c=conferirCadastroOng(await chamar(tutor,'ong_cadastro_salvar',{p_id:id,p_versao:versao,p_dados:d,p_enviar:enviar,p_concordo:concordo}));if(c.id!==id)throw new Error('Cadastro recebido não corresponde a esta ficha.');return c;
}
export type ResumoCadastroOng=CursorOng & {nome:string;status:'rascunho'|'enviado';ong_status:string|null};
export async function listarCadastrosOng(tutor:string,cursor:CursorOng|null=null) {
 return conferirPaginaOng<ResumoCadastroOng>(await chamar(tutor,'ong_cadastros_listar',{p_antes:cursor?.criado_em??null,p_antes_id:cursor?.id??null}),c=>typeof c.id==='string'&&typeof c.nome==='string'&&['rascunho','enviado'].includes(c.status)&&Number.isFinite(Date.parse(c.criado_em))&&[null,'pendente','aprovada','recusada','suspensa'].includes(c.ong_status));
}
export async function enviarDocumentoOng(tutor:string,id:string,tipo:TipoDocumentoOng,arquivo:{uri:string;mimeType?:string;size?:number}) {
 const tipos:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 const mime=arquivo.mimeType??'';if(!tipos[mime])throw new Error('Escolha PDF, JPEG, PNG ou WebP.');
 if(arquivo.size!==undefined&&(arquivo.size<=0||arquivo.size>10485760))throw new Error('O documento deve ter até 10 MB.');
 await conferirContaOng(tutor);const bytes=await(await fetch(arquivo.uri)).arrayBuffer();if(!bytes.byteLength||bytes.byteLength>10485760)throw new Error('O documento deve ter até 10 MB.');
 await conferirContaOng(tutor);const caminho=`${tutor}/${id}-${tipo}-${Crypto.randomUUID()}.${tipos[mime]}`;
 const {error}=await supabase.storage.from('ong-documentos').upload(caminho,bytes,{contentType:mime,upsert:false});
 if(error)throw new Error('Não foi possível enviar o documento. Confira se o rascunho continua editável e tente novamente.');
 await conferirContaOng(tutor);return caminho;
}
