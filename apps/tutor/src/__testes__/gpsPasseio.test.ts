import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gpsPasseio } from '../passeios/gps';
const mocks = vi.hoisted(() => ({ pedir: vi.fn(), servicos: vi.fn(), observar: vi.fn(), remover: vi.fn(), app: { currentState: 'active' } }));
vi.mock('react-native', () => ({ AppState: mocks.app }));
vi.mock('expo-location', () => ({ requestForegroundPermissionsAsync: mocks.pedir, hasServicesEnabledAsync: mocks.servicos, watchPositionAsync: mocks.observar, Accuracy: { High: 4 } }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.app.currentState = 'active';
  mocks.pedir.mockResolvedValue({ granted: true, android: { accuracy: 'fine' } });
  mocks.servicos.mockResolvedValue(true); mocks.observar.mockResolvedValue({ remove: mocks.remover });
});
describe('GPS do passeio', () => {
  it('exige permissão e localização precisa sem criar um observador inválido', async () => {
    mocks.pedir.mockResolvedValueOnce({ granted: false });
    await expect(gpsPasseio.observar(vi.fn(), vi.fn())).rejects.toThrow('Autorize');
    mocks.pedir.mockResolvedValueOnce({ granted: true, android: { accuracy: 'coarse' } });
    await expect(gpsPasseio.observar(vi.fn(), vi.fn())).rejects.toThrow('precisa');
    expect(mocks.observar).not.toHaveBeenCalled();
  });
  it('recusa GPS desligado ou app fora do primeiro plano', async () => {
    mocks.servicos.mockResolvedValueOnce(false);
    await expect(gpsPasseio.observar(vi.fn(), vi.fn())).rejects.toThrow('Ative o GPS');
    mocks.app.currentState = 'background';
    await expect(gpsPasseio.observar(vi.fn(), vi.fn())).rejects.toThrow('Volte ao app');
    expect(mocks.observar).not.toHaveBeenCalled();
  });
  it('mapeia coordenadas e erro, preservando a remoção da assinatura', async () => {
    const ponto = vi.fn(), erro = vi.fn();
    const remover = await gpsPasseio.observar(ponto, erro);
    const [, receber, falhar] = mocks.observar.mock.calls[0];
    receber({ coords: { latitude: -22, longitude: -43, accuracy: null }, timestamp: 1234 });
    expect(ponto).toHaveBeenCalledWith({ lat: -22, lng: -43, precisao: Infinity, instante: 1234 });
    falhar('GPS perdeu sinal'); expect(erro).toHaveBeenCalledWith(expect.stringContaining('pausado'));
    remover(); expect(mocks.remover).toHaveBeenCalledTimes(1);
  });
});
