"use client";

import { useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Origem = "premium" | "comissao_produtos" | "comissao_servicos";
type Mes = { mes: string; total: number; premium: number; comissao_produtos: number; comissao_servicos: number; pagamentos: number };
type Faturamento = {
  por_mes: Mes[];
  mes_atual: number;
  mes_anterior: number;
  ultimos_30d: number;
  estornos_30d: number;
  assinantes: number;
  ultimas: { origem: Origem; valor: number; status: "pago" | "estornado"; pago_em: string; descricao: string | null; tutor: string | null }[];
};

const ORIGENS: { chave: Origem; rotulo: string; cor: string; chip: string }[] = [
  { chave: "premium", rotulo: "Premium", cor: "bg-azul", chip: "bg-roxo-fundo text-roxo-texto" },
  { chave: "comissao_produtos", rotulo: "Comissão de produtos", cor: "bg-roxo-fundo", chip: "bg-azul-fundo text-azul-escuro" },
  { chave: "comissao_servicos", rotulo: "Comissão de serviços", cor: "bg-verde-fundo", chip: "bg-verde-fundo text-verde-texto" },
];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PERIODOS = [6, 12, 24];

function reais(centavos: number, inteiro = false): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: inteiro ? 0 : 2 });
}
const mesCurto = (chave: string) => MESES[Number(chave.slice(5, 7)) - 1];
const mesLongo = (chave: string) =>
  new Date(`${chave}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function variacao(atual: number, anterior: number): string {
  if (!anterior) return atual ? "Primeiro mês com receita" : "Sem receita ainda";
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs. mês anterior`;
}

/**
 * Financeiro (protótipo AdminFinanceiro): faturamento mês a mês, por origem.
 * Hoje só o Premium gera receita (Fase 2); as comissões entram com o
 * marketplace (Fase 3). Repasses às lojas também chegam na Fase 3.
 */
export default function FinanceiroPagina() {
  const [meses, setMeses] = useState(12);
  const [dados, setDados] = useState<Faturamento | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    rpcAdmin<Faturamento>("admin_faturamento", { p_meses: meses }).then(setDados, (e: Error) => setErro(e.message));
  }, [meses]);

  function exportar() {
    if (!dados) return;
    const campo = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      ["Mês", "Total", "Premium", "Comissão de produtos", "Comissão de serviços", "Pagamentos"],
      ...dados.por_mes.map((m) => [m.mes, m.total / 100, m.premium / 100, m.comissao_produtos / 100, m.comissao_servicos / 100, m.pagamentos]),
    ];
    const csv = "﻿" + linhas.map((l) => l.map((v) => campo(typeof v === "number" ? String(v).replace(".", ",") : v)).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `petlive-faturamento-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!dados) return <p className="text-sm text-cinza">{erro ?? "Carregando…"}</p>;
  const maior = Math.max(...dados.por_mes.map((m) => m.total), 1);
  const totalPeriodo = dados.por_mes.reduce((s, m) => s + m.total, 0);
  const atual = dados.por_mes[dados.por_mes.length - 1];
  const foco = dados.por_mes.find((m) => m.mes === selecionado) ?? atual;
  const semReceita = totalPeriodo === 0;

  return (
    <>
      <Cabecalho titulo="Financeiro" subtitulo="Faturamento do PetLive mês a mês, por origem">
        <button onClick={exportar} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-5 text-[13px] font-bold">
          Exportar CSV
        </button>
        <label className="sr-only" htmlFor="periodo">Período</label>
        <select id="periodo" value={meses} onChange={(e) => setMeses(Number(e.target.value))} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-4 text-[13px] font-bold">
          {PERIODOS.map((p) => (
            <option key={p} value={p}>Últimos {p} meses</option>
          ))}
        </select>
      </Cabecalho>
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Faturamento do mês" valor={reais(dados.mes_atual, true)} apoio={variacao(dados.mes_atual, dados.mes_anterior)} fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero rotulo="Mês anterior" valor={reais(dados.mes_anterior, true)} apoio={atual ? mesLongo(dados.por_mes[dados.por_mes.length - 2]?.mes ?? atual.mes) : ""} fundo="bg-azul-fundo" cor="text-azul-escuro" />
        <CartaoNumero rotulo={`Total (${meses} meses)`} valor={reais(totalPeriodo, true)} apoio={`Média ${reais(Math.round(totalPeriodo / meses), true)} por mês`} fundo="bg-roxo-fundo" cor="text-roxo-texto" />
        <CartaoNumero
          rotulo="Assinantes Premium"
          valor={numero(dados.assinantes)}
          apoio={dados.estornos_30d ? `${reais(dados.estornos_30d)} estornados em 30 dias` : "Sem estornos em 30 dias"}
          fundo="bg-amarelo-fundo"
          cor="text-amarelo-texto"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0 rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold">Faturamento por mês</h2>
            <span className="text-xs text-cinza">Toque num mês para ver o detalhe</span>
          </div>
          {semReceita ? (
            <p className="mt-3 rounded-2xl bg-amarelo-fundo px-4 py-3 text-[13px] text-amarelo-texto">
              Ainda não há receita registrada. O faturamento entra sozinho quando o Premium começar a ser vendido (webhook do Asaas ou das lojas de apps).
            </p>
          ) : null}
          <div className="mt-4 flex h-64 items-end gap-2" role="img" aria-label={`Faturamento dos últimos ${meses} meses`}>
            {dados.por_mes.map((m) => {
              const ativo = m.mes === foco.mes;
              return (
                <button
                  key={m.mes}
                  onClick={() => setSelecionado(m.mes)}
                  title={`${mesLongo(m.mes)}: ${reais(m.total)}`}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className={`text-[10px] font-bold ${ativo ? "text-tinta" : "text-transparent group-hover:text-cinza"}`}>
                    {m.total ? reais(m.total, true).replace("R$", "").trim() : ""}
                  </span>
                  <span className="flex w-full flex-col-reverse overflow-hidden rounded-xl" style={{ height: `${Math.max((m.total / maior) * 100, m.total ? 4 : 2)}%` }}>
                    {ativo ? (
                      <span className="h-full w-full bg-tinta" />
                    ) : m.total ? (
                      ORIGENS.map((o) => (m[o.chave] > 0 ? <span key={o.chave} className={o.cor} style={{ height: `${(m[o.chave] / m.total) * 100}%` }} /> : null))
                    ) : (
                      <span className="h-full w-full bg-suave" />
                    )}
                  </span>
                  <span className={`text-[11px] ${ativo ? "font-bold text-tinta" : "text-cinza"}`}>{mesCurto(m.mes)}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ORIGENS.map((o) => {
              const valor = dados.por_mes.reduce((s, m) => s + m[o.chave], 0);
              return (
                <span key={o.chave} className={`rounded-full px-3 py-1 text-[11px] font-bold ${o.chip}`}>
                  {o.rotulo} {totalPeriodo ? `${Math.round((valor / totalPeriodo) * 100)}%` : "0%"}
                </span>
              );
            })}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-[28px] bg-fundo p-6">
            <h2 className="font-bold first-letter:uppercase">{mesLongo(foco.mes)}</h2>
            <p className="mt-1 text-4xl font-medium tracking-tight">{reais(foco.total)}</p>
            <p className="text-xs text-cinza">{numero(foco.pagamentos)} {foco.pagamentos === 1 ? "pagamento" : "pagamentos"}</p>
            <dl className="mt-4 space-y-2 text-[13px]">
              {ORIGENS.map((o) => (
                <div key={o.chave} className="flex items-center justify-between gap-3 rounded-2xl bg-suave px-4 py-2.5">
                  <dt className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${o.cor}`} />
                    {o.rotulo}
                  </dt>
                  <dd className="font-semibold">{reais(foco[o.chave])}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-[28px] bg-fundo p-6">
            <h2 className="font-bold">Últimos pagamentos</h2>
            {dados.ultimas.length === 0 ? (
              <p className="mt-2 text-sm text-cinza">Nenhum pagamento ainda.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {dados.ultimas.slice(0, 8).map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{u.descricao ?? ORIGENS.find((o) => o.chave === u.origem)?.rotulo}</p>
                      <p className="truncate text-xs text-cinza">
                        {u.tutor ?? "—"} · {haQuanto(u.pago_em)}
                      </p>
                    </div>
                    <span className={`flex-none font-semibold ${u.status === "estornado" ? "text-perigo" : ""}`}>{reais(u.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
