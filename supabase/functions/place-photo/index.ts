// PetLive: foto do lugar sob demanda (BUSINESS.md 5.15).
// Pedido: { nome, larguraPx? } -> { uri } (endereço temporário da imagem)
import {
  ErroLugares,
  clienteDoUsuario,
  consumirCota,
  enderecoDaFoto,
  lerCorpo,
  resposta,
  respostaDeErro,
} from '../_shared/lugares.ts';

Deno.serve(async (req) => {
  try {
    const corpo = await lerCorpo<{ nome: unknown; larguraPx?: unknown }>(req);
    if (typeof corpo.nome !== 'string') throw new ErroLugares('pedido', 'nome da foto obrigatório.');
    const largura = typeof corpo.larguraPx === 'number' ? corpo.larguraPx : 800;
    await consumirCota(clienteDoUsuario(req), 'photo');
    const uri = await enderecoDaFoto(corpo.nome, largura);
    return resposta({ uri });
  } catch (e) {
    return respostaDeErro(e);
  }
});
