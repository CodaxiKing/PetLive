import { supabase } from '../lib/supabase'
import { escaparHtml } from '../lib/pdf'
import type { Lembrete } from '../lembretes/types'
import type { Pet } from './types'

/**
 * Pet sênior (BUSINESS.md 5.40): a rotina adaptada vem do servidor (consulta,
 * pesagem e exames) e o tutor liga ou desliga cada lembrete. A escala de
 * qualidade de vida é para conversar com o veterinário: não faz diagnóstico
 * e o app nunca recomenda uma decisão.
 */
export const AVISO_ESCALA = 'Converse com o veterinário sobre o resultado. A escala não faz diagnóstico e não decide por você.'

export type ItemEscala = 'dor' | 'apetite' | 'higiene' | 'hidratacao' | 'mobilidade' | 'dias' | 'felicidade'

/** 10 é o melhor em todos os itens (sem dor, comendo bem, mais dias bons). */
export const ITENS_ESCALA: { chave: ItemEscala; rotulo: string; pergunta: string }[] = [
  { chave: 'dor', rotulo: 'Dor', pergunta: '10 = sem sinais de dor; 0 = dor constante' },
  { chave: 'apetite', rotulo: 'Apetite', pergunta: '10 = come bem sozinho; 0 = não come' },
  { chave: 'higiene', rotulo: 'Higiene', pergunta: '10 = se mantém limpo; 0 = precisa de ajuda o tempo todo' },
  { chave: 'hidratacao', rotulo: 'Hidratação', pergunta: '10 = bebe água normalmente; 0 = não bebe' },
  { chave: 'mobilidade', rotulo: 'Mobilidade', pergunta: '10 = anda e levanta sem esforço; 0 = não se levanta' },
  { chave: 'dias', rotulo: 'Dias bons e ruins', pergunta: '10 = quase todos os dias são bons; 0 = quase todos ruins' },
  { chave: 'felicidade', rotulo: 'Felicidade', pergunta: '10 = interessado e brincalhão; 0 = apático' },
]

export type RegistroEscala = { id: string; data: string; notas: Record<ItemEscala, number>; total: number; observacao: string | null }

export async function conferirSenior(petId: string): Promise<boolean> {
  const { data } = await supabase.rpc('conferir_senior', { p_pet: petId })
  return data === true
}

/** Pets sênior do tutor (para a faixa e a etiqueta Sênior). */
export async function petsSenior(): Promise<Set<string>> {
  const { data } = await supabase.from('senior').select('pet_id')
  return new Set(((data ?? []) as { pet_id: string }[]).map((s) => s.pet_id))
}

export async function rotinaSenior(petId: string): Promise<Lembrete[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('pet_id', petId)
    .in('rotina_item', ['senior_consulta', 'senior_pesagem', 'senior_exames'])
  if (error) throw new Error(error.message)
  return (data ?? []) as Lembrete[]
}

export async function ligarLembrete(id: string, ativo: boolean): Promise<void> {
  const { error } = await supabase.from('reminders').update({ ativo }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function carregarEscala(petId: string): Promise<RegistroEscala[]> {
  const { data, error } = await supabase
    .from('qualidade_vida')
    .select('id, data, notas, total, observacao')
    .eq('pet_id', petId)
    .order('data', { ascending: false })
    .order('criado_em', { ascending: false })
    .limit(60)
  if (error) throw new Error(error.message)
  return (data ?? []) as RegistroEscala[]
}

export async function salvarEscala(petId: string, notas: Record<ItemEscala, number>, observacao: string): Promise<void> {
  const total = Object.values(notas).reduce((s, n) => s + n, 0)
  const { error } = await supabase
    .from('qualidade_vida')
    .insert({ pet_id: petId, notas, total, observacao: observacao.trim() || null })
  if (error) throw new Error(error.message)
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

/** Resumo para levar ao veterinário (Premium): as últimas respostas, item a item. */
export function htmlResumo(pet: Pet, registros: RegistroEscala[], idade: string | null): string {
  const ultimos = registros.slice(0, 6)
  const cabecalho = ultimos.map((r) => `<th>${dataCurta(r.data)}</th>`).join('')
  const linhas = ITENS_ESCALA.map(
    (i) => `<tr><td>${i.rotulo}</td>${ultimos.map((r) => `<td>${r.notas[i.chave]}</td>`).join('')}</tr>`,
  ).join('')
  const totais = `<tr class="total"><td>Total (de 70)</td>${ultimos.map((r) => `<td>${r.total}</td>`).join('')}</tr>`
  const notas = ultimos
    .filter((r) => r.observacao)
    .map((r) => `<li><strong>${dataCurta(r.data)}:</strong> ${escaparHtml(r.observacao ?? '')}</li>`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Roboto, sans-serif; color: #111; margin: 32px; }
    h1 { font-size: 26px; margin: 0; } .sub { color: #566070; margin: 4px 0 24px; }
    table { border-collapse: collapse; width: 100%; } th, td { border-bottom: 1px solid #E1E6EE; padding: 8px; text-align: center; }
    td:first-child, th:first-child { text-align: left; } .total td { font-weight: bold; }
    .aviso { background: #E0F1FA; border-radius: 12px; padding: 12px 16px; margin-top: 24px; font-size: 14px; }
  </style></head><body>
    <h1>Qualidade de vida · ${escaparHtml(pet.nome)}</h1>
    <p class="sub">${[pet.especie === 'gato' ? 'Gato' : 'Cão', pet.raca, idade].filter(Boolean).join(' · ')} · cada item de 0 a 10 (10 = melhor)</p>
    <table><tr><th>Item</th>${cabecalho}</tr>${linhas}${totais}</table>
    ${notas ? `<h3>Observações do tutor</h3><ul>${notas}</ul>` : ''}
    <p class="aviso">Respostas do tutor, pelo PetLive. ${AVISO_ESCALA}</p>
  </body></html>`
}
