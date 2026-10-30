"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cabecalho, numero, useAdmin } from "@/components/admin/Painel";
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

  if (erro) return <><Cabecalho titulo="Visão geral" subtitulo="Resumo do PetLive" /><p role="alert" className="rounded-2xl bg-perigo-fundo p-4 text-perigo">{erro}</p></>;
  if (!visao) return <><Cabecalho titulo="Visão geral" subtitulo="Resumo do PetLive" /><p role="status" className="admin-bloco text-sm text-cinza">Carregando indicadores…</p></>;

  const maior = Math.max(1, ...visao.ativos_por_semana.map(s => s.tutores));
  const atencao = [
    { n: visao.atencao.lgpd_pendentes, texto: "Pedidos de privacidade em aberto", href: "/admin/lgpd", fundo: "bg-rosa-fundo text-rosa-texto", icone: "◎", papeis: ["super", "suporte", "leitura"] },
    { n: visao.atencao.indicacoes_em_analise, texto: "Indicações de lugares para analisar", href: "/admin/moderacao", fundo: "bg-amarelo-fundo text-amarelo-texto", icone: "⚑", papeis: ["super", "moderacao", "leitura"] },
    { n: visao.atencao.contatos_7d, texto: "Mensagens do site em 7 dias", href: "/admin/suporte", fundo: "bg-azul-fundo text-azul-escuro", icone: "✉", papeis: ["super", "suporte", "leitura"] },
    { n: visao.atencao.lojistas_interessados, texto: "Lojas interessadas no PetLive", href: "/admin/suporte", fundo: "bg-roxo-fundo text-roxo-texto", icone: "⌂", papeis: ["super", "suporte", "leitura"] },
    { n: visao.atencao.perdidos_ativos, texto: "Alertas de pet perdido ativos", href: "/admin/moderacao", fundo: "bg-rosa-fundo text-rosa-texto", icone: "!", papeis: ["super", "moderacao", "leitura"] },
  ].filter(a => a.papeis.includes(admin.papel));
  const moeda = (v: number) => (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return <>
    <Cabecalho titulo="Visão geral" subtitulo="Acompanhe o PetLive · últimos 30 dias">
      <span className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-cinza">Últimos 30 dias</span>
      <span aria-label={admin.nome} className="flex h-10 w-10 items-center justify-center rounded-full bg-roxo-fundo text-sm font-bold text-roxo-texto">{admin.nome.trim().charAt(0).toUpperCase()}</span>
    </Cabecalho>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="admin-kpi admin-kpi-escuro"><p className="admin-kpi-rotulo">Assinantes Premium</p><p className="mt-1 text-[28px] font-bold tracking-tight">{numero(visao.assinantes)}</p><p className="admin-kpi-apoio">{pct(visao.assinantes, visao.tutores)} da base de tutores</p></div>
      {receita ? <Link className="admin-kpi" href="/admin/financeiro"><p className="admin-kpi-rotulo">Faturamento do mês</p><p className="mt-1 text-[28px] font-bold tracking-tight">{moeda(receita.mes_atual)}</p><p className="admin-kpi-apoio text-verde-texto">Anterior: {moeda(receita.mes_anterior)} →</p></Link> : <div className="admin-kpi"><p className="admin-kpi-rotulo">Tutores cadastrados</p><p className="mt-1 text-[28px] font-bold tracking-tight">{numero(visao.tutores)}</p><p className="admin-kpi-apoio text-verde-texto">+{numero(visao.tutores_novos_30d)} no mês</p></div>}
      <div className="admin-kpi"><p className="admin-kpi-rotulo">Tutores ativos (30 dias)</p><p className="mt-1 text-[28px] font-bold tracking-tight">{numero(visao.ativos_30d)}</p><p className="admin-kpi-apoio">{pct(visao.ativos_30d, visao.tutores)} da base</p></div>
      <div className="admin-kpi"><p className="admin-kpi-rotulo">Tutores ativos (7 dias)</p><p className="mt-1 text-[28px] font-bold tracking-tight">{numero(visao.ativos_7d)}</p><p className="admin-kpi-apoio">{pct(visao.com_lembrete_ativo, visao.tutores)} da base com lembrete ativo</p></div>
    </div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <section className="admin-bloco">
        <div className="admin-bloco-titulo"><h2>Tutores ativos por semana</h2><span>Abriram o app ao menos uma vez</span></div>
        {visao.ativos_por_semana.length ? <div className="admin-chart" role="img" aria-label={`Tutores ativos por semana: ${visao.ativos_por_semana.map(s => `${s.semana}: ${s.tutores}`).join("; ")}`}>
          {visao.ativos_por_semana.map(s => <div key={s.semana}><b>{numero(s.tutores)}</b><span className="admin-chart-barra" style={{height: `${Math.max(4, s.tutores / maior * 140)}px`}} /><small>{new Date(`${s.semana}T12:00:00`).toLocaleDateString("pt-BR", {day:"2-digit",month:"2-digit"})}</small></div>)}
        </div> : <p className="py-16 text-center text-sm text-cinza">Ainda não há atividade registrada neste período.</p>}
        <div className="admin-legenda"><span>Base total <b>{numero(visao.tutores)}</b></span><span>Novos no mês <b>{numero(visao.tutores_novos_30d)}</b></span><span>Ativos em 30 dias <b>{pct(visao.ativos_30d, visao.tutores)}</b></span></div>
      </section>
      <section className="admin-bloco"><div className="admin-bloco-titulo"><h2>Precisa de atenção</h2><span>Agora</span></div>
        {atencao.map(a => <Link key={a.texto} href={a.href} className="admin-atencao"><span aria-hidden="true" className={a.fundo}>{a.icone}</span><b>{numero(a.n)} · {a.texto}</b><span aria-hidden="true">›</span></Link>)}
        {!atencao.length ? <p className="py-8 text-sm text-cinza">As pendências são exibidas conforme as permissões da sua função.</p> : null}
      </section>
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <section className="admin-bloco"><h2>Pets cadastrados</h2><b className="text-2xl tracking-tight">{numero(visao.pets)}</b>
        <div className="admin-distribuicao" aria-hidden="true"><span className="bg-azul" style={{flex:visao.pets_caes || 1}}/><span className="bg-roxo-fundo" style={{flex:visao.pets_gatos || 1}}/></div>
        <div className="admin-legenda"><span>Cães <b>{pct(visao.pets_caes,visao.pets)}</b></span><span>Gatos <b>{pct(visao.pets_gatos,visao.pets)}</b></span></div>
      </section>
      <section className="admin-bloco"><h2>Cuidados em dia (30 dias)</h2><b className="text-2xl tracking-tight">{numero(visao.doses_confirmadas_30d)}</b><p className="mt-1 text-xs text-cinza">doses confirmadas</p><div className="admin-legenda"><span>Por notificação <b>{pct(visao.doses_pela_notificacao_30d,visao.doses_confirmadas_30d)}</b></span><span>Lembretes concluídos <b>{numero(visao.lembretes_concluidos_30d)}</b></span></div></section>
      <section className="admin-bloco"><h2>Segurança e acolhimento</h2><div className="grid grid-cols-2 gap-4"><div><b className="text-2xl">{numero(visao.sos_30d)}</b><p className="text-xs text-cinza">acessos ao SOS</p></div><div><b className="text-2xl">{numero(visao.perdidos.ativos)}</b><p className="text-xs text-cinza">pets perdidos</p></div></div><div className="admin-legenda"><span>Ligações <b>{numero(visao.sos_ligacoes_30d)}</b></span><span>Encontrados no mês <b>{numero(visao.perdidos.encontrados_30d)}</b></span></div></section>
    </div>
  </>;
}
