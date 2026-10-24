import { supabase } from '../lib/supabase'
import { formParaRegistro, validarFormularioPet, type Pet, type PetForm } from './types'

export async function cadastrarPet(form: PetForm, tutorId: string): Promise<Pet> {
  const erroFormulario = validarFormularioPet(form)
  if (erroFormulario) throw new Error(erroFormulario)
  const { data, error } = await supabase.from('pets').insert(formParaRegistro(form, tutorId)).select().single()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Não foi possível confirmar o cadastro do pet. Confira sua conexão e tente novamente.')
  return data as Pet
}
