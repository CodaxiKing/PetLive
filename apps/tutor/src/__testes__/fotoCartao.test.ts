import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conferirArquivoCartao, descartarFotoCartao, salvarFotoCartao } from '../saude/fotoCartao';
import { dadosFotoCartao, tamanhoFotoCartao, validarFotoCartao } from '../saude/fotoCartaoDados';
const m = vi.hoisted(() => ({ getUser: vi.fn(), perfil: vi.fn(), pet: vi.fn(), enviar: vi.fn(), salvar: vi.fn(), remover: vi.fn(), apagar: vi.fn(), size: 1000, exists: true }));
vi.mock('expo-file-system', () => ({ Paths: { cache: { uri: 'file:///cache/' } }, File: class {
  get exists() { return m.exists; } get size() { return m.size; } delete() { m.apagar(); }
} }));
vi.mock('../saude/documentos', () => ({ enviarDocumentoSaude: m.enviar, salvarDocumentoSaude: m.salvar }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: m.getUser },
  from: (t: string) => { const q = { select: () => q, eq: () => q, maybeSingle: () => t === 'profiles' ? m.perfil() : m.pet() }; return q; },
  storage: { from: () => ({ remove: m.remover }) } } }));
const foto = { uri: 'file:///cache/cartao.jpg', width: 1920, height: 1080 };
beforeEach(() => {
  vi.resetAllMocks(); m.size = 1000; m.exists = true;
  m.getUser.mockResolvedValue({ data: { user: { id: 'tutor' } }, error: null });
  m.perfil.mockResolvedValue({ data: { plano: 'premium' }, error: null });
  m.pet.mockResolvedValue({ data: { id: 'pet', tutor_id: 'tutor' }, error: null });
  m.enviar.mockResolvedValue('tutor/saude/pet/foto.jpg'); m.salvar.mockResolvedValue(undefined); m.remover.mockResolvedValue({ error: null });
});
describe('foto guiada do cartão', () => {
  it('escolhe uma resolução legível sem preferir fotos enormes quando há alternativa', () => {
    expect(tamanhoFotoCartao(['4000x3000', '1920x1080', '640x480', 'inválido'])).toBe('1920x1080');
    expect(tamanhoFotoCartao(['4000x3000', '3000x2000'])).toBe('3000x2000');
    expect(tamanhoFotoCartao(['640x480'])).toBeUndefined();
  });
  it('valida nome/data e não inventa vacinas a partir do anexo', () => {
    expect(dadosFotoCartao('', '24/10/2026')).toEqual({ titulo: 'Cartão de vacina', realizadoEm: '2026-10-24' });
    expect(() => dadosFotoCartao('a', '24/10/2026')).toThrow('nome');
    expect(() => dadosFotoCartao('x'.repeat(81), '24/10/2026')).toThrow();
    expect(() => dadosFotoCartao('', '31/02/2026')).toThrow('data');
    expect(dadosFotoCartao('', '29/02/2024').realizadoEm).toBe('2024-02-29');
  });
  it('recusa URI externa, pouca resolução e arquivo vazio/grande ou ausente', () => {
    expect(validarFotoCartao(foto, 1000)).toEqual(foto);
    for (const p of [{ ...foto, uri: 'https://externa/foto' }, { ...foto, width: 100 }, { ...foto, height: NaN }]) expect(() => validarFotoCartao(p, 1000)).toThrow();
    for (const n of [0, NaN, 11 * 1024 * 1024]) expect(() => validarFotoCartao(foto, n)).toThrow();
    m.exists = false; expect(() => conferirArquivoCartao(foto)).toThrow('temporária');
  });
  it('só envia após confirmar Premium, pet e conta; salva como anexo privado', async () => {
    await salvarFotoCartao('tutor', 'pet', foto, ' Meu cartão ', '24/10/2026');
    expect(m.enviar).toHaveBeenCalledWith('tutor', 'pet', foto.uri, 'image/jpeg');
    expect(m.salvar).toHaveBeenCalledWith({ tutor_id: 'tutor', pet_id: 'pet', tipo: 'cartao_vacina', titulo: 'Meu cartão', realizado_em: '2026-10-24', arquivo_path: 'tutor/saude/pet/foto.jpg' });
    expect(m.remover).not.toHaveBeenCalled();
  });
  it('não envia para conta/pet diferente ou com plano não confirmado', async () => {
    m.perfil.mockResolvedValueOnce({ data: { plano: 'gratis' }, error: null });
    await expect(salvarFotoCartao('tutor', 'pet', foto, '', '24/10/2026')).rejects.toThrow('Premium');
    m.pet.mockResolvedValueOnce({ data: { tutor_id: 'outro' }, error: null });
    await expect(salvarFotoCartao('tutor', 'pet', foto, '', '24/10/2026')).rejects.toThrow('pet');
    expect(m.enviar).not.toHaveBeenCalled();
  });
  it('falha de gravação limpa o upload novo, mantendo foto temporária para tentar de novo', async () => {
    m.salvar.mockRejectedValueOnce(new Error('falhou'));
    await expect(salvarFotoCartao('tutor', 'pet', foto, '', '24/10/2026')).rejects.toThrow('falhou');
    expect(m.remover).toHaveBeenCalledWith(['tutor/saude/pet/foto.jpg']); expect(m.apagar).not.toHaveBeenCalled();
  });
  it('conta trocada após envio bloqueia o registro e tenta remover só a imagem enviada', async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'outro' } } });
    await expect(salvarFotoCartao('tutor', 'pet', foto, '', '24/10/2026')).rejects.toThrow('conta');
    expect(m.salvar).not.toHaveBeenCalled(); expect(m.remover).toHaveBeenCalledTimes(1);
  });
  it('troca de conta após confirmação não apaga anexo já registrado', async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'outro' } } });
    await expect(salvarFotoCartao('tutor', 'pet', foto, '', '24/10/2026')).rejects.toThrow('conta');
    expect(m.salvar).toHaveBeenCalledTimes(1); expect(m.remover).not.toHaveBeenCalled();
  });
  it('descarta somente arquivos de cache da câmera, sem apagar fotos persistentes', () => {
    descartarFotoCartao(foto.uri); expect(m.apagar).toHaveBeenCalledTimes(1);
    descartarFotoCartao('file:///documents/foto.jpg'); expect(m.apagar).toHaveBeenCalledTimes(1);
    descartarFotoCartao('file:///cache/../documents/foto.jpg'); expect(m.apagar).toHaveBeenCalledTimes(1);
  });
});
