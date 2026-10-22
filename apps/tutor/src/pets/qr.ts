import { supabase } from '../lib/supabase'

export type SecaoQr = 'nome_foto' | 'telefone' | 'alergias'

export interface QrColeiraConfig {
  codigo: string
  url: string
  secoes: SecaoQr[]
  reativado?: boolean
}

export interface QrPublicoConteudo {
  pet: {
    id: string
    nome: string
    especie: string
    raca: string | null
    nascimento: string | null
    foto_url: string | null
  }
  secoes: SecaoQr[]
  tutor?: {
    nome: string
    telefone: string
  }
  alergias?: string | null
  veterinario?: string | null
  observacoes?: string | null
}

export interface QrPublicoResponse {
  valido: boolean
  conteudo?: QrPublicoConteudo
  codigo?: string
  erro?: 'nao_encontrado' | 'revogado' | 'pet_inativo' | 'rate_limit'
}

/** Gera (ou reativa) o QR da coleira para o pet. */
export async function criarQrColeira(petId: string): Promise<QrColeiraConfig> {
  const { data, error } = await supabase.rpc('criar_qr_coleira', { p_pet_id: petId })
  if (error) throw new Error(error.message)
  return data as QrColeiraConfig
}

/** Atualiza as seções que aparecem na página pública. */
export async function atualizarQrColeira(petId: string, secoes: SecaoQr[]): Promise<QrColeiraConfig> {
  const { data, error } = await supabase.rpc('atualizar_qr_coleira', {
    p_pet_id: petId,
    p_secoes: secoes,
  })
  if (error) throw new Error(error.message)
  return data as QrColeiraConfig
}

/** Revoga o QR da coleira (invalida o código). */
export async function revogarQrColeira(petId: string): Promise<{ revogado: true; revogado_em: string }> {
  const { data, error } = await supabase.rpc('revogar_qr_coleira', { p_pet_id: petId })
  if (error) throw new Error(error.message)
  return data as { revogado: true; revogado_em: string }
}

/** Busca a configuração atual do QR do pet (para pré-carregar a tela). */
export async function buscarQrColeira(petId: string): Promise<{ codigo: string; secoes: SecaoQr[]; revogado_em: string | null } | null> {
  const { data, error } = await supabase
    .from('pet_qr_settings')
    .select('codigo, secoes, revogado_em')
    .eq('pet_id', petId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

/** Chama a página pública (sem auth) para testar/previsualizar. */
export async function obterQrPublico(codigo: string): Promise<QrPublicoResponse> {
  const { data, error } = await supabase.rpc('obter_qr_publico', { p_codigo: codigo })
  if (error) throw new Error(error.message)
  return data as QrPublicoResponse
}

/** Seções padrão: nome_foto sempre ligado, telefone ligado, alergias desligado. */
export const SECOES_PADRAO: SecaoQr[] = ['nome_foto', 'telefone']

/** Rótulos para exibição na UI. */
export const ROTULOS_SECOES: Record<SecaoQr, { titulo: string; descricao: string; obrigatorio: boolean }> = {
  nome_foto: {
    titulo: 'Nome e foto do pet',
    descricao: 'Identificação mínima do pet. Sempre visível.',
    obrigatorio: true,
  },
  telefone: {
    titulo: 'Telefone do tutor',
    descricao: 'Mostra o botão "Ligar" e WhatsApp (se for celular).',
    obrigatorio: false,
  },
  alergias: {
    titulo: 'Alergias e saúde',
    descricao: 'Mostra alergias, condições, remédios e veterinário.',
    obrigatorio: false,
  },
}