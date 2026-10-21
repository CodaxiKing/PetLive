// PetLive: lugares pet por perto no Google (BUSINESS.md 5.15 e 5.19).
// Pedido: { lat, lng, categoria, raioKm? } -> { lugares: LugarGoogle[] }
import {
  CATEGORIAS,
  ErroLugares,
  buscarPorPerto,
  clienteDoUsuario,
  consumirCota,
  lerCorpo,
  numero,
  resposta,
  respostaDeErro,
  type Categoria,
} from '../_shared/lugares.ts';

Deno.serve(async (req) => {
  try {
    const corpo = await lerCorpo<{ lat: unknown; lng: unknown; categoria: unknown; raioKm?: unknown }>(req);
    const categoria = corpo.categoria as Categoria;
    if (!CATEGORIAS.includes(categoria)) throw new ErroLugares('pedido', 'Categoria inválida.');
    const lat = numero(corpo.lat, 'lat');
    const lng = numero(corpo.lng, 'lng');
    const raioKm = corpo.raioKm === undefined ? 5 : numero(corpo.raioKm, 'raioKm');

    await consumirCota(clienteDoUsuario(req), 'nearby');
    const lugares = await buscarPorPerto({ categoria, lat, lng, raioKm });
    return resposta({ lugares });
  } catch (e) {
    return respostaDeErro(e);
  }
});
