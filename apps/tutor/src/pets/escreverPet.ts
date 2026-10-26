import { criarClienteTemporario, supabase } from '../lib/supabase'
import type { Pet } from './types'

async function conferirConta(tutor: string) {
  const { data, error } = await supabase.auth.getSession()
  if (error || !tutor || data.session?.user.id !== tutor) throw new Error('A conta mudou. Entre novamente para continuar.')
  return data.session
}

export async function escreverPet(tutor: string, id: string, dados: Partial<Omit<Pet, 'id' | 'tutor_id' | 'criado_em'>>): Promise<Pet> {
  if (!id) throw new Error('Pet inválido. Atualize a lista.')
  const sessao = await conferirConta(tutor)
  const cliente = criarClienteTemporario(sessao.access_token)
  const { data, error } = await cliente.from('pets').update(dados).eq('id', id).select().single()
  if (error) throw new Error(error.message)
  await conferirConta(tutor)
  if (!data || data.id !== id) throw new Error('Não foi possível confirmar a alteração. Atualize a lista antes de tentar novamente.')
  return data as Pet
}

export async function excluirPet(tutor: string, id: string): Promise<void> {
  if (!id) throw new Error('Pet inválido. Atualize a lista.')
  const sessao = await conferirConta(tutor)
  const cliente = criarClienteTemporario(sessao.access_token)
  // Metadados desaparecem na cascata. Captura só caminhos deste tutor e pet.
  let caminhos: string[] = []
  try {
    const { data, error } = await cliente.from('documentos_saude').select('arquivo_path').eq('pet_id', id)
    if (!error && Array.isArray(data)) {
      const prefixo = `${tutor}/saude/${id}/`
      caminhos = data.map(d => d.arquivo_path).filter((p): p is string =>
        typeof p === 'string' && p.startsWith(prefixo) && Boolean(p.slice(prefixo.length)) &&
        !p.includes('\\') && !p.split('/').some(parte => parte === '.' || parte === '..'))
    }
  } catch { /* A limpeza é opcional e não impede excluir o pet. */ }
  await conferirConta(tutor)
  const { data, error } = await cliente.from('pets').delete().eq('id', id).select('id').maybeSingle()
  if (error) throw new Error(error.message)
  await conferirConta(tutor)
  if (!data || data.id !== id) throw new Error('Não foi possível confirmar a exclusão. Atualize a lista antes de tentar novamente.')
  // Uma falha de Storage não desfaz a exclusão já confirmada pelo banco.
  for (let i = 0; i < caminhos.length; i += 1000) {
    try { await cliente.storage.from('anexos').remove(caminhos.slice(i, i + 1000)) } catch { /* best effort */ }
  }
}
