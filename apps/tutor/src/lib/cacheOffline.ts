import AsyncStorage from '@react-native-async-storage/async-storage';
import { textoDeErro } from './erros';

/**
 * Saúde do pet sem internet (BUSINESS.md 24: "funciona sem rede quando for
 * leitura de saúde do pet"). Fica no fetch do Supabase: cada leitura das
 * tabelas de saúde é guardada no aparelho, por conta; sem rede, a mesma
 * leitura devolve a última cópia. Escritas seguem para o servidor e, sem
 * rede, falham com erro claro (mensagemDeErro).
 */

const TABELAS = new Set([
  'pets',
  'vaccinations',
  'medications',
  'medication_doses',
  'reminders',
  'weights',
  'visits',
  'profiles',
  'vaccine_schedule',
  'saved_places',
]);

const PREFIXO = 'petlive-cache:';

/** Avisa a tela quando o que ela mostra veio do cache (sem internet). */
type Ouvinte = (offline: boolean) => void;
const ouvintes = new Set<Ouvinte>();
let offline = false;

function marcar(valor: boolean) {
  if (valor === offline) return;
  offline = valor;
  ouvintes.forEach((ouvinte) => ouvinte(valor));
}

export function estaOffline(): boolean {
  return offline;
}

export function ouvirOffline(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Dono da leitura (sub do JWT): o cache de uma conta nunca aparece em outra. */
function donoDoPedido(headers: Headers): string | null {
  const auth = headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const corpo = token.split('.')[1];
  if (!corpo) return null;
  try {
    const json = JSON.parse(atob(corpo.replace(/-/g, '+').replace(/_/g, '/')));
    return json.role === 'authenticated' && typeof json.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

function tabelaDaUrl(url: string): string | null {
  const m = /\/rest\/v1\/([a-z_]+)\?/.exec(url);
  return m && TABELAS.has(m[1]) ? m[1] : null;
}

/** Benefícios exigem resposta atual: uma cópia antiga não confirma assinatura. */
function consultaBeneficio(url: string): boolean {
  if (tabelaDaUrl(url) !== 'profiles') return false;
  try {
    const selecao = new URL(url).searchParams.get('select');
    return !selecao || /\*|\bplano\b/i.test(selecao);
  } catch { return true; }
}

function chaveDe(dono: string, url: string): string {
  // Só o caminho e a consulta: o mesmo pedido em outra rede cai na mesma chave.
  // Horários (filtros "a partir de agora") viram só a data: senão cada leitura
  // criaria uma chave nova e a cópia nunca seria achada sem internet.
  const caminho = url
    .slice(url.indexOf('/rest/v1/'))
    .replace(/(\d{4}-\d{2}-\d{2})T[\d%A:.]+Z/g, '$1');
  return `${PREFIXO}${dono}:${caminho}`;
}

/**
 * O fetch só rejeita quando não chega ao servidor (erro HTTP volta como
 * resposta). A mensagem muda conforme a implementação ("Network request
 * failed", "fetch failed: java.net.ConnectException"...), então vale
 * qualquer rejeição que não seja cancelamento.
 */
function semRede(erro: unknown): boolean {
  return !(erro instanceof Error && erro.name === 'AbortError');
}

export async function fetchComCache(entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase();
  const headers = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
  const dono = metodo === 'GET' && tabelaDaUrl(url) && !consultaBeneficio(url) ? donoDoPedido(headers) : null;

  if (!dono) {
    try {
      const resposta = await fetch(entrada, init);
      if (tabelaDaUrl(url)) marcar(false);
      return resposta;
    } catch (erro) {
      if (semRede(erro) && tabelaDaUrl(url)) marcar(true);
      throw erro;
    }
  }

  const chave = chaveDe(dono, url);
  try {
    const resposta = await fetch(entrada, init);
    marcar(false);
    if (resposta.ok) {
      const corpo = await resposta.clone().text();
      AsyncStorage.setItem(chave, corpo).catch(() => undefined);
    }
    return resposta;
  } catch (erro) {
    if (!semRede(erro)) throw erro;
    const guardado = await AsyncStorage.getItem(chave).catch(() => null);
    if (guardado === null) throw erro;
    marcar(true);
    return new Response(guardado, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}

/** Ao sair da conta: apaga as cópias de saúde do pet guardadas no aparelho. */
export async function limparCacheOffline(): Promise<void> {
  const chaves = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const nossas = chaves.filter((c) => c.startsWith(PREFIXO));
  if (nossas.length) await AsyncStorage.multiRemove(nossas).catch(() => undefined);
}

/** Quando a escrita falha e a tela só sabe que não deu (provider devolve false). */
export const AVISO_SEM_SALVAR = 'Confira a internet e tente de novo. Nada foi alterado.';

/** A mensagem é de falta de rede (cada fetch descreve de um jeito). */
export function ehErroDeRede(mensagem: string): boolean {
  return /network request failed|failed to fetch|fetch failed|ConnectException|UnknownHost|TypeError/i.test(mensagem);
}

/** Erro de escrita para a tela: sem rede vira uma frase clara. */
export function mensagemDeErro(mensagem: string): string {
  return ehErroDeRede(mensagem) ? 'Sem internet: não deu para salvar. Tente de novo quando a conexão voltar.' : textoDeErro(mensagem);
}
