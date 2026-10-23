import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as Updates from 'expo-updates';
import type { UpdateCheckResult } from 'expo-updates';
import { verificarEAplicarAtualizacao } from '../lib/atualizacao';

vi.mock('expo-updates', () => ({
  isEnabled: true,
  UpdateCheckResultNotAvailableReason: {
    NO_UPDATE_AVAILABLE_ON_SERVER: 'noUpdateAvailableOnServer',
  },
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}));

const checkForUpdateAsync = vi.mocked(Updates.checkForUpdateAsync);
const fetchUpdateAsync = vi.mocked(Updates.fetchUpdateAsync);
const reloadAsync = vi.mocked(Updates.reloadAsync);

const atualizacaoNaoDisponivel: UpdateCheckResult = {
  isAvailable: false,
  manifest: undefined,
  isRollBackToEmbedded: false,
  reason: Updates.UpdateCheckResultNotAvailableReason.NO_UPDATE_AVAILABLE_ON_SERVER,
};

beforeEach(() => {
  vi.clearAllMocks();
  (Updates as unknown as Record<string, unknown>).isEnabled = true;
  checkForUpdateAsync.mockResolvedValue(atualizacaoNaoDisponivel);
});

afterEach(() => {
  (Updates as unknown as Record<string, unknown>).isEnabled = true;
});

describe('verificarEAplicarAtualizacao', () => {
  it('não busca nem recarrega quando expo-updates está desligado (Expo Go / build de desenvolvimento)', async () => {
    (Updates as unknown as Record<string, unknown>).isEnabled = false;

    await verificarEAplicarAtualizacao();

    expect(checkForUpdateAsync).not.toHaveBeenCalled();
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
  });

  it('busca, baixa e recarrega quando há atualização disponível', async () => {
    const atualizacaoDisponivel: UpdateCheckResult = {
      isAvailable: true,
      manifest: {} as Extract<UpdateCheckResult, { isAvailable: true }>['manifest'],
      isRollBackToEmbedded: false,
      reason: undefined,
    };
    checkForUpdateAsync.mockResolvedValueOnce(atualizacaoDisponivel);

    await verificarEAplicarAtualizacao();

    expect(checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('não baixa nem recarrega quando não há atualização', async () => {
    await verificarEAplicarAtualizacao();

    expect(checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
  });

  it('segue com o app em cache quando a verificação falha (sem rede)', async () => {
    checkForUpdateAsync.mockRejectedValueOnce(new Error('sem rede'));

    await expect(verificarEAplicarAtualizacao()).resolves.toBeUndefined();

    expect(checkForUpdateAsync).toHaveBeenCalledTimes(1);
    expect(fetchUpdateAsync).not.toHaveBeenCalled();
    expect(reloadAsync).not.toHaveBeenCalled();
  });
});
