// Comparação da foto de quem achou um pet com as fotos de alertas ativos
// (BUSINESS.md 5.38). Usada pela função find-lost-pet e pelo script que mede
// a precisão antes de ligar o recurso (supabase/tests/achei-precisao.ts).
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/zod';
import { z } from 'npm:zod@4.6.7';

export const TIPOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MODELO_COMPARACAO = 'claude-opus-5-5';
export type Imagem = { data: string; tipo: (typeof TIPOS)[number] };

export const NIVEIS = ['muito_parecido', 'parecido', 'pouco_parecido', 'diferente'] as const;

export const Comparacao = z.object({
  foto_valida: z.boolean(),
  motivo: z.enum(['ok', 'sem_pet', 'pessoa_no_rosto', 'muito_escura_ou_borrada']),
  candidatos: z.array(z.object({ numero: z.number().int(), nivel: z.enum(NIVEIS) })),
});

export const INSTRUCOES = `Você ajuda a reencontrar cães e gatos perdidos no Brasil.
A primeira imagem é a foto que uma pessoa tirou de um pet que achou na rua. As outras são fotos de pets perdidos, numeradas a partir de 1.
Compare a primeira imagem com cada foto numerada e diga, para cada número, o quanto parece o mesmo animal:
- muito_parecido: mesma espécie, mesmas cores e marcas, mesmo formato de focinho e orelhas; nada contradiz.
- parecido: mesma espécie e pelagem parecida, mas a foto não deixa conferir as marcas.
- pouco_parecido: algo em comum, mas há diferenças visíveis.
- diferente: outra espécie ou pelagem claramente diferente.
Seja conservador: muitos pets são parecidos. Na dúvida, escolha o nível mais baixo. Não considere fundo, coleira ou roupa.
foto_valida=false quando a primeira imagem não mostra um cão ou gato (motivo sem_pet), quando o rosto de uma pessoa aparece em destaque (motivo pessoa_no_rosto) ou quando está escura ou borrada demais (motivo muito_escura_ou_borrada). Nesses casos, devolva a lista vazia.`;

export type ResultadoComparacao = z.infer<typeof Comparacao>;

/** Compara a foto com as fotos numeradas (1..n). Devolve null se o modelo recusar. */
export async function comparar(client: Anthropic, achado: Imagem, alertas: (Imagem & { especie: string })[]): Promise<ResultadoComparacao | null> {
  const conteudo: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: 'Foto de quem achou o pet:' },
    { type: 'image', source: { type: 'base64', media_type: achado.tipo, data: achado.data } },
  ];
  alertas.forEach((foto, i) => {
    conteudo.push({ type: 'text', text: `Pet perdido ${i + 1} (${foto.especie === 'gato' ? 'gato' : 'cão'}):` });
    conteudo.push({ type: 'image', source: { type: 'base64', media_type: foto.tipo, data: foto.data } });
  });
  const resposta = await client.messages.parse({
    model: MODELO_COMPARACAO,
    max_tokens: 16000,
    output_config: { effort: 'low', format: zodOutputFormat(Comparacao) },
    system: INSTRUCOES,
    messages: [{ role: 'user', content: conteudo }],
  });
  if (resposta.stop_reason === 'refusal' || !resposta.parsed_output) return null;
  return resposta.parsed_output;
}
