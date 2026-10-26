import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Configuração que a equipe muda no painel (área Sistema) sem publicar app
 * novo: a versão mínima e os recursos ligados. Na dúvida (sem internet,
 * erro), tudo segue ligado e ninguém é barrado: a última resposta fica
 * guardada no aparelho.
 */
export type Recurso = 'carteirinha_link' | 'indicar_lugar' | 'achei_foto';
type Config = { versao_minima: { android?: string; ios?: string }; recursos: Partial<Record<Recurso, boolean>> };

const CHAVE = 'petlive-config-app';
export const VERSAO_APP = Constants.expoConfig?.version ?? '0.0.0';

let atual: Config | null = null;
const ouvintes = new Set<() => void>();

function definir(config: Config) {
  atual = config;
  ouvintes.forEach((avisar) => avisar());
}

AsyncStorage.getItem(CHAVE)
  .then((texto) => {
    if (texto && !atual) definir(JSON.parse(texto) as Config);
  })
  .catch(() => undefined);

export async function atualizarConfig(): Promise<void> {
  const { data, error } = await supabase.rpc('config_app');
  if (error || !data) return;
  definir(data as Config);
  AsyncStorage.setItem(CHAVE, JSON.stringify(data)).catch(() => undefined);
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => ouvintes.delete(avisar);
}

/** "1.4.10" < "1.10.0", comparando número a número. */
export function versaoMenor(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  }
  return false;
}

/** Busca a configuração ao abrir e sempre que o app volta para a frente. */
export function useConfigApp() {
  const config = useSyncExternalStore(assinar, () => atual);

  useEffect(() => {
    atualizarConfig().catch(() => undefined);
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') atualizarConfig().catch(() => undefined);
    });
    return () => assinatura.remove();
  }, []);

  const minima = Platform.OS === 'ios' ? config?.versao_minima.ios : config?.versao_minima.android;
  return { precisaAtualizar: Boolean(minima && versaoMenor(VERSAO_APP, minima)) };
}

/** Recurso ligado no painel? Sem resposta ainda, vale o padrão (ligado, salvo recurso novo que começa desligado). */
export function useRecurso(recurso: Recurso, padrao = true): boolean {
  const config = useSyncExternalStore(assinar, () => atual);
  return config?.recursos[recurso] ?? padrao;
}
