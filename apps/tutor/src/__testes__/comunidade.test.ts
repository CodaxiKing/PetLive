import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarCurtida, comentar, idadeTexto, publicar, type Post } from '../comunidade/comunidade';

const m = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: m.rpc, storage: { from: () => ({ upload: m.upload, remove: m.remove }) } },
}));

beforeEach(() => {
  vi.clearAllMocks();
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(10) })));
});

const post = (p: Partial<Post> = {}): Post => ({
  id: 'p1', pet_id: 'pet', pet: 'Rex', especie: 'cao', pet_foto: null, autor: 'Ana', meu: false, foto_path: 'a/b.jpg',
  legenda: null, criado_em: '2026-10-25T10:00:00Z', curtidas: 3, curti: false, comentarios: 0, ...p,
});

describe('comunidade', () => {
  it('publica com a foto na pasta da conta', async () => {
    m.rpc.mockResolvedValue({ data: 'novo', error: null });
    expect(await publicar('u1', 'pet', { uri: 'file://x.jpg', mimeType: 'image/jpeg' }, '  Oi  ')).toBe('novo');
    expect(m.upload).toHaveBeenCalledWith('u1/uuid.jpg', expect.any(ArrayBuffer), { contentType: 'image/jpeg', upsert: false });
    expect(m.rpc).toHaveBeenCalledWith('comunidade_publicar', { p_pet: 'pet', p_foto_path: 'u1/uuid.jpg', p_legenda: 'Oi' });
  });

  it('apaga a foto enviada se o post for recusado', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'Ligue o perfil público do pet para publicar.' } });
    await expect(publicar('u1', 'pet', { uri: 'file://x.png', mimeType: 'image/png' }, '')).rejects.toThrow('perfil público');
    expect(m.remove).toHaveBeenCalledWith(['u1/uuid.png']);
  });

  it('não envia comentário vazio', async () => {
    await expect(comentar('p1', '   ')).rejects.toThrow('Escreva');
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('atualiza a curtida sem contar duas vezes', () => {
    const [curtido] = aplicarCurtida([post()], 'p1', true);
    expect(curtido).toMatchObject({ curti: true, curtidas: 4 });
    expect(aplicarCurtida([curtido], 'p1', true)[0].curtidas).toBe(4);
    expect(aplicarCurtida([curtido], 'p1', false)[0]).toMatchObject({ curti: false, curtidas: 3 });
  });

  it('mostra a idade em meses ou anos', () => {
    const hoje = new Date('2026-10-25T12:00:00');
    expect(idadeTexto('2024-09-01', hoje)).toBe('2 anos');
    expect(idadeTexto('2026-02-10', hoje)).toBe('8 meses');
    expect(idadeTexto('2026-10-10', hoje)).toBe('filhote');
    expect(idadeTexto(null, hoje)).toBeNull();
  });
});
