import { beforeEach, describe, expect, it, vi } from 'vitest';
import { atualizarProximo, CHAVE_WIDGET, confirmarDoseWidget, conferirProximoAtual, ocultarRemedio, ultimoProximo } from '../widget/proximo';

const m = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), rpc: vi.fn(), get: vi.fn(), set: vi.fn(), remove: vi.fn(), criar: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: m.get, setItem: m.set, removeItem: m.remove } }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: m.session } }, criarClienteTemporario: m.criar }));
const sessao = (id = 'a') => ({ data: { session: { user: { id }, access_token: `token-${id}` } }, error: null });
const proximo = { tipo: 'vacina', tutor_id: 'a', pet: 'Rex', pet_id: 'pet', vacina: 'V10', data: '2030-01-01' };
function consulta(resultado: unknown) {
  const q: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'lte', 'gte', 'or', 'order', 'limit', 'in', 'not']) q[metodo] = () => q;
  q.then = (resolver: (r: unknown) => void, rejeitar: (e: unknown) => void) => Promise.resolve(resultado).then(resolver, rejeitar);
  return q;
}
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue(sessao());
  m.criar.mockReturnValue({ from: m.from, rpc: m.rpc });
  m.from.mockImplementation(() => consulta({ data: [], error: null }));
  m.set.mockResolvedValue(undefined); m.remove.mockResolvedValue(undefined);
  m.rpc.mockResolvedValue({ data: {}, error: null });
});

describe('widget vinculado à conta', () => {
  it('esconde o medicamento quando não consegue ler a preferência de privacidade', async () => {
    m.get.mockRejectedValueOnce(new Error('armazenamento indisponível'));
    expect(await ocultarRemedio()).toBe(true);
    m.get.mockResolvedValueOnce(null);
    expect(await ocultarRemedio()).toBe(false);
  });
  it('preserva confirmação salva e bloqueia cache antigo quando a limpeza local falha', async () => {
    m.session.mockResolvedValue(sessao('cache-falhou'));
    m.remove.mockRejectedValue(new Error('armazenamento indisponível'));
    await expect(confirmarDoseWidget('m', '2026-10-26T12:00:00Z', 'cache-falhou')).resolves.toBeUndefined();
    m.get.mockResolvedValue(JSON.stringify({ tutor: 'cache-falhou', atualizado: Date.now(), proximo: { ...proximo, tutor_id: 'cache-falhou' } }));
    expect(await ultimoProximo()).toBeNull();
    await atualizarProximo();
    expect(await ultimoProximo()).toMatchObject({ offline: true });
  });
  it('descarta consulta concorrente que terminou após confirmar uma dose', async () => {
    m.set.mockImplementationOnce(async () => {
      await confirmarDoseWidget('m', '2026-10-26T12:00:00Z', 'a');
    });
    await expect(atualizarProximo()).rejects.toThrow('doses mudaram');
    expect(await ultimoProximo()).toBeNull();
    await atualizarProximo();
  });
  it('consulta com credencial capturada e grava somente o cache do titular', async () => {
    await atualizarProximo();
    expect(m.criar).toHaveBeenCalledWith('token-a');
    expect(m.set).toHaveBeenCalledWith(`${CHAVE_WIDGET}:v2:a`, expect.stringContaining('"tutor":"a"'));
  });
  it('descarta consulta que terminou depois da troca de conta', async () => {
    m.session.mockResolvedValueOnce(sessao('a')).mockResolvedValue(sessao('b'));
    await expect(atualizarProximo()).rejects.toThrow('conta mudou');
    expect(m.set).not.toHaveBeenCalled();
  });
  it('não interpreta falha de consulta das doses como nenhuma dose confirmada', async () => {
    m.from.mockImplementation((tabela) => consulta(tabela === 'medications'
      ? { data: [{ id: 'm', pet_id: 'p', nome: 'Remédio', dose: '1', horarios: ['12:00'], inicio: '2026-01-01', fim: null, pets: { nome: 'Rex' } }] }
      : tabela === 'medication_doses' ? { data: null, error: { message: 'sem rede' } } : { data: [] }));
    await expect(atualizarProximo()).rejects.toThrow('doses já dadas');
    expect(m.set).not.toHaveBeenCalled();
  });
  it('só oferece cópia recente da própria conta e sinaliza offline', async () => {
    m.get.mockResolvedValue(JSON.stringify({ tutor: 'a', atualizado: Date.now(), proximo }));
    expect(await ultimoProximo()).toMatchObject({ tutor_id: 'a', offline: true });
    expect(m.get).toHaveBeenCalledWith(`${CHAVE_WIDGET}:v2:a`);
    for (const cache of [proximo, { tutor: 'b', atualizado: Date.now(), proximo },
      { tutor: 'a', atualizado: Date.now() - 16 * 60_000, proximo }, { tutor: 'a', atualizado: Date.now() + 60_000, proximo }]) {
      m.get.mockResolvedValue(JSON.stringify(cache)); expect(await ultimoProximo()).toBeNull();
    }
  });
  it('não usa cache após logout, troca de conta ou erro de sessão', async () => {
    m.get.mockResolvedValue(JSON.stringify({ tutor: 'a', atualizado: Date.now(), proximo }));
    m.session.mockResolvedValueOnce(sessao('a')).mockResolvedValueOnce(sessao('b'));
    expect(await ultimoProximo()).toBeNull();
    m.session.mockResolvedValue({ data: { session: null }, error: null });
    expect(await ultimoProximo()).toEqual({ tipo: 'sem_conta' });
    m.session.mockResolvedValue({ data: {}, error: new Error('falha') });
    expect(await ultimoProximo()).toBeNull();
  });
  it('recusa botão antigo de outra conta antes de chamar o servidor', async () => {
    await expect(confirmarDoseWidget('m', '2026-10-26T12:00:00Z', 'b')).rejects.toThrow('conta mudou');
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('confere novamente a conta antes de apresentar o resultado no launcher', async () => {
    m.session.mockResolvedValue(sessao('b'));
    expect(await conferirProximoAtual(proximo as never)).toBeNull();
    m.session.mockResolvedValue({ data: { session: null } });
    expect(await conferirProximoAtual(proximo as never)).toEqual({ tipo: 'sem_conta' });
  });
  it('propaga falha de confirmação e limpa cache só após sucesso', async () => {
    m.rpc.mockResolvedValueOnce({ error: { message: 'sem conexão' } });
    await expect(confirmarDoseWidget('m', '2026-10-26T12:00:00Z', 'a')).rejects.toThrow('sem conexão');
    expect(m.remove).not.toHaveBeenCalled();
    await confirmarDoseWidget('m', '2026-10-26T12:00:00Z', 'a');
    expect(m.rpc).toHaveBeenCalledWith('registrar_dose', expect.objectContaining({ p_origem: 'widget' }));
    expect(m.remove).toHaveBeenCalledWith(`${CHAVE_WIDGET}:v2:a`);
  });
});
