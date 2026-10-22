"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Pedido = {
  id: string;
  tipo: "exportar" | "apagar" | "corrigir";
  status: "novo" | "aguardando_confirmacao" | "em_andamento" | "concluido" | "cancelado";
  criado_em: string;
  due_at: string | null;
  executar_em: string | null;
  done_at: string | null;
  email: string;
  nome: string;
};
type Lgpd = {
  abertos: number;
  concluidos_30d: number;
  dias_medio: number | null;
  atrasados: number;
  termos_aceitos_pct: number | null;
  pedidos: Pedido[];
};

const TIPO: Record<Pedido["tipo"], string> = { exportar: "Exportar meus dados", apagar: "Apagar minha conta", corrigir: "Corrigir cadastro" };
const STATUS: Record<Pedido["status"], { rotulo: string; cor: string }> = {
  novo: { rotulo: "Novo", cor: "bg-azul-fundo text-azul-escuro" },
  aguardando_confirmacao: { rotulo: "Aguardando confirmação", cor: "bg-amarelo-fundo text-amarelo-texto" },
  em_andamento: { rotulo: "Em andamento", cor: "bg-amarelo-fundo text-amarelo-texto" },
  concluido: { rotulo: "Concluído", cor: "bg-verde-fundo text-verde-texto" },
  cancelado: { rotulo: "Cancelado", cor: "bg-suave text-cinza" },
};

/** Regras de retenção (política de privacidade do site e BUSINESS.md 12). */
const RETENCAO: [string, string][] = [
  ["Conta apagada", "Dados removidos em 30 dias"],
  ["Histórico de saúde", "Apagado com a conta"],
  ["Registros de uso", "13 meses"],
  ["Caixa de avisos", "30 dias"],
  ["Mensagens do site", "Até 12 meses"],
];

function prazo(p: Pedido): string {
  if (p.status === "concluido") return `concluído ${haQuanto(p.done_at)}`;
  if (p.status === "cancelado") return "cancelado pelo tutor";
  const alvo = p.tipo === "apagar" ? p.executar_em : p.due_at;
  if (!alvo) return "—";
  const dias = Math.ceil((new Date(alvo).getTime() - Date.now()) / 86_400_000);
  if (dias < 0) return `atrasado ${-dias} ${-dias === 1 ? "dia" : "dias"}`;
  return p.tipo === "apagar" ? `apaga em ${dias} dias` : `em ${dias} dias`;
}

/**
 * Privacidade e LGPD (protótipo AdminLGPD): pedidos dos tutores sobre os
 * próprios dados, prazos e regras de retenção. A exclusão roda sozinha no
 * prazo (o tutor pode cancelar até lá); corrigir e exportar a equipe conclui.
 */
export default function Lgpd() {
  const admin = useAdmin();
  const [dados, setDados] = useState<Lgpd | null>(null);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const pode = admin.papel === "super" || admin.papel === "suporte";

  const carregar = useCallback(() => {
    rpcAdmin<Lgpd>("admin_lgpd").then(setDados, (e: Error) => setErro(e.message));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function concluir(p: Pedido) {
    const nota = window.prompt(`Concluir "${TIPO[p.tipo]}" de ${p.nome}? Anote o que foi feito (fica no registro de ações):`);
    if (nota === null) return;
    try {
      await rpcAdmin("admin_lgpd_concluir", { p_pedido: p.id, p_nota: nota });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (!dados) return <p className="text-sm text-cinza">{erro ?? "Carregando…"}</p>;
  const termo = busca.trim().toLowerCase();
  const pedidos = dados.pedidos.filter((p) => !termo || p.nome.toLowerCase().includes(termo) || p.email.toLowerCase().includes(termo));

  return (
    <>
      <Cabecalho titulo="Privacidade e LGPD" subtitulo="Pedidos dos tutores sobre os próprios dados e as regras de retenção">
        <label className="flex h-10 w-72 items-center gap-2 rounded-full bg-fundo px-4">
          <span className="sr-only">Buscar tutor</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tutor ou e-mail" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
      </Cabecalho>
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Pedidos abertos" valor={numero(dados.abertos)} apoio="Prazo legal: até 15 dias" fundo="bg-amarelo-fundo" cor="text-amarelo-texto" />
        <CartaoNumero
          rotulo="Concluídos (30d)"
          valor={numero(dados.concluidos_30d)}
          apoio={dados.dias_medio !== null ? `Tempo médio ${String(dados.dias_medio).replace(".", ",")} dias` : "Sem pedidos concluídos"}
          fundo="bg-verde-fundo"
          cor="text-verde-texto"
        />
        <CartaoNumero
          rotulo="Termos aceitos"
          valor={dados.termos_aceitos_pct !== null ? `${String(dados.termos_aceitos_pct).replace(".", ",")}%` : "—"}
          apoio="Versão 1.0"
          fundo="bg-azul-fundo"
          cor="text-azul-escuro"
        />
        <CartaoNumero rotulo="Pedidos atrasados" valor={numero(dados.atrasados)} apoio="Meta: 0" fundo={dados.atrasados ? "bg-rosa-fundo" : "bg-roxo-fundo"} cor={dados.atrasados ? "text-rosa-texto" : "text-roxo-texto"} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-[28px] bg-fundo">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="px-5 py-3">Tutor</th>
                <th className="px-3 py-3">Pedido</th>
                <th className="px-3 py-3">Prazo</th>
                <th className="px-3 py-3">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-cinza">Nenhum pedido.</td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const atrasado = prazo(p).startsWith("atrasado");
                  return (
                    <tr key={p.id} className="border-t border-[#EEF0F4]">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{p.nome}</p>
                        <p className="text-xs text-cinza">{p.email}</p>
                      </td>
                      <td className="px-3 py-3">{TIPO[p.tipo]}</td>
                      <td className={`px-3 py-3 ${atrasado ? "font-bold text-perigo" : "text-cinza"}`}>{prazo(p)}</td>
                      <td className="px-3 py-3">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[p.status].cor}`}>{STATUS[p.status].rotulo}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {pode && p.tipo !== "apagar" && !["concluido", "cancelado"].includes(p.status) ? (
                          <button onClick={() => concluir(p)} className="text-xs font-bold text-azul-escuro underline">
                            Concluir
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <section className="h-fit min-w-0 rounded-[28px] bg-fundo p-6">
          <h2 className="font-bold">Regras de retenção</h2>
          <dl className="mt-3 space-y-2 text-[13px]">
            {RETENCAO.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex justify-between gap-4 rounded-2xl bg-suave px-4 py-3">
                <dt className="text-cinza">{rotulo}</dt>
                <dd className="text-right font-semibold">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-cinza">
            A exclusão da conta roda sozinha no prazo e o tutor pode cancelar até lá pelo app. Exportar é feito pelo próprio tutor no app; o pedido fica aqui como registro.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/termos" target="_blank" className="rounded-full border border-[#DDE1E8] px-4 py-2 text-[13px] font-bold">
              Ver termos de uso
            </Link>
            <Link href="/privacidade" target="_blank" className="rounded-full border border-[#DDE1E8] px-4 py-2 text-[13px] font-bold">
              Política de privacidade
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
