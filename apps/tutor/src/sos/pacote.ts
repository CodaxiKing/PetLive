import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { PACOTE_EMBUTIDO, type PacoteEmergencia } from './conteudo';

/**
 * Pacote offline de emergência (BUSINESS.md 5.18): o app usa o pacote que
 * vem embutido ou, se houver, uma versão mais nova baixada da função
 * `content_pack` e guardada no aparelho. A atualização roda em segundo
 * plano ao abrir o app; sem internet, nada muda.
 */
const CHAVE = 'petlive:sos:pacote';

function valido(pacote: unknown): pacote is PacoteEmergencia {
  const p = pacote as PacoteEmergencia | null;
  return (
    typeof p?.versao === 'number' &&
    Array.isArray(p.primeirosSocorros) &&
    p.primeirosSocorros.length > 0 &&
    Array.isArray(p.toxicos) &&
    p.toxicos.length > 0
  );
}

/** O pacote guardado no aparelho, se for mais novo que o embutido. */
export async function pacoteGuardado(): Promise<PacoteEmergencia> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    const guardado: unknown = bruto ? JSON.parse(bruto) : null;
    if (valido(guardado) && guardado.versao > PACOTE_EMBUTIDO.versao) return guardado;
  } catch {
    // Guardado corrompido: fica o embutido.
  }
  return PACOTE_EMBUTIDO;
}

/** Baixa uma versão mais nova, se houver. Devolve true quando atualizou. */
export async function atualizarPacoteEmergencia(): Promise<boolean> {
  const atual = await pacoteGuardado();
  const { data, error } = await supabase.rpc('content_pack', {
    p_tipo: 'emergencia',
    p_versao_atual: atual.versao,
  });
  if (error || !data) return false;

  const resposta = data as { versao: number; revisao: PacoteEmergencia['revisao']; conteudo: object };
  const novo = { ...resposta.conteudo, versao: resposta.versao, revisao: resposta.revisao };
  if (!valido(novo)) return false;

  await AsyncStorage.setItem(CHAVE, JSON.stringify(novo));
  return true;
}

/** Pacote em uso nas telas: começa no embutido e troca pelo guardado. */
export function usePacoteEmergencia(): PacoteEmergencia {
  const [pacote, setPacote] = useState<PacoteEmergencia>(PACOTE_EMBUTIDO);
  useEffect(() => {
    pacoteGuardado().then(setPacote);
  }, []);
  return pacote;
}
