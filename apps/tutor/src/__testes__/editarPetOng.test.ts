import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conferirEdicaoPetOng, dadosDaEdicao, enviarFotoOng, NOVO_PET_ONG, obterPetOng, salvarPetOng, validarPetOng } from '../adocao/editarPetOng';
const m=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),upload:vi.fn(),from:vi.fn(),publicUrl:vi.fn()}));
vi.mock('expo-crypto',()=>({randomUUID:()=> 'foto'}));
vi.mock('../lib/supabase',()=>({supabase:{auth:{getUser:m.user},rpc:m.rpc,storage:{from:m.from}}}));
const dados={...NOVO_PET_ONG,nome:'Mia',descricao:'Calma'},pet={...dados,id:'p',ong_id:'g',versao:1,criado_em:'2026-10-24T12:00:00Z'};
beforeEach(()=>{vi.resetAllMocks();m.user.mockResolvedValue({data:{user:{id:'a'}},error:null});m.rpc.mockResolvedValue({data:pet,error:null});m.from.mockReturnValue({upload:m.upload,getPublicUrl:m.publicUrl});m.upload.mockResolvedValue({error:null});m.publicUrl.mockReturnValue({data:{publicUrl:'https://projeto.supabase.co/foto.jpg'}});vi.stubGlobal('fetch',vi.fn().mockResolvedValue({arrayBuffer:async()=>new ArrayBuffer(100)}));});
afterEach(()=>vi.unstubAllGlobals());
describe('edição de pet da ONG',()=>{
 it('valida nome, descrição, nascimento civil, fotos e publicação',()=>{
  expect(()=>validarPetOng(dados)).not.toThrow();
  for(const d of [{...dados,nome:' '},{...dados,descricao:''},{...dados,nascimento:'2025-02-30'},{...dados,nascimento:'2999-01-01'},{...dados,status:'publicado' as const},{...dados,fotos:Array(7).fill('https://x.com/f.jpg')}])expect(()=>validarPetOng(d)).toThrow();
  expect(dadosDaEdicao(pet)).not.toHaveProperty('ong_id');expect(()=>conferirEdicaoPetOng({...pet,status:'oculto'})).toThrow();
 });
 it('envia somente dados editáveis com versão e ONG esperada',async()=>{
  await salvarPetOng('a','p','g',0,dados);
  expect(m.rpc).toHaveBeenCalledWith('ong_pet_salvar',{p_tutor:'a',p_pet:'p',p_ong:'g',p_versao:0,p_dados:dados});
  m.rpc.mockResolvedValueOnce({data:{...pet,id:'outro'},error:null});await expect(obterPetOng('a','p')).rejects.toThrow('não corresponde');
 });
 it('recusa conta trocada após o salvamento e preserva conflito do servidor',async()=>{
  m.user.mockResolvedValueOnce({data:{user:{id:'a'}},error:null}).mockResolvedValueOnce({data:{user:{id:'b'}},error:null});
  await expect(salvarPetOng('a','p','g',1,dados)).rejects.toThrow('conta mudou');
  m.rpc.mockResolvedValueOnce({data:null,error:{message:'Este pet foi alterado. Atualize a ficha antes de salvar.'}});await expect(salvarPetOng('a','p','g',1,dados)).rejects.toThrow('foi alterado');
 });
 it('envia foto imutável na pasta plana do tutor, compatível com limpeza LGPD',async()=>{
  expect(await enviarFotoOng('a','p',{uri:'file:///foto',mimeType:'image/png'})).toContain('https:');
  expect(m.upload).toHaveBeenCalledWith('a/p-foto.png',expect.any(ArrayBuffer),{contentType:'image/png',upsert:false});
 });
 it('não envia formato inválido, foto vazia/grande ou foto de outra conta',async()=>{
  await expect(enviarFotoOng('a','p',{uri:'file:///x',mimeType:'video/mp4'})).rejects.toThrow('JPEG');
  for(const n of [0,5*1024*1024+1]){vi.stubGlobal('fetch',vi.fn().mockResolvedValue({arrayBuffer:async()=>new ArrayBuffer(n)}));await expect(enviarFotoOng('a','p',{uri:'file:///x'})).rejects.toThrow('5 MB');}
  m.user.mockResolvedValueOnce({data:{user:{id:'b'}},error:null});await expect(enviarFotoOng('a','p',{uri:'file:///x'})).rejects.toThrow('conta mudou');expect(m.upload).not.toHaveBeenCalled();
 });
 it('mantém upload falho como erro, sem URL de sucesso',async()=>{m.upload.mockResolvedValueOnce({error:{message:'falha'}});await expect(enviarFotoOng('a','p',{uri:'file:///x'})).rejects.toThrow('enviar');expect(m.publicUrl).not.toHaveBeenCalled();});
});
