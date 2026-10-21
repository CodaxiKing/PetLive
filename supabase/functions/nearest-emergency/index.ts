// PetLive: clínica 24 h aberta mais perto (BUSINESS.md 5.17).
// Pedido: { lat, lng } -> { clinica, confirmada24h }
// Primeiro as que se dizem 24 h e estão abertas; senão a clínica aberta
// mais perto, que o app mostra com "confirme por telefone".
import {
  buscarPorPerto,
  clienteDoUsuario,
  consumirCota,
  lerCorpo,
  numero,
  resposta,
  respostaDeErro,
} from '../_shared/lugares.ts';

const RAIO_KM = 30;

Deno.serve(async (req) => {
  try {
    const corpo = await lerCorpo<{ lat: unknown; lng: unknown }>(req);
    const lat = numero(corpo.lat, 'lat');
    const lng = numero(corpo.lng, 'lng');
    const cliente = clienteDoUsuario(req);

    await consumirCota(cliente, 'nearby');
    const [do24h] = await buscarPorPerto({ categoria: '24h', lat, lng, raioKm: RAIO_KM, abertoAgora: true });
    if (do24h) return resposta({ clinica: do24h, confirmada24h: true });

    await consumirCota(cliente, 'nearby');
    const abertas = await buscarPorPerto({ categoria: 'clinica', lat, lng, raioKm: RAIO_KM, abertoAgora: true });
    return resposta({ clinica: abertas[0] ?? null, confirmada24h: false });
  } catch (e) {
    return respostaDeErro(e);
  }
});
