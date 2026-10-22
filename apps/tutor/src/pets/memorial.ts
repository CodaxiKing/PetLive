import { supabase } from '../lib/supabase'
import { escaparHtml } from '../lib/pdf'
import { carregarLinha, urlsFotos } from './linhaDoTempo'
import type { Pet } from './types'

/**
 * Modo memorial (BUSINESS.md 5.39): a partida pausa lembretes e remédios,
 * encerra links e acessos de cuidador e tira o pet da lista ativa. Nada é
 * apagado e dá para reativar a qualquer momento.
 */
export type Memorial = { pet_id: string; data_partida: string; mensagem: string | null; criado_em: string; reativado_em: string | null }

export async function carregarMemorial(petId: string): Promise<Memorial | null> {
  const { data, error } = await supabase
    .from('memorial')
    .select('pet_id, data_partida, mensagem, criado_em, reativado_em')
    .eq('pet_id', petId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Memorial | null
}

export async function registrarPartida(petId: string, dataIso: string, mensagem: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_partida', { p_pet: petId, p_data: dataIso, p_mensagem: mensagem })
  if (error) throw new Error(error.message)
}

export async function reativarPet(petId: string): Promise<void> {
  const { error } = await supabase.rpc('reativar_pet', { p_pet: petId })
  if (error) throw new Error(error.message)
}

/** Quantos marcos e fotos a linha do tempo guarda (cartão da tela Em memória). */
export async function resumoLinha(petId: string): Promise<{ marcos: number; fotos: number }> {
  const itens = await carregarLinha(petId)
  return { marcos: itens.length, fotos: itens.filter((i) => i.foto_path).length }
}

function dataLonga(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Álbum de lembranças: capa, mensagem e a linha do tempo com as fotos. */
export async function htmlAlbum(pet: Pet, memorial: Memorial): Promise<string> {
  const itens = await carregarLinha(pet.id)
  const fotos = await urlsFotos(itens.flatMap((i) => (i.foto_path ? [i.foto_path] : [])))
  const anos = [pet.nascimento?.slice(0, 4), memorial.data_partida.slice(0, 4)].filter(Boolean).join(' · ')
  const marcos = itens
    .map((i) => {
      const foto = i.foto_path && fotos[i.foto_path] ? `<img src="${fotos[i.foto_path]}" />` : ''
      return `<div class="marco"><p class="data">${dataLonga(i.data)}</p><h3>${escaparHtml(i.titulo)}</h3>${
        i.descricao ? `<p>${escaparHtml(i.descricao)}</p>` : ''
      }${foto}</div>`
    })
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Roboto, sans-serif; color: #111; margin: 32px; }
    .capa { text-align: center; padding: 48px 0 32px; page-break-after: always; }
    .capa img { width: 220px; height: 220px; object-fit: cover; border-radius: 50%; }
    h1 { font-size: 44px; margin: 24px 0 4px; font-weight: 500; }
    .anos { color: #5B3C8F; font-size: 18px; }
    .mensagem { font-size: 20px; color: #444; margin-top: 32px; font-style: italic; }
    .marco { page-break-inside: avoid; border-left: 3px solid #EBDDFB; padding: 0 0 24px 20px; }
    .marco img { width: 100%; max-height: 360px; object-fit: cover; border-radius: 18px; margin-top: 8px; }
    .data { color: #6A7484; font-size: 13px; margin: 0; }
    h3 { margin: 2px 0; font-size: 20px; }
    .rodape { color: #6A7484; font-size: 12px; text-align: center; margin-top: 32px; }
  </style></head><body>
    <div class="capa">
      ${pet.foto_url ? `<img src="${pet.foto_url}" />` : ''}
      <h1>${escaparHtml(pet.nome)}</h1>
      <p class="anos">${anos} · Em memória</p>
      ${memorial.mensagem ? `<p class="mensagem">“${escaparHtml(memorial.mensagem)}”</p>` : ''}
    </div>
    ${marcos}
    <p class="rodape">Álbum de lembranças · PetLive</p>
  </body></html>`
}
