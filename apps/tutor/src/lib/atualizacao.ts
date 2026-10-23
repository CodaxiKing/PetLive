import * as Updates from 'expo-updates';

/**
 * Verifica e aplica atualizações OTA (EAS Update) na inicialização do app.
 *
 * - Só roda em builds de release (`Updates.isEnabled`): desligado no Expo Go
 *   e em builds de desenvolvimento, que não recebem atualizações OTA.
 * - A atualização é entregue apenas a builds cujo `runtimeVersion` é
 *   compatível (aqui `appVersion`, igual à `version` do `app.json`), controlado
 *   pelo EAS Update. Mudanças só de JS, assets e fontes não precisam de nova
 *   revisão nas lojas; módulos nativos exigem build novo.
 * - Erros de rede ou servidor indisponível são engolidos: sem internet o app
 *   abre com o bundle já instalado e tenta de novo na próxima abertura.
 */
export async function verificarEAplicarAtualizacao(): Promise<void> {
  if (!Updates.isEnabled) return;

  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return;

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Sem rede ou servidor indisponível: segue com a versão em cache.
  }
}
