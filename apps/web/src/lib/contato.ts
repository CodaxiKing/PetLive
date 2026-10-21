/**
 * Envio dos formulários do site (contato e interesse de lojistas) para a
 * função registrar_contato_site do Supabase, que valida e limita os envios.
 * Sem as variáveis do Supabase, o formulário mostra o e-mail como saída.
 */
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const EMAIL_CONTATO = "contato@petlive.app.br";
export const EMAIL_PARCEIROS = "parceiros@petlive.app.br";

export const contatoConfigurado = Boolean(URL_SUPABASE && CHAVE_ANON);

export type DadosContato = {
  tipo: "contato" | "lojista";
  nome: string;
  email: string;
  telefone?: string;
  mensagem?: string;
  lojaNome?: string;
  lojaTipo?: string;
  cidade?: string;
  /** Campo escondido: só robô preenche. */
  isca?: string;
};

export type ResultadoContato = "ok" | "limite" | "invalido" | "erro";

export async function enviarContato(dados: DadosContato): Promise<ResultadoContato> {
  if (!contatoConfigurado) return "erro";
  try {
    const resposta = await fetch(`${URL_SUPABASE}/rest/v1/rpc/registrar_contato_site`, {
      method: "POST",
      headers: {
        apikey: CHAVE_ANON,
        Authorization: `Bearer ${CHAVE_ANON}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_tipo: dados.tipo,
        p_nome: dados.nome,
        p_email: dados.email,
        p_telefone: dados.telefone || null,
        p_mensagem: dados.mensagem || null,
        p_loja_nome: dados.lojaNome || null,
        p_loja_tipo: dados.lojaTipo || null,
        p_cidade: dados.cidade || null,
        p_isca: dados.isca || null,
      }),
    });
    if (resposta.status === 400) return "invalido";
    if (!resposta.ok) return "erro";
    const corpo: unknown = await resposta.json();
    return corpo === "limite" ? "limite" : "ok";
  } catch {
    return "erro";
  }
}
