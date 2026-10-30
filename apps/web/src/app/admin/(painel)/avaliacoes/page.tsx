"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, EstadoPainel, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Plataforma = "play" | "app_store";
type Avaliacao = {
  id: string;
  platform: Plataforma;
  rating: number;
  author: string | null;
  title: string | null;
  text: string | null;
  app_version: string | null;
  at: string;
  reply_text: string | null;
  replied_at: string | null;
  reply_status: "pendente" | "enviada" | "falhou" | null;
  reply_erro: string | null;
};
type Dados = {
  lojas: Partial<Record<Plataforma, { media: number; total: number }>>;
  sem_resposta: number;
  uma_estrela_sem_resposta: number;
  horas_resposta: number | null;
  distribuicao: Record<string, number>;
  por_mes: { mes: string; media: number | null }[];
  sync: Partial<Record<Plataforma, { ultima_execucao: string; ok: boolean; mensagem: string | null }>>;
  itens: Avaliacao[];
};

type Filtro = "todas" | "play" | "app_store" | "baixas" | "sem_resposta";
const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "play", rotulo: "Google Play" },
  { valor: "app_store", rotulo: "App Store" },
  { valor: "baixas", rotulo: "1–2 estrelas" },
  { valor: "sem_resposta", rotulo: "Sem resposta" },
];
const LOJA: Record<Plataforma, string> = { play: "Google Play", app_store: "App Store" };
const estrelas = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
const media = (v?: number) => (v === undefined ? "—" : String(v).replace(".", ","));

function csv(itens: Avaliacao[]): string {
  const linhas = [["Loja", "Nota", "Autor", "Data", "Comentário", "Resposta"], ...itens.map((a) => [LOJA[a.platform], a.rating, a.author ?? "", a.at.slice(0, 10), a.text ?? "", a.reply_text ?? ""])];
  return "﻿" + linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
}

/**
 * Avaliações dos apps (protótipo AdminAvaliacoes): Google Play e App Store
 * num só lugar. A função sync-app-reviews importa a cada hora e envia as
 * respostas escritas aqui (até 350 caracteres, limite das lojas).
 */
export default function AvaliacoesPagina() {
  const admin = useAdmin();
  const pode = ["super", "suporte", "marketing"].includes(admin.papel);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [dados, setDados] = useState<Dados | null>(null);
  const [selecionada, setSelecionada] = useState<Avaliacao | null>(null);
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => {
    rpcAdmin<Dados>("admin_avaliacoes", { p_filtro: filtro }).then(
      (d) => {
        setDados(d);
        setSelecionada((atual) => (atual ? (d.itens.find((i) => i.id === atual.id) ?? null) : null));
      },
      (e: Error) => setErro(e.message),
    );
  }, [filtro]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function responder() {
    if (!selecionada) return;
    setErro(null);
    try {
      await rpcAdmin("admin_avaliacao_responder", { p_id: selecionada.id, p_texto: resposta });
      setResposta("");
      setAviso("Resposta salva. Ela vai para a loja na próxima sincronização (a cada hora).");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function exportar() {
    if (!dados) return;
    const url = URL.createObjectURL(new Blob([csv(dados.itens)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `petlive-avaliacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!dados) return <><Cabecalho titulo="Avaliações dos apps" subtitulo="Acompanhe os dados e as atividades desta área" /><div className="admin-bloco" role={erro ? "alert" : "status"}><p className={erro ? "text-sm text-perigo" : "text-sm text-cinza"}>{erro ?? "Carregando dados…"}</p></div></>;
  const totalNotas = Object.values(dados.distribuicao).reduce((s, n) => s + n, 0);
  const semConexao = (["play", "app_store"] as Plataforma[]).filter((p) => !dados.sync[p]?.ok);

  return (
    <>
      <Cabecalho titulo="Avaliações dos apps" subtitulo="Google Play e App Store em um só lugar">
        <button onClick={exportar} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-5 text-[13px] font-bold">Exportar CSV</button>
      </Cabecalho>
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
      {aviso ? <p className="mb-3 rounded-2xl bg-verde-fundo p-3 text-sm text-verde-texto">{aviso}</p> : null}
      {semConexao.length ? (
        <div className="mb-4 rounded-[24px] bg-amarelo-fundo p-4 text-[13px] text-amarelo-texto">
          <p className="font-bold">Conectar contas das lojas</p>
          {semConexao.map((p) => (
            <p key={p} className="mt-1">
              {LOJA[p]}: {dados.sync[p]?.mensagem ?? "ainda não sincronizou"}
              {dados.sync[p]?.ultima_execucao ? ` · ${haQuanto(dados.sync[p]!.ultima_execucao)}` : ""}
            </p>
          ))}
          <p className="mt-2 text-xs">
            Cadastre os segredos da função sync-app-reviews no Supabase: GOOGLE_PLAY_SERVICE_ACCOUNT (conta de serviço com acesso ao app no Play Console) e APP_STORE_ISSUER_ID, APP_STORE_KEY_ID, APP_STORE_PRIVATE_KEY e APP_STORE_APP_ID (chave da App Store Connect API).
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Google Play" valor={`${media(dados.lojas.play?.media)} ★`} apoio={`${numero(dados.lojas.play?.total)} avaliações`} fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero rotulo="App Store" valor={`${media(dados.lojas.app_store?.media)} ★`} apoio={`${numero(dados.lojas.app_store?.total)} avaliações`} fundo="bg-azul-fundo" cor="text-azul-escuro" />
        <CartaoNumero rotulo="Sem resposta" valor={numero(dados.sem_resposta)} apoio={`${numero(dados.uma_estrela_sem_resposta)} com 1 estrela`} fundo="bg-rosa-fundo" cor="text-rosa-texto" />
        <CartaoNumero
          rotulo="Tempo de resposta"
          valor={dados.horas_resposta === null ? "—" : `${String(dados.horas_resposta).replace(".", ",")} h`}
          apoio="Meta: até 24 h"
          fundo="bg-amarelo-fundo"
          cor="text-amarelo-texto"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="admin-surface border border-borda bg-fundo shadow-sm p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">Nota ao longo do tempo</h2>
            <span className="text-xs text-cinza">Média das duas lojas</span>
          </div>
          <div className="mt-6 flex h-40 items-end gap-2" role="img" aria-label="Média das notas por mês">
            {dados.por_mes.map((m) => (
              <div key={m.mes} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-cinza">{m.media === null ? "" : String(m.media).replace(".", ",")}</span>
                <div className="w-full rounded-t-xl bg-azul" style={{ height: `${m.media === null ? 4 : Math.max(4, (m.media / 5) * 120)}px` }} />
                <span className="text-[10px] text-cinza">{new Date(`${m.mes}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-surface border border-borda bg-fundo shadow-sm p-6">
          <h2 className="font-bold">Distribuição das notas</h2>
          <ul className="mt-4 space-y-2.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const pct = totalNotas ? Math.round(((dados.distribuicao[String(n)] ?? 0) / totalNotas) * 100) : 0;
              return (
                <li key={n} className="grid grid-cols-[2rem_1fr_3rem] items-center gap-3 text-[13px]">
                  <span className="font-semibold">{n}★</span>
                  <span className="h-2 rounded-full bg-suave">
                    <span className="block h-2 rounded-full bg-azul" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right font-semibold">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-5">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                onClick={() => {
                  setFiltro(f.valor);
                  setSelecionada(null);
                }}
                className={`h-9 rounded-full px-4 text-[13px] font-bold ${filtro === f.valor ? "bg-tinta text-white" : "border border-[#DDE1E8]"}`}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="py-2">Loja</th>
                <th className="py-2">Nota e autor</th>
                <th className="py-2">Comentário</th>
                <th className="py-2">Resposta</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-cinza">Nenhuma avaliação aqui.</td>
                </tr>
              ) : (
                dados.itens.map((a) => (
                  <tr key={a.id} onClick={() => { setSelecionada(a); setResposta(a.reply_text ?? ""); setAviso(null); }} className={`cursor-pointer border-t border-[#EEF0F4] hover:bg-suave ${selecionada?.id === a.id ? "bg-azul-fundo" : ""}`}>
                    <td className="py-3">{LOJA[a.platform]}</td>
                    <td className="py-3">
                      <p className="text-amarelo-texto">{estrelas(a.rating)}</p>
                      <p className="text-xs text-cinza">{a.author ?? "Anônimo"} · {haQuanto(a.at)}</p>
                    </td>
                    <td className="max-w-72 py-3">
                      <p className="truncate">{a.title ? `${a.title}: ` : ""}{a.text ?? "(sem texto)"}</p>
                    </td>
                    <td className="py-3">
                      {a.reply_status === "falhou" ? (
                        <span className="rounded-full bg-perigo-fundo px-2.5 py-1 text-[11px] font-bold text-perigo">Falhou</span>
                      ) : a.reply_status === "pendente" ? (
                        <span className="rounded-full bg-amarelo-fundo px-2.5 py-1 text-[11px] font-bold text-amarelo-texto">Enviando</span>
                      ) : a.reply_text ? (
                        <span className="rounded-full bg-verde-fundo px-2.5 py-1 text-[11px] font-bold text-verde-texto">Respondida</span>
                      ) : (
                        <span className="rounded-full bg-rosa-fundo px-2.5 py-1 text-[11px] font-bold text-rosa-texto">Sem resposta</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="h-fit min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-6">
          {!selecionada ? (
            <EstadoPainel titulo="Detalhes da avaliação">Escolha uma avaliação para ler e responder.</EstadoPainel>
          ) : (
            <>
              <p className="text-amarelo-texto">{estrelas(selecionada.rating)}</p>
              <h2 className="mt-1 font-bold">{selecionada.author ?? "Anônimo"} · {LOJA[selecionada.platform]}</h2>
              <p className="text-xs text-cinza">{haQuanto(selecionada.at)}{selecionada.app_version ? ` · versão ${selecionada.app_version}` : ""}</p>
              {selecionada.title ? <p className="mt-3 font-semibold">{selecionada.title}</p> : null}
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{selecionada.text ?? "(sem texto)"}</p>
              {selecionada.reply_status === "falhou" ? <p className="mt-3 text-xs text-perigo">A loja recusou a resposta ({selecionada.reply_erro}). Revise e envie de novo.</p> : null}
              {pode ? (
                <div className="mt-4">
                  <label htmlFor="resposta" className="text-xs font-bold">Responder a {selecionada.author ?? "quem avaliou"}</label>
                  <textarea
                    id="resposta"
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    maxLength={350}
                    rows={4}
                    placeholder="Oi! Obrigado pelo retorno…"
                    className="mt-2 w-full rounded-2xl bg-suave p-3 text-[13px] outline-none"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-cinza">
                    <span>A resposta fica pública na loja.</span>
                    <span>{resposta.length}/350</span>
                  </div>
                  <button onClick={responder} disabled={resposta.trim().length < 2} className="mt-3 h-11 w-full rounded-full bg-tinta text-[13px] font-bold text-white disabled:opacity-40">
                    Enviar resposta
                  </button>
                </div>
              ) : selecionada.reply_text ? (
                <p className="mt-4 rounded-2xl bg-suave p-3 text-[13px]">Resposta: {selecionada.reply_text}</p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </>
  );
}
