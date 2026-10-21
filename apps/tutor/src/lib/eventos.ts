import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Eventos de uso das métricas da Fase 1 (BUSINESS.md 14; tabela eventos_uso).
 * Ficam numa fila no aparelho e vão em lote: sem internet esperam a próxima
 * vez. Nada de dado pessoal nas props. A fila usa o prefixo do cache, então
 * sai junto quando o tutor sai da conta (não vai parar em outra conta).
 */
export type Evento =
  | 'app_aberto'
  | 'lembrete_concluido'
  | 'sos_aberto'
  | 'sos_ligou'
  | 'sos_rota'
  | 'guia_aberto';

type Registro = { evento: Evento; props: Record<string, string | number | boolean>; ocorreu_em: string };

const FILA = 'petlive-cache:fila-eventos';
const ULTIMA_ABERTURA = 'petlive-cache:app-aberto-em';
const MAXIMO_NA_FILA = 200;

let enviando = false;
let agendado: ReturnType<typeof setTimeout> | null = null;

async function lerFila(): Promise<Registro[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(FILA)) ?? '[]') as Registro[];
  } catch {
    return [];
  }
}

export function registrarEvento(evento: Evento, props: Registro['props'] = {}): void {
  const registro: Registro = { evento, props, ocorreu_em: new Date().toISOString() };
  lerFila()
    .then((fila) => AsyncStorage.setItem(FILA, JSON.stringify([...fila, registro].slice(-MAXIMO_NA_FILA))))
    .then(() => {
      // Junta os eventos de alguns segundos num envio só.
      if (agendado) clearTimeout(agendado);
      agendado = setTimeout(() => {
        agendado = null;
        enviarFila();
      }, 3000);
    })
    .catch(() => undefined);
}

/** Envia o que estiver na fila; se falhar, fica para a próxima. */
export async function enviarFila(): Promise<void> {
  if (enviando) return;
  enviando = true;
  try {
    const fila = await lerFila();
    if (fila.length === 0) return;
    const { error } = await supabase.from('eventos_uso').insert(fila);
    if (error) return;
    // Só tira da fila o que foi enviado (pode ter chegado evento novo no meio).
    const agora = await lerFila();
    await AsyncStorage.setItem(FILA, JSON.stringify(agora.slice(fila.length)));
  } catch {
    // Sem rede: tenta de novo no próximo evento ou na próxima abertura.
  } finally {
    enviando = false;
  }
}

/** "App aberto" no máximo uma vez por dia (tutores ativos por semana). */
export async function registrarAberturaDiaria(): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10);
  const ultima = await AsyncStorage.getItem(ULTIMA_ABERTURA).catch(() => null);
  if (ultima !== hoje) {
    await AsyncStorage.setItem(ULTIMA_ABERTURA, hoje).catch(() => undefined);
    registrarEvento('app_aberto');
  } else {
    enviarFila();
  }
}
