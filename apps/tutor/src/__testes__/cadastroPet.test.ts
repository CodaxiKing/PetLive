import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cadastrarPet } from '../pets/cadastrarPet';
import { FORM_VAZIO, dataParaIso, validarFormularioPet, type PetForm } from '../pets/types';
const { from, insert, single } = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), single: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { from } }));
const form: PetForm = { ...FORM_VAZIO, nome: ' Mia ', peso: '4,25', nascimento: '29/02/2024' };
beforeEach(() => { vi.clearAllMocks(); from.mockReturnValue({ insert }); insert.mockReturnValue({ select: () => ({ single }) }); });
describe('cadastro do pet', () => {
  it('salva campos normalizados e devolve o pet confirmado pelo banco', async () => {
    single.mockResolvedValue({ data: { id: 'pet-1', nome: 'Mia' }, error: null });
    expect(await cadastrarPet(form, 'tutor-1')).toMatchObject({ id: 'pet-1' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tutor_id: 'tutor-1', nome: 'Mia', peso_atual: 4.25, nascimento: '2024-02-29' }));
  });
  it('propaga o erro do banco para a tela, sem simular sucesso', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy' } });
    await expect(cadastrarPet(form, 'tutor-1')).rejects.toThrow('row-level security');
    single.mockRejectedValue(new Error('Network request failed'));
    await expect(cadastrarPet(form, 'tutor-1')).rejects.toThrow('Network request failed');
  });
  it('recusa data impossível e peso inválido antes de fazer a requisição', async () => {
    expect(dataParaIso('31/02/2024')).toBeNull();
    await expect(cadastrarPet({ ...form, nascimento: '31/02/2024' }, 'tutor-1')).rejects.toThrow('data de nascimento');
    expect(from).not.toHaveBeenCalled();
    for (const peso of ['-2', '0', 'abc', '1000', '2,345']) expect(validarFormularioPet({ ...form, peso })).not.toBeNull();
    expect(validarFormularioPet({ ...form, peso: '', nascimento: '' })).toBeNull();
  });
});
