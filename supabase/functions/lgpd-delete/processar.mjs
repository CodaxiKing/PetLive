import { limparStorageConta } from './limpar-storage.mjs';

/** Uma reserva por invocação; falha não remove a conta nem renova implicitamente o prazo. */
export async function processarExclusao(cliente) {
  const { data: pedidos, error } = await cliente.rpc('lgpd_exclusao_reivindicar');
  if (error) throw new Error('Falha ao consultar fila de exclusão.');
  if (!Array.isArray(pedidos) || pedidos.length > 1) throw new Error('Resposta inválida da fila.');
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  for (const pedido of pedidos) {
    if (!uuid.test(pedido.pedido_id ?? '') || !uuid.test(pedido.user_id ?? '') || !uuid.test(pedido.lease ?? '')) {
      throw new Error('Reserva de exclusão inválida.');
    }
    const args = { p_pedido: pedido.pedido_id, p_lease: pedido.lease };
    const renovar = async () => {
      const { error: falha } = await cliente.rpc('lgpd_exclusao_renovar', args);
      if (falha) throw new Error('Reserva de processamento expirada.');
    };
    try {
      await renovar();
      await limparStorageConta(cliente.storage, pedido.user_id, renovar);
      await renovar();
      const { error: falha } = await cliente.rpc('lgpd_exclusao_concluir', args);
      if (falha) throw new Error('Não foi possível concluir a exclusão.');
    } catch {
      // A reserva vence e pode ser retomada. Não vaza erro do provedor ou identificadores.
      return { processados: 1, concluidos: 0, retentar: true };
    }
  }
  return { processados: pedidos.length, concluidos: pedidos.length, retentar: false };
}
