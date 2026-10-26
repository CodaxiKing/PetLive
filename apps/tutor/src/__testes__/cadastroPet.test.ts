import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cadastrarPet } from '../pets/cadastrarPet';
import { FORM_VAZIO, dataParaIso, validarFormularioPet, type PetForm } from '../pets/types';
const { from, insert, single, session, criar } = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), single: vi.fn(), session: vi.fn(), criar: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: session } }, criarClienteTemporario: criar }));
const sessao = (id = 'tutor-1') => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null });
const form: PetForm = { ...FORM_VAZIO, nome: ' Mia ', peso: '4,25', nascimento: '29/02/2024' };
beforeEach(() => { vi.resetAllMocks(); session.mockResolvedValue(sessao()); criar.mockReturnValue({ from }); from.mockReturnValue({ insert }); insert.mockReturnValue({ select: () => ({ single }) }); });
describe('cadastro do pet', () => {
  it('salva campos normalizados e devolve o pet confirmado pelo banco', async () => {
    single.mockResolvedValue({ data: { id: 'pet-1', tutor_id: 'tutor-1', nome: 'Mia' }, error: null });
    expect(await cadastrarPet(form, 'tutor-1')).toMatchObject({ id: 'pet-1' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ tutor_id: 'tutor-1', nome: 'Mia', peso_atual: 4.25, nascimento: '2024-02-29' }));
    expect(criar).toHaveBeenCalledWith('token-tutor-1');
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
  it('não cadastra após troca de conta ou logout', async () => {
    session.mockResolvedValueOnce(sessao('outro'));
    await expect(cadastrarPet(form, 'tutor-1')).rejects.toThrow('conta mudou');
    session.mockResolvedValueOnce({ data: { session: null } });
    await expect(cadastrarPet(form, 'tutor-1')).rejects.toThrow('conta mudou');
    expect(insert).not.toHaveBeenCalled();
  });
  it('descarta confirmação depois de trocar de conta', async () => {
    session.mockResolvedValueOnce(sessao()).mockResolvedValue(sessao('outro'));
    single.mockResolvedValue({ data: { id: 'p', tutor_id: 'tutor-1' } });
    await expect(cadastrarPet(form, 'tutor-1')).rejects.toThrow('conta mudou');
  });
  it('não simula sucesso com recibo parcial ou de outro titular', async () => {
    for (const data of [null, {}, { id: '' }, { id: 'p' }, { id: 'p', tutor_id: 'outro' }]) {
      single.mockResolvedValueOnce({ data });
      await expect(cadastrarPet(form, 'tutor-1')).rejects.toThrow('confirmar o cadastro');
    }
  });
});
