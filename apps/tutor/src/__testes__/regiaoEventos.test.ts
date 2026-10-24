import { beforeEach, describe, expect, it, vi } from 'vitest';
import { carregarRegiaoEventos, desligarRegiaoEventos, salvarRaioEventos, usarRegiaoAtualEventos } from '../notificacoes/regiaoEventos';
const m = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), permissao: vi.fn(), servicos: vi.fn(), posicao: vi.fn() }));
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: m.getUser }, rpc: m.rpc } }));
vi.mock('expo-location', () => ({ Accuracy: { Balanced: 3 }, requestForegroundPermissionsAsync: m.permissao,
  hasServicesEnabledAsync: m.servicos, getCurrentPositionAsync: m.posicao }));
beforeEach(() => {
  vi.resetAllMocks();
  m.getUser.mockResolvedValue({ data: { user: { id: 'tutor' } }, error: null });
  m.rpc.mockResolvedValue({ data: { ativo: true, raio_km: 10, atualizado_em: null, expira_em: null }, error: null });
  m.permissao.mockResolvedValue({ granted: true }); m.servicos.mockResolvedValue(true);
  m.posicao.mockResolvedValue({ coords: { latitude: -22.753456, longitude: -43.451234, accuracy: 30 }, timestamp: Date.now() });
});
describe('avisos por região aproximada', () => {
  it('só pede localização ao ativar/atualizar e envia coordenadas arredondadas, sem trajeto', async () => {
    await usarRegiaoAtualEventos('tutor', 10);
    expect(m.posicao).toHaveBeenCalledWith({ accuracy: 3 });
    expect(m.rpc).toHaveBeenCalledWith('eventos_regiao_configurar', { p_tutor: 'tutor', p_ativo: true, p_raio: 10, p_lat: -22.75, p_lng: -43.45 });
  });
  it('ler, trocar raio ou apagar região não inicia localização', async () => {
    await carregarRegiaoEventos('tutor'); await salvarRaioEventos('tutor', 25); await desligarRegiaoEventos('tutor');
    expect(m.permissao).not.toHaveBeenCalled(); expect(m.posicao).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith('eventos_regiao_configurar', { p_tutor: 'tutor', p_ativo: false, p_raio: 10, p_lat: null, p_lng: null });
  });
  it('permissão negada ou GPS desligado não ativa avisos', async () => {
    m.permissao.mockResolvedValueOnce({ granted: false });
    await expect(usarRegiaoAtualEventos('tutor', 10)).rejects.toThrow('Autorize');
    m.servicos.mockResolvedValueOnce(false);
    await expect(usarRegiaoAtualEventos('tutor', 10)).rejects.toThrow('Ative');
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('recusa região antiga, incerta, inválida ou sem precisão conhecida', async () => {
    for (const coords of [ { latitude: NaN, longitude: 0, accuracy: 10 }, { latitude: 0, longitude: 181, accuracy: 10 },
      { latitude: 0, longitude: 0, accuracy: null }, { latitude: 0, longitude: 0, accuracy: 5000 } ]) {
      m.posicao.mockResolvedValueOnce({ coords, timestamp: Date.now() });
      await expect(usarRegiaoAtualEventos('tutor', 10)).rejects.toThrow('confiança');
    }
    m.posicao.mockResolvedValueOnce({ coords: { latitude: 0, longitude: 0, accuracy: 10 }, timestamp: Date.now() - 300000 });
    await expect(usarRegiaoAtualEventos('tutor', 10)).rejects.toThrow('confiança');
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('troca de conta durante a leitura GPS impede o envio da região', async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'outro' } } });
    await expect(usarRegiaoAtualEventos('tutor', 10)).rejects.toThrow('nesta conta');
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('troca de conta durante RPC impede aplicar resposta à tela da conta antiga', async () => {
    m.getUser.mockResolvedValueOnce({ data: { user: { id: 'tutor' } } }).mockResolvedValueOnce({ data: { user: { id: 'outro' } } });
    await expect(carregarRegiaoEventos('tutor')).rejects.toThrow('nesta conta');
    expect(m.rpc).toHaveBeenCalledWith('eventos_regiao_consultar', { p_tutor: 'tutor' });
  });
  it('raio inválido não pede permissão e falha de rede não anuncia sucesso', async () => {
    await expect(usarRegiaoAtualEventos('tutor', 3)).rejects.toThrow('raios');
    await expect(salvarRaioEventos('tutor', 0)).rejects.toThrow('raios');
    expect(m.permissao).not.toHaveBeenCalled();
    m.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(desligarRegiaoEventos('tutor')).rejects.toThrow('conexão');
  });
});
