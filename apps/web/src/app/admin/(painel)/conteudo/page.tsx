"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { DatasFogos } from "./DatasFogos";
import { Viagem } from "./Viagem";
import { Racas } from "./Racas";
import { Categorias } from "./Categorias";
import { rpcAdmin } from "@/lib/admin/supabase";

type Vacina = {
  id: string;
  especie: "cao" | "gato";
  nome: string;
  primeira_dose_dias: number;
  reforco_dias: number | null;
  descricao: string | null;
  obrigatoria: boolean;
  ordem: number;
};
type Versao = { versao: number; resumo: string; publicado_em: string; por: string };
type Pacote = {
  id: string;
  tipo: "emergencia" | "calculadoras";
  versao: number;
  publicado: boolean;
  revisado_por: string | null;
  crmv: string | null;
  revisado_em: string | null;
  criado_em: string;
  tamanho: number;
};
type Conteudo = { vacinas: Vacina[]; versoes: Versao[]; pacotes: Pacote[] };

type Aba = "vacinas" | "versoes" | "pacotes" | "fogos" | "viagem" | "racas" | "categorias";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "vacinas", rotulo: "Vacinas" },
  { valor: "racas", rotulo: "Raças" },
  { valor: "categorias", rotulo: "Categorias do mapa" },
  { valor: "versoes", rotulo: "Versões publicadas" },
  { valor: "pacotes", rotulo: "Pacotes offline" },
  { valor: "fogos", rotulo: "Datas com fogos" },
  { valor: "viagem", rotulo: "Viagem" },
];
const TIPO_PACOTE: Record<Pacote["tipo"], string> = { emergencia: "Emergência (SOS)", calculadoras: "Calculadoras" };

type Form = { id: string | null; especie: "cao" | "gato"; nome: string; primeira: string; reforco: string; descricao: string; obrigatoria: boolean };
const VAZIO: Form = { id: null, especie: "cao", nome: "", primeira: "", reforco: "", descricao: "", obrigatoria: false };

function reforco(dias: number | null): string {
  if (dias === null) return "dose única";
  if (dias === 365) return "anual";
  if (dias > 30 && dias % 30 === 0) return `a cada ${dias / 30} meses`;
  return `a cada ${dias} dias`;
}

/**
 * Conteúdo mestre (protótipo AdminConteudo): o que alimenta o app do tutor.
 * Cada mudança no calendário de vacinas publica uma versão nova, que chega
 * aos apps na próxima abertura. É conteúdo de saúde: só o super admin edita,
 * e o pacote de emergência só publica com revisão veterinária (BUSINESS.md 5.18).
 */
export default function ConteudoPagina() {
  const admin = useAdmin();
  const [dados, setDados] = useState<Conteudo | null>(null);
  const [aba, setAba] = useState<Aba>("vacinas");
  const [form, setForm] = useState<Form>(VAZIO);
  const [rascunho, setRascunho] = useState<{ tipo: Pacote["tipo"]; json: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pode = admin.papel === "super";

  const carregar = useCallback(() => {
    rpcAdmin<Conteudo>("admin_conteudo").then(setDados, (e: Error) => setErro(e.message));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(acao: () => Promise<unknown>, sucesso: string) {
    setErro(null);
    setAviso(null);
    try {
      await acao();
      setAviso(sucesso);
      carregar();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    }
  }

  function editar(v: Vacina) {
    setAviso(null);
    setForm({
      id: v.id,
      especie: v.especie,
      nome: v.nome,
      primeira: String(v.primeira_dose_dias),
      reforco: v.reforco_dias === null ? "" : String(v.reforco_dias),
      descricao: v.descricao ?? "",
      obrigatoria: v.obrigatoria,
    });
  }

  async function publicar() {
    const ok = await agir(
      () =>
        rpcAdmin<number>("admin_vacina_salvar", {
          p_id: form.id,
          p_especie: form.especie,
          p_nome: form.nome,
          p_primeira_dias: form.primeira === "" ? null : Number(form.primeira),
          p_reforco_dias: form.reforco === "" ? null : Number(form.reforco),
          p_descricao: form.descricao,
          p_obrigatoria: form.obrigatoria,
        }),
      "Nova versão publicada. Os apps recebem na próxima abertura.",
    );
    if (ok && !form.id) setForm(VAZIO);
  }

  async function remover() {
    if (!form.id || !window.confirm(`Remover "${form.nome}" do calendário? Vacinas já registradas pelos tutores continuam lá.`)) return;
    if (await agir(() => rpcAdmin("admin_vacina_remover", { p_id: form.id }), "Vacina removida e nova versão publicada.")) setForm(VAZIO);
  }

  async function criarRascunho() {
    if (!rascunho) return;
    let conteudo: unknown;
    try {
      conteudo = JSON.parse(rascunho.json);
    } catch {
      setErro("O conteúdo não é um JSON válido.");
      return;
    }
    if (await agir(() => rpcAdmin("admin_pacote_rascunho", { p_tipo: rascunho.tipo, p_conteudo: conteudo }), "Rascunho criado. Publique quando estiver revisado.")) setRascunho(null);
  }

  async function publicarPacote(p: Pacote) {
    let revisor: string | null = null;
    let crmv: string | null = null;
    if (p.tipo === "emergencia") {
      revisor = window.prompt("Nome do veterinário que revisou o conteúdo:");
      if (!revisor) return;
      crmv = window.prompt("CRMV do veterinário (ex.: CRMV-RJ 12345):");
      if (!crmv) return;
    } else if (!window.confirm(`Publicar ${TIPO_PACOTE[p.tipo]} v${p.versao}? Os apps baixam na próxima abertura.`)) {
      return;
    }
    await agir(() => rpcAdmin("admin_pacote_publicar", { p_id: p.id, p_revisado_por: revisor, p_crmv: crmv }), `${TIPO_PACOTE[p.tipo]} v${p.versao} publicado.`);
  }

  if (!dados) return <p className="text-sm text-cinza">{erro ?? "Carregando…"}</p>;
  const caes = dados.vacinas.filter((v) => v.especie === "cao").length;
  const atual = dados.versoes[0];
  const publicados = dados.pacotes.filter((p) => p.publicado);

  function exportar() {
    if (!dados) return;
    const campo = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      ["Vacina", "Espécie", "1ª dose (dias de vida)", "Reforço", "Obrigatória", "Texto para o tutor"],
      ...dados.vacinas.map((v) => [v.nome, v.especie === "cao" ? "Cão" : "Gato", v.primeira_dose_dias, reforco(v.reforco_dias), v.obrigatoria ? "Sim" : "Não", v.descricao ?? ""]),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + linhas.map((l) => l.map(campo).join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `petlive-calendario-v${atual?.versao ?? 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const campo = "w-full rounded-2xl bg-suave px-4 pb-2.5 pt-6 text-[13px] font-semibold outline-none disabled:text-cinza";
  const rotulo = "pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-cinza";

  return (
    <>
      <Cabecalho titulo="Conteúdo mestre" subtitulo="O que alimenta o app do tutor: calendário de vacinas e conteúdo offline">
        <button onClick={exportar} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-5 text-[13px] font-bold">
          Exportar CSV
        </button>
      </Cabecalho>
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
      {aviso ? <p className="mb-3 rounded-2xl bg-verde-fundo p-3 text-sm text-verde-texto">{aviso}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Vacinas cadastradas" valor={numero(dados.vacinas.length)} apoio={`Cães ${caes} · Gatos ${dados.vacinas.length - caes}`} fundo="bg-roxo-fundo" cor="text-roxo-texto" />
        <CartaoNumero rotulo="Obrigatórias" valor={numero(dados.vacinas.filter((v) => v.obrigatoria).length)} apoio="Por lei ou essenciais" fundo="bg-azul-fundo" cor="text-azul-escuro" />
        <CartaoNumero
          rotulo="Pacotes offline"
          valor={numero(publicados.length)}
          apoio={dados.pacotes.length > publicados.length ? `${dados.pacotes.length - publicados.length} rascunho(s)` : "Versão 1 vem no app"}
          fundo="bg-amarelo-fundo"
          cor="text-amarelo-texto"
        />
        <CartaoNumero rotulo="Versão do calendário" valor={`v${atual?.versao ?? 1}`} apoio={atual ? `Publicada ${haQuanto(atual.publicado_em)}` : "—"} fundo="bg-verde-fundo" cor="text-verde-texto" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section className="min-w-0 rounded-[28px] bg-fundo p-5">
          <div className="flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button key={a.valor} onClick={() => setAba(a.valor)} className={`h-9 rounded-full px-4 text-[13px] font-bold ${aba === a.valor ? "bg-tinta text-white" : "border border-[#DDE1E8]"}`}>
                {a.rotulo}
              </button>
            ))}
          </div>

          {aba === "vacinas" ? (
            <table className="mt-4 w-full text-left text-[13px]">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
                <tr>
                  <th className="py-2">Vacina</th>
                  <th className="py-2">Espécie</th>
                  <th className="py-2">1ª dose</th>
                  <th className="py-2">Reforço</th>
                  <th className="py-2">Obrigatória</th>
                </tr>
              </thead>
              <tbody>
                {dados.vacinas.map((v) => (
                  <tr key={v.id} onClick={() => editar(v)} className={`cursor-pointer border-t border-[#EEF0F4] hover:bg-suave ${form.id === v.id ? "bg-azul-fundo" : ""}`}>
                    <td className="py-3 font-semibold">{v.nome}</td>
                    <td className="py-3">{v.especie === "cao" ? "Cão" : "Gato"}</td>
                    <td className="py-3">{v.primeira_dose_dias} dias</td>
                    <td className="py-3">{reforco(v.reforco_dias)}</td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${v.obrigatoria ? "bg-verde-fundo text-verde-texto" : "bg-suave text-cinza"}`}>{v.obrigatoria ? "Sim" : "Não"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : aba === "versoes" ? (
            <ul className="mt-4 space-y-2">
              {dados.versoes.map((v, i) => (
                <li key={v.versao} className="flex items-center justify-between gap-4 rounded-2xl bg-suave px-4 py-3 text-[13px]">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      v{v.versao} · {v.resumo} {i === 0 ? <span className="ml-1 rounded-full bg-verde-fundo px-2 py-0.5 text-[10px] font-bold text-verde-texto">Atual</span> : null}
                    </p>
                    <p className="text-xs text-cinza">por {v.por}</p>
                  </div>
                  <span className="flex-none text-xs text-cinza">{haQuanto(v.publicado_em)}</span>
                </li>
              ))}
            </ul>
          ) : aba === "racas" ? (
            <Racas pode={pode} />
          ) : aba === "categorias" ? (
            <Categorias pode={pode} />
          ) : aba === "viagem" ? (
            <Viagem pode={admin.papel === "super" || admin.papel === "marketing"} onErro={setErro} />
          ) : aba === "fogos" ? (
            <DatasFogos pode={admin.papel === "super" || admin.papel === "marketing"} onErro={setErro} />
          ) : (
            <div className="mt-4">
              <table className="w-full text-left text-[13px]">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
                  <tr>
                    <th className="py-2">Pacote</th>
                    <th className="py-2">Versão</th>
                    <th className="py-2">Revisão</th>
                    <th className="py-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {dados.pacotes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-cinza">Nenhuma versão no servidor: os apps usam a versão 1, que vem embutida.</td>
                    </tr>
                  ) : (
                    dados.pacotes.map((p) => (
                      <tr key={p.id} className="border-t border-[#EEF0F4]">
                        <td className="py-3 font-semibold">{TIPO_PACOTE[p.tipo]}</td>
                        <td className="py-3">v{p.versao}</td>
                        <td className="py-3 text-cinza">{p.revisado_por ? `${p.revisado_por} (${p.crmv})` : "—"}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${p.publicado ? "bg-verde-fundo text-verde-texto" : "bg-amarelo-fundo text-amarelo-texto"}`}>{p.publicado ? "Publicado" : "Rascunho"}</span>
                        </td>
                        <td className="py-3 text-right">
                          {pode && !p.publicado ? (
                            <button onClick={() => publicarPacote(p)} className="text-xs font-bold text-azul-escuro underline">
                              Publicar
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {pode ? (
                rascunho ? (
                  <div className="mt-4 rounded-2xl border border-[#DDE1E8] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="tipo-pacote" className="text-xs font-bold">Novo rascunho de</label>
                      <select id="tipo-pacote" value={rascunho.tipo} onChange={(e) => setRascunho({ ...rascunho, tipo: e.target.value as Pacote["tipo"] })} className="h-8 rounded-full bg-suave px-3 text-[13px] font-semibold">
                        <option value="emergencia">Emergência (SOS)</option>
                        <option value="calculadoras">Calculadoras</option>
                      </select>
                    </div>
                    <label htmlFor="json-pacote" className="sr-only">Conteúdo do pacote em JSON</label>
                    <textarea id="json-pacote" value={rascunho.json} onChange={(e) => setRascunho({ ...rascunho, json: e.target.value })} rows={8} spellCheck={false} placeholder='{ "guias": [ ... ] }' className="mt-3 w-full rounded-2xl bg-suave p-3 font-mono text-xs outline-none" />
                    <div className="mt-2 flex gap-2">
                      <button onClick={criarRascunho} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">Criar rascunho</button>
                      <button onClick={() => setRascunho(null)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setRascunho({ tipo: "emergencia", json: "" })} className="mt-4 h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">
                    Novo rascunho
                  </button>
                )
              ) : null}
              <p className="mt-3 text-[11px] leading-relaxed text-cinza">
                Os apps baixam o pacote publicado mais novo em segundo plano e guardam no celular, para funcionar sem internet. O de emergência só publica com nome e CRMV do veterinário que revisou.
              </p>
            </div>
          )}
        </section>

        {aba === "vacinas" ? <section className="h-fit min-w-0 rounded-[28px] bg-fundo p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">{form.id ? "Editar vacina" : "Nova vacina"}</h2>
            {form.id ? (
              <button onClick={() => setForm(VAZIO)} className="text-xs font-bold text-azul-escuro underline">
                Nova vacina
              </button>
            ) : null}
          </div>
          <fieldset disabled={!pode} className="mt-3 space-y-2.5">
            <div className="relative">
              <label htmlFor="v-nome" className={rotulo}>Nome</label>
              <input id="v-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
            </div>
            <div className="relative">
              <label htmlFor="v-especie" className={rotulo}>Espécie</label>
              <select id="v-especie" value={form.especie} onChange={(e) => setForm({ ...form, especie: e.target.value as Form["especie"] })} className={campo}>
                <option value="cao">Cão</option>
                <option value="gato">Gato</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <label htmlFor="v-primeira" className={rotulo}>1ª dose (dias de vida)</label>
                <input id="v-primeira" type="number" min={0} value={form.primeira} onChange={(e) => setForm({ ...form, primeira: e.target.value })} className={campo} />
              </div>
              <div className="relative">
                <label htmlFor="v-reforco" className={rotulo}>Reforço (dias)</label>
                <input id="v-reforco" type="number" min={1} value={form.reforco} placeholder="dose única" onChange={(e) => setForm({ ...form, reforco: e.target.value })} className={campo} />
              </div>
            </div>
            <div className="relative">
              <label htmlFor="v-descricao" className={rotulo}>Texto para o tutor</label>
              <textarea id="v-descricao" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={`${campo} resize-none`} />
            </div>
            <label className="flex items-center gap-2 px-1 text-[13px] font-semibold">
              <input type="checkbox" checked={form.obrigatoria} onChange={(e) => setForm({ ...form, obrigatoria: e.target.checked })} className="h-4 w-4 accent-tinta" />
              Obrigatória
            </label>
          </fieldset>
          <p className="mt-3 text-[11px] leading-relaxed text-cinza">
            {pode
              ? "Ao publicar, a nova versão chega aos apps na próxima abertura. Pets já cadastrados mantêm as datas que já registraram."
              : "Conteúdo de saúde: só o super admin edita."}
          </p>
          {pode ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={publicar} className="h-11 rounded-full bg-tinta px-6 text-[13px] font-bold text-white">
                Publicar nova versão
              </button>
              {form.id ? (
                <button onClick={remover} className="h-11 rounded-full border border-[#DDE1E8] px-5 text-[13px] font-bold text-perigo">
                  Remover
                </button>
              ) : null}
            </div>
          ) : null}
        </section> : null}
      </div>
    </>
  );
}
