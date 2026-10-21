import { supabase } from '../lib/supabase';

/** Versão do texto de termos aceito pelo app (deve casar com o backend). */
export const VERSAO_TERMOS = '1.0';

export type TipoConsentimento =
  | 'termos_uso'
  | 'politica_privacidade'
  | 'avisos_push'
  | 'localizacao'
  | 'dicas_novidades';

export type EstadoConsentimento = {
  tipo: TipoConsentimento;
  versao: string;
  aceito: boolean;
  registrado_em: string;
};

/** Estado atual (última linha) de cada consentimento do tutor logado. */
export async function carregarConsentimentos(): Promise<EstadoConsentimento[]> {
  const { data, error } = await supabase.rpc('meus_consentimentos');
  if (error) throw new Error(error.message);
  return (data ?? []) as EstadoConsentimento[];
}

/**
 * Registra uma nova linha de consentimento (LGPD: revogar é registrar
 * aceito = false — a tabela é append-only no servidor).
 */
export async function registrarConsentimento(
  tipo: TipoConsentimento,
  aceito: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('consentimentos')
    .insert({ tipo, aceito, versao: VERSAO_TERMOS, origem: 'app' });
  if (error) throw new Error(error.message);
}

/** Consentimento aceito na versão vigente (linha mais recente). */
export function aceitoNaVersaoAtual(
  estado: EstadoConsentimento | undefined,
): boolean {
  return estado?.aceito === true && estado.versao === VERSAO_TERMOS;
}

/** Termos e política aceitos na versão vigente (libera o app no primeiro acesso). */
export async function precisaAceitarTermos(): Promise<boolean> {
  const lista = await carregarConsentimentos();
  const porTipo = new Map(lista.map((estado) => [estado.tipo, estado]));
  return !(
    aceitoNaVersaoAtual(porTipo.get('termos_uso')) &&
    aceitoNaVersaoAtual(porTipo.get('politica_privacidade'))
  );
}
