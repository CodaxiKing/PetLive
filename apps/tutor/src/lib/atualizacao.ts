import * as Updates from 'expo-updates';

let verificacaoEmAndamento: Promise<void> | null = null;

/**
 * Verifica e aplica atualizações OTA (EAS Update) na inicialização do app.
 *
 * - Só roda em builds de release (`Updates.isEnabled`): desligado no Expo Go
 *   e em builds de desenvolvimento, que não recebem atualizações OTA.
 * - A atualização é entregue apenas a builds cujo `runtimeVersion` é
 *   compatível (política `fingerprint` do app.json), controlado
 *   pelo EAS Update. Mudanças só de JS, assets e fontes não precisam de nova
 *   revisão nas lojas; módulos nativos exigem build novo.
 * - Erros de rede ou servidor indisponível são engolidos: sem internet o app
 *   abre com o bundle já instalado e tenta de novo na próxima abertura.
 */
export function verificarEAplicarAtualizacao(): Promise<void> {
  if (!Updates.isEnabled) return Promise.resolve();
  if (verificacaoEmAndamento) return verificacaoEmAndamento;
  verificacaoEmAndamento = aplicarAtualizacao().finally(() => {
    verificacaoEmAndamento = null;
  });
  return verificacaoEmAndamento;
}

async function aplicarAtualizacao(): Promise<void> {
  try {
    const consulta = await Updates.checkForUpdateAsync();
    // No rollback isAvailable é false: a diretiva tem seu próprio indicador.
    if (!consulta.isAvailable && !consulta.isRollBackToEmbedded) return;

    const download = await Updates.fetchUpdateAsync();
    if (!download.isNew && !download.isRollBackToEmbedded) return;
    await Updates.reloadAsync();
  } catch {
    // Sem rede ou servidor indisponível: segue com a versão em cache.
  }
}
