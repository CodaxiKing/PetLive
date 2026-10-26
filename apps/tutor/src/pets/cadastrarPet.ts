import { criarClienteTemporario } from '../lib/supabase'
import { conferirContaPet } from './conta'
import { formParaRegistro, validarFormularioPet, type Pet, type PetForm } from './types'

export async function cadastrarPet(form: PetForm, tutorId: string): Promise<Pet> {
  const erroFormulario = validarFormularioPet(form)
  if (erroFormulario) throw new Error(erroFormulario)
  const sessao = await conferirContaPet(tutorId)
  const cliente = criarClienteTemporario(sessao.access_token)
  const { data, error } = await cliente.from('pets').insert(formParaRegistro(form, tutorId)).select().single()
  if (error) throw new Error(error.message)
  await conferirContaPet(tutorId)
  if (!data || typeof data.id !== 'string' || !data.id || data.tutor_id !== tutorId) throw new Error('Não foi possível confirmar o cadastro do pet. Atualize a lista antes de tentar novamente.')
  return data as Pet
}
