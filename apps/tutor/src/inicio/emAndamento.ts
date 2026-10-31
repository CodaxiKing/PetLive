import type { Href } from 'expo-router'
import { STATUS_FINAIS, TEXTO_STATUS, type Solicitacao } from '../loja/loja'
import type { PedidoAlbum } from '../pets/albumPedido'

/**
 * "Em andamento" na tela inicial: o que o tutor começou e ainda espera uma
 * ação dele ou de alguém (Pix por pagar, loja respondendo, ida à clínica,
 * álbum na gráfica). Some sozinho quando termina.
 */
export type ItemAndamento = { chave: string; titulo: string; sub: string; destino: Href; urgente: boolean }

export function itensEmAndamento(
  pedidos: Pick<Solicitacao, 'id' | 'numero' | 'status' | 'loja' | 'starts_at' | 'itens'>[],
  chegadaId: string | null,
  albuns: Pick<PedidoAlbum, 'id' | 'numero' | 'status' | 'ano' | 'pet_nome'>[],
): ItemAndamento[] {
  const itens: ItemAndamento[] = []
  if (chegadaId) {
    itens.push({ chave: `sos:${chegadaId}`, titulo: 'Indo para a clínica', sub: 'Veja a resposta e toque em Cheguei', destino: { pathname: '/sos/chegada/[id]', params: { id: chegadaId } }, urgente: true })
  }
  for (const p of pedidos) {
    if (STATUS_FINAIS.includes(p.status)) continue
    const pix = p.status === 'aguardando_pagamento'
    itens.push({
      chave: `pedido:${p.id}`,
      titulo: pix ? `Pedido nº ${p.numero}: falta o Pix` : `${p.itens[0]?.nome ?? 'Pedido'} · ${p.loja.name}`,
      sub: pix ? `${p.loja.name} só recebe depois do pagamento` : TEXTO_STATUS[p.status],
      destino: pix ? { pathname: '/pagamento/pix', params: { pedido: p.id } } : `/pedidos/${p.id}`,
      urgente: pix,
    })
  }
  for (const a of albuns) {
    if (a.status !== 'aguardando_pagamento') continue
    itens.push({
      chave: `album:${a.id}`,
      titulo: `Álbum ${a.ano} de ${a.pet_nome}: falta o Pix`,
      sub: `Pedido nº ${a.numero}`,
      destino: { pathname: '/pagamento/pix', params: { album: a.id } },
      urgente: true,
    })
  }
  // O que depende do tutor vem primeiro; no máximo três para não virar outra lista.
  return itens.sort((x, y) => Number(y.urgente) - Number(x.urgente)).slice(0, 3)
}
