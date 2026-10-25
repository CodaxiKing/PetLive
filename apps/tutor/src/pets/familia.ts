import { supabase } from '../lib/supabase'

export type FamiliarPet = {
  user_id: string
  nome: string
  email: string
  criado_em: string
}

export async function listarFamilia(petId: string): Promise<FamiliarPet[]> {
  const { data, error } = await supabase.rpc('pet_familia_listar', { p_pet_id: petId })
  if (error) throw new Error(error.message)
  return (data ?? []) as FamiliarPet[]
}

export async function adicionarFamiliar(petId: string, email: string): Promise<FamiliarPet> {
  const { data, error } = await supabase.rpc('pet_familia_adicionar', {
    p_pet_id: petId,
    p_email: email.trim(),
  })
  if (error) throw new Error(error.message)
  return data as FamiliarPet
}

export async function removerFamiliar(petId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('pet_familia_remover', {
    p_pet_id: petId,
    p_user_id: userId,
  })
  if (error) throw new Error(error.message)
}
