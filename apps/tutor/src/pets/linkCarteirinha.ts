import { supabase } from '../lib/supabase'

/**
 * Carteirinha por link (BUSINESS.md 5.37 e "O que incluir ao compartilhar"):
 * o servidor guarda uma foto só das seções escolhidas e devolve um código; o
 * link abre a página pública do site, sem login, até o prazo acabar.
 */
export type Secao = 'dados' | 'vacinas' | 'alergias' | 'remedios' | 'saude' | 'veterinario' | 'observacoes' | 'telefone'

export const SECOES: { chave: Secao; titulo: string; descricao: string; padrao: boolean }[] = [
  { chave: 'dados', titulo: 'Dados do pet', descricao: 'Nome, raça, idade, sexo e peso', padrao: true },
  { chave: 'vacinas', titulo: 'Vacinas e vermífugo', descricao: 'Datas e próximas doses', padrao: true },
  { chave: 'alergias', titulo: 'Alergias e condições', descricao: 'Importante para clínica e hotel', padrao: true },
  { chave: 'remedios', titulo: 'Remédios em uso', descricao: 'Dose e horários', padrao: false },
  { chave: 'saude', titulo: 'Saúde e cuidados', descricao: 'Castrado', padrao: false },
  { chave: 'veterinario', titulo: 'Veterinário', descricao: 'Nome, clínica e telefone', padrao: true },
  { chave: 'observacoes', titulo: 'Observações do tutor', descricao: 'Medos, rotina e manias', padrao: false },
  { chave: 'telefone', titulo: 'Seu telefone', descricao: 'Para a clínica falar com você', padrao: true },
]

/** Prazos do link (BUSINESS.md: 24 h, ajustável de 6 a 72). */
export const PRAZOS = [6, 24, 72] as const

/** Endereço do site. Sem domínio próprio ainda, o build informa o do Coolify. */
const SITE = (process.env.EXPO_PUBLIC_SITE_URL || 'https://petlive.app').replace(/\/$/, '')

export function urlFicha(codigo: string): string {
  return `${SITE}/ficha/${codigo}`
}

export type LinkCarteirinha = {
  id: string
  codigo: string
  pet_id: string
  secoes: Secao[]
  tipo: 'carteirinha' | 'emergencia'
  criado_em: string
  expira_em: string
  cancelado_em: string | null
  aberturas: number
  ultima_abertura_em: string | null
}

/** De onde saiu o link (ficha de emergência): registra o lugar, nunca o número. */
export type OrigemLink = { tipo?: 'carteirinha' | 'emergencia'; lugar?: string | null; canal?: 'whatsapp' | 'compartilhar' | 'qr' | 'copiar' }

export async function gerarLink(
  petId: string,
  secoes: Secao[],
  horas: number,
  origem: OrigemLink = {},
): Promise<{ codigo: string; expira_em: string; reaproveitada?: boolean }> {
  const { data, error } = await supabase.rpc('criar_link_carteirinha', {
    p_pet: petId,
    p_secoes: secoes,
    p_horas: horas,
    p_tipo: origem.tipo ?? 'carteirinha',
    p_lugar: origem.lugar ?? null,
    p_canal: origem.canal ?? null,
  })
  if (error) throw new Error(error.message)
  return data as { codigo: string; expira_em: string; reaproveitada?: boolean }
}

export async function cancelarLink(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_link_carteirinha', { p_id: id })
  if (error) throw new Error(error.message)
}

/** Links ainda válidos do pet, do mais novo para o mais antigo. */
export async function linksAtivos(petId: string): Promise<LinkCarteirinha[]> {
  const { data, error } = await supabase
    .from('carteirinha_links')
    .select('id, codigo, pet_id, secoes, tipo, criado_em, expira_em, cancelado_em, aberturas, ultima_abertura_em')
    .eq('pet_id', petId)
    .is('cancelado_em', null)
    .gt('expira_em', new Date().toISOString())
    .order('criado_em', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as LinkCarteirinha[]
}

/** "amanhã às 14:32", "hoje às 20:00", "24/10 às 08:15". */
export function quando(iso: string): string {
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date()
  const amanha = new Date(hoje.getTime() + 86_400_000)
  if (d.toDateString() === hoje.toDateString()) return `hoje às ${hora}`
  if (d.toDateString() === amanha.toDateString()) return `amanhã às ${hora}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hora}`
}

/** Mensagem que acompanha o link no WhatsApp (ou onde o tutor escolher). */
export function mensagemLink(nomePet: string, codigo: string, expiraEm: string): string {
  return `Carteirinha de ${nomePet} no PetLive: ${urlFicha(codigo)}\n\nO link vale até ${quando(expiraEm)} e não precisa de login.`
}
