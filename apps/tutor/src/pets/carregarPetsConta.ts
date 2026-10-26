import { criarClienteTemporario, supabase } from '../lib/supabase'
import type { Pet } from './types'

export type ColecaoPets = { pets: Pet[]; seniores: Set<string> | null }

/** Credencial fixa por consulta; preserva a leitura offline isolada por titular. */
export async function carregarPetsConta(tutor: string): Promise<ColecaoPets> {
  const { data, error } = await supabase.auth.getSession()
  if (error || data.session?.user.id !== tutor) throw new Error('A conta mudou. Entre novamente.')
  const cliente = criarClienteTemporario(data.session.access_token, true)
  const [pets, senior] = await Promise.allSettled([
    cliente.from('pets').select('*').order('criado_em', { ascending: false }),
    cliente.from('senior').select('pet_id'),
  ])
  const atual = await supabase.auth.getSession()
  if (atual.error || atual.data.session?.user.id !== tutor) throw new Error('A conta mudou. Entre novamente.')
  if (pets.status === 'rejected') throw pets.reason
  if (pets.value.error) throw new Error(pets.value.error.message)
  if (!Array.isArray(pets.value.data)) throw new Error('Não foi possível carregar seus pets. Tente novamente.')
  // A etiqueta é opcional: falhar aqui não esconde a lista nem apaga marcações atuais.
  const seniores = senior.status === 'fulfilled' && !senior.value.error && Array.isArray(senior.value.data)
    ? new Set<string>(senior.value.data.map(s => s.pet_id)) : null
  return { pets: pets.value.data as Pet[], seniores }
}

/** Somente a consulta mais recente pode publicar, inclusive após uma falha. */
export function criarCargaPets(
  consultar: () => Promise<ColecaoPets>,
  publicar: (dados: ColecaoPets) => void,
  falhar: (erro: unknown) => void,
) {
  let revisao = 0
  return {
    invalidar: () => { revisao++ },
    recarregar: async () => {
      const tentativa = ++revisao
      try {
        const dados = await consultar()
        if (tentativa === revisao) publicar(dados)
      } catch (erro) {
        if (tentativa === revisao) falhar(erro)
      }
    },
  }
}
