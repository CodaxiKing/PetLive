import { supabase } from '../lib/supabase';
export type ResumoCompartilhamentos = Record<'cuidadores'|'fichas'|'qrs'|'familia',number|null>;
export function conferirResumoCompartilhamentos(data: unknown): ResumoCompartilhamentos {
  if (!data || typeof data !== 'object') throw new Error('Não foi possível confirmar os acessos.');
  const r = data as ResumoCompartilhamentos;
  for (const k of ['cuidadores','fichas','qrs','familia'] as const) {
    if (r[k] !== null && (!Number.isSafeInteger(r[k]) || r[k]! < 0)) throw new Error('Resumo de acessos incompleto.');
  }
  return {cuidadores:r.cuidadores,fichas:r.fichas,qrs:r.qrs,familia:r.familia};
}
export async function carregarCompartilhamentos(tutor: string): Promise<ResumoCompartilhamentos> {
  async function conferir() { const {data,error}=await supabase.auth.getUser(); if(error || data.user?.id!==tutor) throw new Error('A conta mudou. Entre novamente.'); }
  await conferir();
  const {data,error}=await supabase.rpc('privacidade_compartilhamentos',{p_tutor:tutor});
  if(error) throw new Error(error.message);
  await conferir();
  return conferirResumoCompartilhamentos(data);
}
export function textoCompartilhamento(total:number|null, plural:string):string {
  return total===null ? 'Consulta indisponível neste momento' : `${total} ${plural}`;
}
