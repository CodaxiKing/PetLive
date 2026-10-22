import { escaparHtml } from '../lib/pdf'
import { supabase } from '../lib/supabase'
import { antirrabicaEmDia } from './carteirinha'
import type { Pet } from './types'
import type { Vacina } from '../saude/types'

/**
 * Checklist de viagem (BUSINESS.md 5.26): itens do conteúdo mestre por modo,
 * marcação automática da antirrábica e regras das companhias só como
 * referência, sempre com "confirme com a companhia".
 */
export type Modo = 'carro' | 'aviao'
export type ItemViagem = { id: string; modo: Modo | 'ambos'; titulo: string; detalhe: string | null; automatico: 'antirrabica' | null; ordem: number }
export type Companhia = { id: string; nome: string; regras: string | null; link: string; revisado_em: string | null }
export type Viagem = { id: string; pet_id: string; modo: Modo; destino: string | null; data: string | null; companhia_id: string | null; marcados: string[] }

export const AVISO_REGRAS = 'As regras mudam por companhia e destino. Confirme com a companhia antes de viajar.'

export async function carregarConteudo(): Promise<{ itens: ItemViagem[]; companhias: Companhia[] }> {
  const [itens, companhias] = await Promise.all([
    supabase.from('viagem_itens').select('id, modo, titulo, detalhe, automatico, ordem').order('ordem'),
    supabase.from('companhias_aereas').select('id, nome, regras, link, revisado_em').order('nome'),
  ])
  if (itens.error) throw new Error(itens.error.message)
  return { itens: (itens.data ?? []) as ItemViagem[], companhias: (companhias.data ?? []) as Companhia[] }
}

/** A lista salva mais recente do pet (uma por pet basta para a Fase 2). */
export async function ultimaViagem(petId: string): Promise<Viagem | null> {
  const { data } = await supabase
    .from('viagens')
    .select('id, pet_id, modo, destino, data, companhia_id, marcados')
    .eq('pet_id', petId)
    .order('atualizado_em', { ascending: false })
    .limit(1)
  return ((data ?? [])[0] as Viagem | undefined) ?? null
}

export async function salvarViagem(viagem: Omit<Viagem, 'id'> & { id: string | null }): Promise<string> {
  const { id, ...campos } = viagem
  const corpo = { ...campos, atualizado_em: new Date().toISOString() }
  const pedido = id
    ? supabase.from('viagens').update(corpo).eq('id', id).select('id').single()
    : supabase.from('viagens').insert(corpo).select('id').single()
  const { data, error } = await pedido
  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export function marcadoSozinho(item: ItemViagem, vacinas: Vacina[]): boolean {
  return item.automatico === 'antirrabica' && antirrabicaEmDia(vacinas)
}

export function htmlChecklist(pet: Pet, viagem: Omit<Viagem, 'id'>, itens: ItemViagem[], feitos: Set<string>, companhia: Companhia | null): string {
  const data = viagem.data ? `${viagem.data.slice(8, 10)}/${viagem.data.slice(5, 7)}/${viagem.data.slice(0, 4)}` : ''
  const linhas = itens
    .map(
      (i) =>
        `<li class="${feitos.has(i.id) ? 'feito' : ''}"><span>${feitos.has(i.id) ? '☑' : '☐'}</span> <strong>${escaparHtml(i.titulo)}</strong>${
          i.detalhe ? `<br/><small>${escaparHtml(i.detalhe)}</small>` : ''
        }</li>`,
    )
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Roboto, sans-serif; color: #111; margin: 32px; }
    h1 { margin: 0; font-size: 26px; } .sub { color: #5E6878; margin: 4px 0 20px; }
    ul { list-style: none; padding: 0; } li { padding: 10px 0; border-bottom: 1px solid #E1E6EE; font-size: 15px; }
    li span { font-size: 18px; } small { color: #5E6878; margin-left: 26px; } .feito strong { color: #25683F; }
    .aviso { background: #FFF1C9; border-radius: 12px; padding: 12px 16px; margin-top: 20px; font-size: 13px; }
  </style></head><body>
    <h1>Viagem com ${escaparHtml(pet.nome)}</h1>
    <p class="sub">${viagem.modo === 'aviao' ? 'Avião' : 'Carro'}${viagem.destino ? ` · ${escaparHtml(viagem.destino)}` : ''}${data ? ` · ${data}` : ''}${
      companhia ? ` · ${escaparHtml(companhia.nome)}` : ''
    }</p>
    <ul>${linhas}</ul>
    ${companhia?.regras ? `<p><strong>${escaparHtml(companhia.nome)}:</strong> ${escaparHtml(companhia.regras)}<br/><small>Fonte: ${escaparHtml(companhia.link)}</small></p>` : ''}
    <p class="aviso">${AVISO_REGRAS}</p>
  </body></html>`
}
