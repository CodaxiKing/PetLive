import type { SupabaseClient } from "@supabase/supabase-js";

export const STATUS_LOJA = { rascunho: "Rascunho", em_analise: "Em análise", aprovada: "Aprovada", correcao_pedida: "Correção solicitada", recusada: "Recusada", suspensa: "Suspensa" } as const;
export const PAPEL_LOJA = { owner: "Responsável", manager: "Gerente", staff: "Equipe" } as const;
export const CHECKLIST_LOJA = { dados: "Dados da loja", endereco: "Endereço", contato: "Contato", documentos: "Documentos", catalogo: "Catálogo", horarios: "Horários", canal: "Retirada, entrega ou serviços" } as const;
export type LojaDaConta = { id: string; name: string; status: keyof typeof STATUS_LOJA; role: keyof typeof PAPEL_LOJA; motivo_status: string | null; lugar_pendente: boolean; checklist: Record<keyof typeof CHECKLIST_LOJA, boolean> };
function registro(v: unknown): v is Record<string, unknown> { return !!v && typeof v === "object" && !Array.isArray(v); }
export function conferirLojas(valor: unknown): LojaDaConta[] {
  if (!Array.isArray(valor)) throw new Error("Não foi possível conferir suas lojas. Tente novamente.");
  const ids = new Set<string>();
  return valor.map(v => {
    if (!registro(v) || typeof v.id !== "string" || !v.id || ids.has(v.id) || typeof v.name !== "string" || !v.name.trim() ||
      typeof v.status !== "string" || !Object.hasOwn(STATUS_LOJA, v.status) || typeof v.role !== "string" || !Object.hasOwn(PAPEL_LOJA, v.role) ||
      (v.motivo_status !== null && typeof v.motivo_status !== "string") || typeof v.lugar_pendente !== "boolean" || !registro(v.checklist))
      throw new Error("Resposta de lojas inválida. Atualize o painel.");
    const checklist = v.checklist;
    if (!Object.keys(CHECKLIST_LOJA).every(k => typeof checklist[k] === "boolean")) throw new Error("Checklist de loja incompleto.");
    ids.add(v.id);
    return { id: v.id, name: v.name, status: v.status, role: v.role, motivo_status: v.motivo_status,
      lugar_pendente: v.lugar_pendente, checklist: Object.fromEntries(Object.keys(CHECKLIST_LOJA).map(k => [k, checklist[k]])) } as LojaDaConta;
  });
}

/** A lista e a autorização vêm do backend; nunca infere acesso pelo e-mail. */
export async function carregarAcessoLojista(cliente: Pick<SupabaseClient, "auth" | "rpc">) {
  const inicial = await cliente.auth.getSession();
  if (inicial.error) throw new Error("Não foi possível conferir sua sessão.");
  const sessao = inicial.data.session;
  if (!sessao) return null;
  const { data, error } = await cliente.rpc("minhas_lojas");
  if (error) throw new Error("Não foi possível carregar suas lojas. Confira sua conexão e tente novamente.");
  const atual = await cliente.auth.getSession();
  if (atual.error || atual.data.session?.user.id !== sessao.user.id) throw new Error("A conta mudou. Entre novamente.");
  return { usuario: { id: sessao.user.id, email: sessao.user.email ?? "" }, lojas: conferirLojas(data) };
}
