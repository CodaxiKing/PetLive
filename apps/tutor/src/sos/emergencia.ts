import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { buscarLugares, type Lugar } from '../mapa/lugares';

/** Raio da busca de emergência: maior que o do mapa, para não voltar vazio. */
const RAIO_KM = 30;

const CHAVE_ULTIMA_CLINICA = 'petlive:sos:ultima-clinica';
const CHAVE_VETERINARIO = 'petlive:sos:meu-veterinario';

export type ClinicaEmergencia = {
  lugar: Lugar;
  /** true quando o cadastro indica 24 h; false = só a clínica mais perto. */
  confirmada24h: boolean;
  /** Quando a consulta foi feita (ISO). */
  consultadaEm: string;
  /** Veio do aparelho porque não houve rede ou localização agora. */
  doAparelho: boolean;
};

export type MeuVeterinario = { nome: string; telefone: string };

/** Velocidade média no trânsito da cidade, para estimar o tempo de carro. */
const KM_POR_MINUTO = 0.4;

export function minutosDeCarro(km?: number): number | null {
  if (km === undefined || Number.isNaN(km)) return null;
  return Math.max(2, Math.round(km / KM_POR_MINUTO));
}

async function ultimaClinica(): Promise<ClinicaEmergencia | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_ULTIMA_CLINICA);
    if (!bruto) return null;
    return { ...(JSON.parse(bruto) as ClinicaEmergencia), doAparelho: true };
  } catch {
    return null;
  }
}

/** Posição atual sem pedir permissão de novo se já foi negada. */
async function posicaoAtual(): Promise<{ lat: number; lng: number } | null> {
  const permissao = await Location.requestForegroundPermissionsAsync();
  if (permissao.status !== 'granted') return null;
  const ultima = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
  const posicao =
    ultima ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { lat: posicao.coords.latitude, lng: posicao.coords.longitude };
}

export type ResultadoEmergencia = {
  clinica: ClinicaEmergencia | null;
  /** A localização foi negada: a tela oferece digitar o bairro. */
  semLocalizacao: boolean;
};

/**
 * Clínica 24 h mais perto (BUSINESS.md 5.17 e fluxo 19.18): primeiro as que
 * indicam 24 h; se não houver, a clínica mais perto, que a tela mostra com
 * "confirme por telefone". Sem rede ou sem localização, devolve a última
 * consultada, guardada no aparelho. `origem` vem do bairro digitado.
 */
export async function buscarClinicaEmergencia(origem?: {
  lat: number;
  lng: number;
}): Promise<ResultadoEmergencia> {
  let semLocalizacao = false;
  try {
    const posicao = origem ?? (await posicaoAtual());
    if (!posicao) {
      semLocalizacao = true;
      return { clinica: await ultimaClinica(), semLocalizacao };
    }

    const [do24h] = await buscarLugares({ ...posicao, categoria: 'clinica', aberto24h: true, raioKm: RAIO_KM });
    const lugar =
      do24h ?? (await buscarLugares({ ...posicao, categoria: 'clinica', raioKm: RAIO_KM }))[0];
    if (!lugar) return { clinica: await ultimaClinica(), semLocalizacao };

    const clinica: ClinicaEmergencia = {
      lugar,
      confirmada24h: Boolean(do24h),
      consultadaEm: new Date().toISOString(),
      doAparelho: false,
    };
    // Só a 24 h confirmada vale como "última clínica 24 h" para o modo sem sinal.
    if (clinica.confirmada24h) {
      AsyncStorage.setItem(CHAVE_ULTIMA_CLINICA, JSON.stringify(clinica)).catch(() => undefined);
    }
    return { clinica, semLocalizacao };
  } catch {
    return { clinica: await ultimaClinica(), semLocalizacao };
  }
}

/** Bairro digitado -> ponto, pelo geocodificador do aparelho (precisa de rede). */
export async function pontoDoBairro(bairro: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const [ponto] = await Location.geocodeAsync(`${bairro.trim()}, Rio de Janeiro, Brasil`);
    return ponto ? { lat: ponto.latitude, lng: ponto.longitude } : null;
  } catch {
    return null;
  }
}

export async function carregarVeterinario(): Promise<MeuVeterinario | null> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_VETERINARIO);
    return bruto ? (JSON.parse(bruto) as MeuVeterinario) : null;
  } catch {
    return null;
  }
}

/** Fica só no aparelho: o SOS precisa dele mesmo sem internet. */
export async function salvarVeterinario(veterinario: MeuVeterinario | null): Promise<void> {
  if (!veterinario) {
    await AsyncStorage.removeItem(CHAVE_VETERINARIO);
    return;
  }
  await AsyncStorage.setItem(CHAVE_VETERINARIO, JSON.stringify(veterinario));
}
