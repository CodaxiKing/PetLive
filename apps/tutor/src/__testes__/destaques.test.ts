import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conferirDestaques, consultarDestaques, destaqueVigente } from '../mapa/destaques';
const m=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('../lib/supabase',()=>({supabase:{rpc:m.rpc}}));
const hora=Date.parse('2026-10-25T00:00:00Z');
beforeEach(()=>vi.resetAllMocks());
describe('destaques pagos de lugares',()=>{
 it('exige prazo numérico próprio e vigente, sem aceitar propriedades herdadas',()=>{
  expect(destaqueVigente({},'constructor',0)).toBe(false);expect(destaqueVigente({p:100},'p',100)).toBe(false);expect(destaqueVigente({p:101},'p',100)).toBe(true);
 });
 it('usa a hora do servidor e desconta latência sem depender do relógio do aparelho',()=>{
  const resposta={servidor_em:new Date(hora).toISOString(),destaques:[{lugar_id:'p',fim_em:new Date(hora+10000).toISOString()}]};
  expect(conferirDestaques(resposta,['p'],1000,2000)).toEqual({p:11000});
  expect(conferirDestaques(resposta,['p'],1000,12000)).toEqual({});
 });
 it('recusa publicidade vencida, resposta inválida e lugares não solicitados',()=>{
  expect(conferirDestaques({servidor_em:new Date(hora).toISOString(),destaques:[{lugar_id:'p',fim_em:new Date(hora).toISOString()}]},['p'],0,0)).toEqual({});
  for(const v of [null,{}, {servidor_em:'hoje',destaques:[]},{servidor_em:new Date(hora).toISOString(),destaques:[{lugar_id:'outro',fim_em:new Date(hora+10000).toISOString()}]}])expect(()=>conferirDestaques(v,['p'],0,0)).toThrow();
 });
 it('consulta somente IDs distintos e não chama rede sem lugares',async()=>{
  expect(await consultarDestaques([])).toEqual({});expect(m.rpc).not.toHaveBeenCalled();
  m.rpc.mockResolvedValue({data:{servidor_em:new Date().toISOString(),destaques:[]},error:null});
  expect(await consultarDestaques(['p','p','q'])).toEqual({});expect(m.rpc).toHaveBeenCalledWith('destaques_lugares',{p_ids:['p','q']});
 });
 it('não concede coroa com erro de consulta e bloqueia consultas excessivas',async()=>{
  m.rpc.mockResolvedValue({data:null,error:{message:'offline'}});await expect(consultarDestaques(['p'])).rejects.toThrow('indisponíveis');
  await expect(consultarDestaques(Array.from({length:1001},(_,i)=>String(i)))).rejects.toThrow('inválida');
 });
 it('divide resultados combinados do mapa em lotes de até 200 IDs',async()=>{
  m.rpc.mockResolvedValue({data:{servidor_em:new Date().toISOString(),destaques:[]},error:null});
  await consultarDestaques(Array.from({length:201},(_,i)=>String(i)));
  expect(m.rpc).toHaveBeenCalledTimes(2);expect(m.rpc.mock.calls[0][1].p_ids).toHaveLength(200);expect(m.rpc.mock.calls[1][1].p_ids).toEqual(['200']);
 });
});
