import { supabase } from '../lib/supabase'
import { ITENS_ESCALA, type ItemEscala } from './senior'

/**
 * Conteúdo de cuidado editado no admin (BUSINESS.md 5.39 e 5.40). Sem
 * internet ou sem resposta, o app usa o texto embutido.
 */
export type RecursoLuto = { id: string; tipo: 'texto' | 'contato'; titulo: string; texto: string; link: string | null }

export const LUTO_PADRAO: RecursoLuto[] = [
  {
    id: 'real',
    tipo: 'texto',
    titulo: 'O que você sente é real',
    texto: 'Perder um pet é perder um companheiro de todos os dias. Tristeza, saudade e até culpa são reações comuns. Não existe jeito certo nem prazo para passar por isso.',
    link: null,
  },
  {
    id: 'passo',
    tipo: 'texto',
    titulo: 'Um passo de cada vez',
    texto: 'Guardar a coleira, olhar fotos ou mudar a rotina pode levar tempo. Faça no seu ritmo. Conversar com quem conheceu seu pet costuma ajudar.',
    link: null,
  },
  {
    id: 'criancas',
    tipo: 'texto',
    titulo: 'Crianças e outros pets',
    texto: 'Crianças entendem melhor com palavras simples e verdadeiras. Outros pets da casa também podem estranhar a ausência; manter a rotina deles traz segurança.',
    link: null,
  },
  { id: 'cvv', tipo: 'contato', titulo: 'Se a tristeza estiver pesada demais', texto: 'CVV, ligação gratuita, 24 horas: 188. Também atende por chat em cvv.org.br.', link: 'tel:188' },
]

/** Só abre telefone ou https; qualquer outro link é ignorado. */
export const linkSeguro = (link: string | null) => (link && /^(https:\/\/|tel:[0-9]+$)/.test(link) ? link : null)

export async function carregarLuto(): Promise<RecursoLuto[]> {
  const { data, error } = await supabase.from('luto_recursos').select('id, tipo, titulo, texto, link').order('ordem').order('titulo')
  if (error || !data?.length) return LUTO_PADRAO
  return data as RecursoLuto[]
}

/** Rótulo e pergunta revisados da escala; as 7 chaves e a ordem padrão não mudam. */
export async function carregarItensEscala(): Promise<typeof ITENS_ESCALA> {
  const { data, error } = await supabase.from('escala_itens').select('chave, rotulo, pergunta')
  if (error || !data?.length) return ITENS_ESCALA
  const porChave = new Map((data as { chave: ItemEscala; rotulo: string; pergunta: string }[]).map((i) => [i.chave, i]))
  return ITENS_ESCALA.map((i) => ({ ...i, rotulo: porChave.get(i.chave)?.rotulo ?? i.rotulo, pergunta: porChave.get(i.chave)?.pergunta ?? i.pergunta }))
}
