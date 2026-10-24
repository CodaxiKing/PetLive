import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conferirDetalheAdocao, conferirPaginaAdocao, conferirReciboInteresse, FILTROS_ADOCAO, fotoAdocao, idadeAdocao, juntarPaginaAdocao, validarInteresse, type PetAdocao } from '../adocao/modelo';
import { carregarDetalheAdocao, carregarPaginaAdocao, enviarInteresseAdocao, favoritarAdocao } from '../adocao/repositorio';
const m = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: m.user }, rpc: m.rpc } }));
const pet: PetAdocao = { id: 'p', nome: 'Mia', especie: 'gato', nascimento: '2026-07-24', porte: 'pequeno', sexo: 'femea', castrado: null, vacinado: false,
  vermifugado: true, descricao: 'Calma', fotos: ['https://exemplo.com/foto.jpg'], criado_em: '2026-10-24T12:00:00Z', ong_nome: 'Abrigo', cidade: 'Nova Iguaçu', bairro: 'Centro', favorito: false };
beforeEach(() => { vi.resetAllMocks(); m.user.mockResolvedValue({ data: { user: { id: 'a' } }, error: null }); m.rpc.mockResolvedValue({ data: { itens: [pet], tem_mais: false }, error: null }); });
describe('adoção do tutor', () => {
  it('valida mensagem, e-mail e consentimento antes de enviar qualquer dado', async () => {
    expect(validarInteresse(' Quero conhecer a Mia. ', ' EU@exemplo.com ', true)).toEqual({ mensagem: 'Quero conhecer a Mia.', email: 'eu@exemplo.com' });
    for (const [msg, email, aceite] of [['curta', 'eu@exemplo.com', true], ['x'.repeat(1001), 'eu@exemplo.com', true], ['Quero conhecer a Mia.', 'invalido', true], ['Quero conhecer a Mia.', 'eu@exemplo.com', false]] as const) {
      await expect(enviarInteresseAdocao('a', 'p', msg, email, aceite)).rejects.toThrow();
    }
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('diferencia pet indisponível de resposta inválida e confere recibos', async () => {
    expect(conferirDetalheAdocao(null)).toBeNull();
    for (const valor of [undefined, {}, { pet, contato: {} }]) expect(() => conferirDetalheAdocao(valor)).toThrow();
    expect(() => conferirReciboInteresse({ id: '', criado_em: 'agora' })).toThrow();
    m.rpc.mockResolvedValueOnce({ data: { pet, contato: null }, error: null });
    expect((await carregarDetalheAdocao('a', 'p'))?.pet.nome).toBe('Mia');
    m.rpc.mockResolvedValueOnce({ data: { pet, contato: null }, error: null });
    await expect(carregarDetalheAdocao('a', 'outro')).rejects.toThrow('não corresponde');
  });
  it('envia interesse apenas para a conta confirmada e exige recibo do servidor', async () => {
    const recibo = { id: 'contato', criado_em: pet.criado_em };
    m.rpc.mockResolvedValueOnce({ data: recibo, error: null });
    expect(await enviarInteresseAdocao('a', 'p', 'Quero conhecer a Mia.', 'EU@exemplo.com', true)).toEqual(recibo);
    expect(m.rpc).toHaveBeenCalledWith('adocao_enviar_interesse', { p_tutor: 'a', p_pet: 'p', p_mensagem: 'Quero conhecer a Mia.', p_email: 'eu@exemplo.com', p_concordo: true });
    m.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(enviarInteresseAdocao('a', 'p', 'Quero conhecer a Mia.', 'eu@exemplo.com', true)).rejects.toThrow('confirmar');
  });
  it('descarta a confirmação de envio após troca de conta e não expõe erro interno', async () => {
    m.user.mockResolvedValueOnce({ data: { user: { id: 'a' } }, error: null }).mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
    await expect(enviarInteresseAdocao('a', 'p', 'Quero conhecer a Mia.', 'eu@exemplo.com', true)).rejects.toThrow('conta mudou');
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'internal database error' } });
    await expect(enviarInteresseAdocao('a', 'p', 'Quero conhecer a Mia.', 'eu@exemplo.com', true)).rejects.toThrow('Atualize a ficha');
  });
  it('recusa páginas incompletas e imagens que não são HTTPS público sem credenciais', () => {
    expect(conferirPaginaAdocao({ itens: [pet], tem_mais: false }).itens).toHaveLength(1);
    for (const invalido of [null, { itens: null, tem_mais: false }, { itens: [pet], tem_mais: true },
      ...[{ fotos: ['file:///privado'] }, { fotos: ['https://login:senha@exemplo.com/foto'] }, { especie: 'ave' }, { castrado: 'sim' }].map((v) => ({ itens: [{ ...pet, ...v }], tem_mais: false }))]) {
      expect(() => conferirPaginaAdocao(invalido)).toThrow('incompleta');
    }
    expect(fotoAdocao('javascript:alert(1)')).toBeNull(); expect(fotoAdocao('http://exemplo.com')).toBeNull();
  });
  it('calcula idade civil sem depender do fuso UTC e preserva idade desconhecida', () => {
    const hoje = new Date(2026, 9, 24, 12);
    expect(idadeAdocao('2026-10-20', hoje)).toBe('Menos de 1 mês'); expect(idadeAdocao('2026-07-25', hoje)).toBe('2 meses');
    expect(idadeAdocao('2025-10-24', hoje)).toBe('1 ano'); expect(idadeAdocao(null, hoje)).toBe('Idade não informada');
  });
  it('mescla páginas por ID sem repetir pets e aceita dados atualizados', () => {
    expect(juntarPaginaAdocao([pet], [{ ...pet, favorito: true }, { ...pet, id: 'q' }])).toEqual([{ ...pet, favorito: true }, { ...pet, id: 'q' }]);
  });
  it('envia todos os filtros e o cursor ao servidor com a conta esperada', async () => {
    await carregarPaginaAdocao('a', { ...FILTROS_ADOCAO, especie: 'gato', filhote: true, cidade: ' Iguaçu ', favoritos: true }, { id: 'q', criado_em: pet.criado_em });
    expect(m.rpc).toHaveBeenCalledWith('adocao_listar', expect.objectContaining({ p_tutor: 'a', p_especie: 'gato', p_cidade: 'Iguaçu', p_favoritos: true, p_antes_id: 'q', p_antes: pet.criado_em }));
  });
  it('interrompe consultas que pertencem a outra conta, antes e depois da resposta', async () => {
    m.user.mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
    await expect(carregarPaginaAdocao('a', FILTROS_ADOCAO)).rejects.toThrow('conta mudou'); expect(m.rpc).not.toHaveBeenCalled();
    m.user.mockResolvedValueOnce({ data: { user: { id: 'a' } }, error: null }).mockResolvedValueOnce({ data: { user: { id: 'b' } }, error: null });
    await expect(carregarPaginaAdocao('a', FILTROS_ADOCAO)).rejects.toThrow('conta mudou');
  });
  it('confirma favorito pelo resultado real e informa pet indisponível', async () => {
    m.rpc.mockResolvedValueOnce({ data: true, error: null }); expect(await favoritarAdocao('a', 'p', true)).toBe(true);
    m.rpc.mockResolvedValueOnce({ data: true, error: null }); await expect(favoritarAdocao('a', 'p', false)).rejects.toThrow('confirmar');
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Este pet não está disponível para adoção.' } }); await expect(favoritarAdocao('a', 'p', true)).rejects.toThrow('não está disponível');
  });
});
