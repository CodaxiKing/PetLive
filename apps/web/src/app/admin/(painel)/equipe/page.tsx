"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cabecalho, haQuanto, useAdmin } from "@/components/admin/Painel";
import { ROTULO_PAPEL, rpcAdmin, type Papel } from "@/lib/admin/supabase";

type Membro = { user_id: string; nome: string; email: string; papel: Papel; ativo: boolean; ultimo_acesso: string | null; tem_2fa: boolean };
type Acao = { quando: string; quem: string; acao: string; alvo_tipo: string | null; alvo: string | null };

const COR_PAPEL: Record<Papel, string> = {
  super: "bg-roxo-fundo text-roxo-texto",
  financeiro: "bg-verde-fundo text-verde-texto",
  suporte: "bg-azul-fundo text-azul-escuro",
  moderacao: "bg-amarelo-fundo text-amarelo-texto",
  marketing: "bg-rosa-fundo text-rosa-texto",
  leitura: "bg-suave text-cinza",
};

/** Permissões por função (BUSINESS.md 17.3), para quem decide os papéis. */
const PERMISSOES: { acao: string; papeis: Papel[] }[] = [
  { acao: "Ver usuários e pets", papeis: ["suporte", "moderacao", "leitura"] },
  { acao: "Suspender conta", papeis: ["moderacao"] },
  { acao: "Ver financeiro", papeis: ["financeiro", "leitura"] },
  { acao: "Aprovar loja", papeis: ["moderacao"] },
  { acao: "Enviar campanha", papeis: ["marketing"] },
  { acao: "Responder avaliações", papeis: ["suporte", "marketing"] },
  { acao: "Ver relatórios", papeis: ["financeiro", "marketing", "leitura"] },
  { acao: "Editar planos", papeis: ["financeiro"] },
  { acao: "Editar vacinas e conteúdo de saúde", papeis: [] },
];
const COLUNAS: Papel[] = ["suporte", "financeiro", "moderacao", "marketing", "leitura"];
const ROTULO_CURTO: Partial<Record<Papel, string>> = { leitura: "Leitura" };

/**
 * Equipe e permissões (protótipo AdminEquipe, só super admin): quem acessa o
 * painel, com que função, se já tem o app autenticador, e o registro de ações.
 */
export default function Equipe() {
  const admin = useAdmin();
  const [equipe, setEquipe] = useState<Membro[]>([]);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("suporte");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => {
    Promise.all([rpcAdmin<Membro[]>("admin_equipe"), rpcAdmin<Acao[]>("admin_auditoria", { p_limite: 30 })]).then(
      ([m, a]) => {
        setEquipe(m);
        setAcoes(a);
      },
      (e: Error) => setErro(e.message),
    );
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (admin.papel !== "super") return <p className="text-sm text-cinza">Só um super admin gerencia a equipe.</p>;

  async function convidar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    try {
      await rpcAdmin("admin_definir_membro", { p_email: email.trim(), p_papel: papel });
      setAviso(`${email.trim()} agora é ${ROTULO_PAPEL[papel]}. No primeiro acesso, a pessoa cadastra o app autenticador.`);
      setEmail("");
      carregar();
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  async function mudarPapel(m: Membro, novo: Papel) {
    try {
      await rpcAdmin("admin_definir_membro", { p_email: m.email, p_papel: novo });
      carregar();
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  async function remover(m: Membro) {
    if (!window.confirm(`Tirar ${m.nome} da equipe? A pessoa perde o acesso ao painel.`)) return;
    try {
      await rpcAdmin("admin_remover_membro", { p_user: m.user_id });
      carregar();
    } catch (falha) {
      setErro((falha as Error).message);
    }
  }

  const ativos = equipe.filter((m) => m.ativo);

  return (
    <>
      <Cabecalho titulo="Equipe e permissões" subtitulo="Quem acessa o painel e o que cada pessoa pode fazer" />
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
      {aviso ? <p className="mb-3 rounded-2xl bg-verde-fundo p-3 text-sm text-verde-texto">{aviso}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Equipe</h2>
            <span className="text-xs text-cinza">{ativos.length} {ativos.length === 1 ? "pessoa" : "pessoas"}</span>
          </div>
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="py-2">Pessoa</th>
                <th className="py-2">Função</th>
                <th className="py-2">Último acesso</th>
                <th className="py-2">2FA</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {ativos.map((m) => (
                <tr key={m.user_id} className="border-t border-[#EEF0F4]">
                  <td className="py-3">
                    <p className="font-semibold">{m.nome}</p>
                    <p className="text-xs text-cinza">{m.email}</p>
                  </td>
                  <td className="py-3">
                    <select
                      value={m.papel}
                      onChange={(e) => mudarPapel(m, e.target.value as Papel)}
                      aria-label={`Função de ${m.nome}`}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold outline-none ${COR_PAPEL[m.papel]}`}
                    >
                      {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => (
                        <option key={p} value={p}>
                          {ROTULO_PAPEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 text-cinza">{haQuanto(m.ultimo_acesso)}</td>
                  <td className="py-3">{m.tem_2fa ? <span className="text-verde-texto">ativo</span> : <span className="text-amarelo-texto">no 1º acesso</span>}</td>
                  <td className="py-3 text-right">
                    {m.email === admin.email ? null : (
                      <button onClick={() => remover(m)} className="text-xs font-semibold text-perigo underline">
                        Tirar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={convidar} className="mt-5 flex flex-wrap gap-2">
            <label className="sr-only" htmlFor="convite-email">E-mail</label>
            <input
              id="convite-email"
              type="email"
              required
              placeholder="e-mail da conta da pessoa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 min-w-56 flex-1 rounded-full bg-suave px-4 text-[13px] outline-none"
            />
            <label className="sr-only" htmlFor="convite-papel">Função</label>
            <select id="convite-papel" value={papel} onChange={(e) => setPapel(e.target.value as Papel)} className="h-10 rounded-full bg-suave px-3 text-[13px] font-semibold outline-none">
              {(Object.keys(ROTULO_PAPEL) as Papel[]).map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>
            <button type="submit" className="h-10 rounded-full bg-tinta px-5 text-[13px] font-bold text-white">
              Pôr na equipe
            </button>
          </form>
          <p className="mt-2 text-xs text-cinza">A pessoa precisa ter uma conta no PetLive (pelo app) antes.</p>
        </section>

        <section className="rounded-[28px] bg-fundo p-6">
          <h2 className="font-bold">Permissões por função</h2>
          <table className="mt-3 w-full text-[12px]">
            <thead>
              <tr className="text-[11px] font-bold text-[#6A7484]">
                <th className="py-2 text-left" />
                {COLUNAS.map((c) => (
                  <th key={c} className="px-1 py-2">{ROTULO_CURTO[c] ?? ROTULO_PAPEL[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSOES.map((p) => (
                <tr key={p.acao}>
                  <td className="py-2 pr-2 font-semibold">{p.acao}</td>
                  {COLUNAS.map((c) => (
                    <td key={c} className="px-1 py-2 text-center">
                      <span
                        aria-label={p.papeis.includes(c) ? "pode" : "não pode"}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] ${p.papeis.includes(c) ? "bg-tinta text-white" : "bg-suave"}`}
                      >
                        {p.papeis.includes(c) ? "✓" : ""}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-cinza">O super admin pode tudo. As regras valem no banco, não só na tela.</p>
        </section>
      </div>

      <section className="mt-4 rounded-[28px] bg-fundo p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">Registro de ações</h2>
          <span className="text-xs text-cinza">Auditoria</span>
        </div>
        {acoes.length === 0 ? (
          <p className="mt-3 text-sm text-cinza">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#EEF0F4] text-[13px]">
            {acoes.map((a, i) => (
              <li key={i} className="flex gap-6 py-2.5">
                <span className="w-32 flex-none text-cinza">
                  {haQuanto(a.quando)} {new Date(a.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span>
                  <strong>{a.quem}</strong> {a.acao}
                  {a.alvo ? <> · {a.alvo}</> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
