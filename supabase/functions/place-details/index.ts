// PetLive: ficha do lugar no Google, só ao tocar (BUSINESS.md 5.15).
// Pedido: { placeId, basico? } -> { lugar: DetalheGoogle }
// "basico" (nome, posição, endereço) serve a lista de favoritos.
import {
  ErroLugares,
  clienteDoUsuario,
  consumirCota,
  detalhar,
  lerCorpo,
  resposta,
  respostaDeErro,
} from '../_shared/lugares.ts';

Deno.serve(async (req) => {
  try {
    const corpo = await lerCorpo<{ placeId: unknown; basico?: unknown }>(req);
    if (typeof corpo.placeId !== 'string') throw new ErroLugares('pedido', 'placeId obrigatório.');
    await consumirCota(clienteDoUsuario(req), 'detail');
    const lugar = await detalhar(corpo.placeId, corpo.basico === true);
    return resposta({ lugar });
  } catch (e) {
    return respostaDeErro(e);
  }
});
