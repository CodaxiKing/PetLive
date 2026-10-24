import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salvarQr, urlQr } from '../pets/qrColeira';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }));
beforeEach(() => { rpc.mockReset(); });
describe('QR da coleira', () => {
  it('envia as escolhas explicitamente sem publicar outros campos do pet', async () => {
    rpc.mockResolvedValue({ data: { code: 'codigo-estavel' }, error: null });
    await expect(salvarQr('pet-1', { show_photo: false, show_phone: false, show_allergies: true, active: true })).resolves.toEqual({ code: 'codigo-estavel' });
    expect(rpc).toHaveBeenCalledWith('salvar_qr_pet', { p_pet: 'pet-1', p_foto: false, p_telefone: false, p_alergias: true, p_ativo: true });
  });
  it('preserva a mensagem do servidor quando o telefone não foi cadastrado', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Cadastre seu telefone no perfil.' } });
    await expect(salvarQr('pet-1', { show_photo: false, show_phone: true, show_allergies: false, active: true })).rejects.toThrow('Cadastre seu telefone');
  });
  it('usa a página permanente e codifica o código como um segmento', () => {
    expect(urlQr('abc/def?x=1')).toMatch(/\/p\/abc%2Fdef%3Fx%3D1$/);
  });
});
