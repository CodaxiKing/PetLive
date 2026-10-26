"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Visao = {
  tutores: number;
  tutores_novos_30d: number;
  ativos_7d: number;
  ativos_30d: number;
  pets: number;
  pets_caes: number;
  pets_gatos: number;
  lembretes_concluidos_30d: number;
  doses_confirmadas_30d: number;
  doses_pela_notificacao_30d: number;
  sos_30d: number;
  sos_ligacoes_30d: number;
  com_lembrete_ativo: number;
  assinantes: number;
  perdidos: { ativos: number; encontrados_30d: number; avistamentos_7d: number };
  atencao: { indicacoes_em_analise: number; lgpd_pendentes: number; contatos_7d: number; lojistas_interessados: number; perdidos_ativos: number };
  ativos_por_semana: { semana: string; tutores: number }[];
};

const pct = (parte: number, todo: number) => (todo ? `${Math.round((parte / todo) * 100)}%` : "—");

/**
 * Visão geral (protótipo AdminVisao): números do Gate 1 (BUSINESS.md 14),
 * assinantes Premium e pets perdidos. Lojas e avaliações das lojas de apps
 * entram quando essas partes existirem.
 */
export default function VisaoGeral() {
  const [visao, setVisao] = useState<Visao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const admin = useAdmin();
  // Receita só para quem vê o financeiro (super, financeiro e leitura).
  const veFinanceiro = ["super", "financeiro", "leitura"].includes(admin.papel);
  const [receita, setReceita] = useState<{ mes_atual: number; mes_anterior: number } | null>(null);

  useEffect(() => {
    rpcAdmin<Visao>("admin_visao").then(setVisao, (e: Error) => setErro(e.message));
  }, []);

  useEffect(() => {
    if (veFinanceiro) rpcAdmin<{ mes_atual: number; mes_anterior: number }>("admin_receita_resumo").then(setReceita, () => undefined);
  }, [veFinanceiro]);

  if (erro) return <p className="text-perigo">{erro}</p>;
  if (!visao) return <p className="text-sm text-cinza">Carregando…</p>;

  const maior = Math.max(1, ...visao.ativos_por_semana.map((s) => s.tutores));
  const atencao = [
    { n: visao.atencao.lgpd_pendentes, texto: "pedidos de privacidade (LGPD) em aberto", cor: "bg-[#D93B5A]" },
    { n: visao.atencao.indicacoes_em_analise, texto: "indicações de lugares para analisar", cor: "bg-[#B9862F]" },
    { n: visao.atencao.contatos_7d, texto: "mensagens do site nos últimos 7 dias", cor: "bg-azul-escuro" },
    { n: visao.atencao.lojistas_interessados, texto: "lojas interessadas no PetLive", cor: "bg-roxo-texto" },
    { n: visao.atencao.perdidos_ativos, texto: "alertas de pet perdido ativos", cor: "bg-[#C0392B]" },
  ];

  return (
    <>
      <Cabecalho titulo="Visão geral" subtitulo="Resumo do PetLive · últimos 30 dias" />

      {receita ? (
        <Link href="/admin/financeiro" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[28px] bg-fundo px-6 py-4 hover:bg-suave">
          <div>
            <p className="text-[13px] font-bold text-verde-texto">Faturamento do mês</p>
            <p className="text-3xl font-medium tracking-tight">
              {(receita.mes_atual / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <p className="text-[13px] text-cinza">
            Mês anterior: {(receita.mes_anterior / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · ver o gráfico por mês ›
          </p>
        </Link>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Tutores" valor={numero(visao.tutores)} apoio={`+${numero(visao.tutores_novos_30d)} no mês`} fundo="bg-roxo-fundo" cor="text-roxo-texto" />
        <CartaoNumero rotulo="Ativos em 7 dias" valor={numero(visao.ativos_7d)} apoio={`${pct(visao.ativos_7d, visao.tutores)} da base`} fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero rotulo="Ativos em 30 dias" valor={numero(visao.ativos_30d)} apoio={`${pct(visao.ativos_30d, visao.tutores)} da base`} fundo="bg-azul-fundo" cor="text-azul-escuro" />
        <CartaoNumero rotulo="Assinantes Premium" valor={numero(visao.assinantes)} apoio={`${pct(visao.assinantes, visao.tutores)} da base · ${pct(visao.com_lembrete_ativo, visao.tutores)} com lembrete`} fundo="bg-amarelo-fundo" cor="text-amarelo-texto" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Tutores ativos por semana</h2>
            <span className="text-xs text-cinza">Abriram o app ao menos uma vez</span>
          </div>
          <div className="mt-6 flex h-48 items-end gap-2" role="img" aria-label="Gráfico de tutores ativos por semana">
            {visao.ativos_por_semana.map((s, i) => {
              const ultima = i === visao.ativos_por_semana.length - 1;
              return (
                <div key={s.semana} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-cinza">{s.tutores || ""}</span>
                  <div
                    className={`w-full rounded-t-xl ${ultima ? "bg-tinta" : "bg-azul"}`}
                    style={{ height: `${Math.max(4, (s.tutores / maior) * 150)}px` }}
                    title={`${s.tutores} tutores`}
                  />
                  <span className="text-[10px] text-cinza">{new Date(`${s.semana}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Precisa de atenção</h2>
            <span className="text-xs text-cinza">Agora</span>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {atencao.map((a) => (
              <li key={a.texto} className="flex items-center gap-3">
                <span className={`h-2 w-2 flex-none rounded-full ${a.n ? a.cor : "bg-borda"}`} />
                <span className={a.n ? "" : "text-cinza"}>
                  <strong>{numero(a.n)}</strong> {a.texto}
                </span>
              </li>
            ))}
          </ul>
          <Link href="/admin/usuarios" className="mt-6 inline-block text-sm font-semibold text-azul-escuro underline">
            Ver usuários e pets
          </Link>
        </section>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-[24px] bg-fundo p-5">
          <h3 className="font-bold">Pets cadastrados</h3>
          <p className="mt-2 text-[30px] font-medium tracking-tight">{numero(visao.pets)}</p>
          <p className="text-xs text-cinza">
            Cães {pct(visao.pets_caes, visao.pets)} · Gatos {pct(visao.pets_gatos, visao.pets)}
          </p>
        </section>
        <section className="rounded-[24px] bg-fundo p-5">
          <h3 className="font-bold">Doses confirmadas (30d)</h3>
          <p className="mt-2 text-[30px] font-medium tracking-tight">{numero(visao.doses_confirmadas_30d)}</p>
          <p className="text-xs text-cinza">
            {pct(visao.doses_pela_notificacao_30d, visao.doses_confirmadas_30d)} pelo botão Feito da notificação ·{" "}
            {numero(visao.lembretes_concluidos_30d)} lembretes concluídos
          </p>
        </section>
        <section className="rounded-[24px] bg-fundo p-5">
          <h3 className="font-bold">SOS (30d)</h3>
          <p className="mt-2 text-[30px] font-medium tracking-tight">{numero(visao.sos_30d)}</p>
          <p className="text-xs text-cinza">{numero(visao.sos_ligacoes_30d)} ligaram para a clínica pelo app</p>
        </section>
        <Link href="/admin/moderacao" className="rounded-[24px] bg-fundo p-5 hover:bg-suave">
          <h3 className="font-bold">Pets perdidos</h3>
          <p className="mt-2 text-[30px] font-medium tracking-tight">{numero(visao.perdidos.ativos)}</p>
          <p className="text-xs text-cinza">
            alertas ativos · {numero(visao.perdidos.encontrados_30d)} encontrados no mês · {numero(visao.perdidos.avistamentos_7d)} avistamentos em 7 dias
          </p>
        </Link>
      </div>
    </>
  );
}
