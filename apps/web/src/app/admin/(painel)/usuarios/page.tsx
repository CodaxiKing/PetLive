"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Linha = {
  id: string;
  nome: string;
  email: string;
  plano: string;
  pets: string;
  criado_em: string;
  ultimo_acesso: string | null;
  suspenso: boolean;
};

type Ficha = Omit<Linha, "pets"> & {
  pets: { nome: string; especie: string; raca: string | null }[];
  vacinas: number;
  lembretes_ativos: number;
  remedios: number;
  lugares_salvos: number;
  indicacoes: number;
  pedidos_lgpd: { tipo: string; status: string; criado_em: string }[];
};

const CORES_AVATAR = ["bg-roxo-fundo", "bg-azul-fundo", "bg-amarelo-fundo", "bg-rosa-fundo", "bg-verde-fundo"];

function csv(linhas: Linha[]): string {
  const campo = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const cabecalho = ["Nome", "E-mail", "Plano", "Pets", "Desde", "Último acesso", "Suspenso"];
  const corpo = linhas.map((l) =>
    [l.nome, l.email, l.plano, l.pets, new Date(l.criado_em).toLocaleDateString("pt-BR"), l.ultimo_acesso ? new Date(l.ultimo_acesso).toLocaleDateString("pt-BR") : "", l.suspenso ? "sim" : "não"]
      .map((v) => campo(String(v)))
      .join(";"),
  );
  return "﻿" + [cabecalho.join(";"), ...corpo].join("\n");
}

/**
 * Usuários e pets (protótipo AdminUsuarios): busca por nome, e-mail ou pet,
 * a ficha do tutor (sem dados de saúde, BUSINESS.md 17.3) e suspender conta
 * (super e moderação), que fica no registro de ações.
 */
export default function Usuarios() {
  const admin = useAdmin();
  const [busca, setBusca] = useState("");
  const [lista, setLista] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const podeSuspender = admin.papel === "super" || admin.papel === "moderacao";

  const buscar = useCallback((termo: string) => {
    setCarregando(true);
    rpcAdmin<Linha[]>("admin_usuarios", { p_busca: termo || null, p_limite: 100 }).then(
      (linhas) => {
        setLista(linhas);
        setCarregando(false);
      },
      (e: Error) => {
        setErro(e.message);
        setCarregando(false);
      },
    );
  }, []);

  useEffect(() => {
    buscar("");
  }, [buscar]);

  // Busca enquanto digita, sem pedir a cada tecla.
  useEffect(() => {
    const t = setTimeout(() => buscar(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca, buscar]);

  function abrir(id: string) {
    setErro(null);
    rpcAdmin<Ficha>("admin_usuario", { p_id: id }).then(setFicha, (e: Error) => setErro(e.message));
  }

  async function suspender(suspender: boolean) {
    if (!ficha) return;
    const motivo = suspender ? window.prompt(`Motivo para suspender ${ficha.nome} (fica no registro de ações):`) : "";
    if (suspender && !motivo) return;
    try {
      await rpcAdmin("admin_suspender", { p_id: ficha.id, p_suspender: suspender, p_motivo: motivo });
      abrir(ficha.id);
      buscar(busca.trim());
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  function exportar() {
    const url = URL.createObjectURL(new Blob([csv(lista)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `petlive-tutores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Cabecalho titulo="Usuários e pets" subtitulo="Tutores, pets cadastrados e suporte">
        <button onClick={exportar} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-5 text-[13px] font-bold">
          Exportar CSV
        </button>
        <label className="flex h-10 w-72 items-center gap-2 rounded-full bg-fundo px-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6A7484" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <span className="sr-only">Buscar tutor</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tutor, e-mail ou pet" className="w-full bg-transparent text-[13px] outline-none" />
        </label>
      </Cabecalho>

      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section className="overflow-hidden rounded-[28px] bg-fundo">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="px-5 py-3">Tutor</th>
                <th className="px-3 py-3">Pets</th>
                <th className="px-3 py-3">Plano</th>
                <th className="px-3 py-3">Último acesso</th>
              </tr>
            </thead>
            <tbody>
              {carregando && lista.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-cinza">Carregando…</td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-6 text-cinza">Ninguém encontrado.</td>
                </tr>
              ) : (
                lista.map((l, i) => (
                  <tr
                    key={l.id}
                    onClick={() => abrir(l.id)}
                    className={`cursor-pointer border-t border-[#EEF0F4] hover:bg-suave ${ficha?.id === l.id ? "bg-azul-fundo" : ""}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-bold ${CORES_AVATAR[i % CORES_AVATAR.length]}`}>
                          {l.nome.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {l.nome} {l.suspenso ? <span className="ml-1 rounded-full bg-perigo-fundo px-2 py-0.5 text-[10px] font-bold text-perigo">Suspenso</span> : null}
                          </p>
                          <p className="truncate text-xs text-cinza">{l.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-40 truncate px-3 py-3">{l.pets || "—"}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${l.plano === "premium" ? "bg-roxo-fundo text-roxo-texto" : "bg-suave"}`}>
                        {l.plano === "premium" ? "Premium" : "Grátis"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-cinza">{haQuanto(l.ultimo_acesso)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="h-fit min-w-0 rounded-[28px] bg-fundo p-6">
          {!ficha ? (
            <p className="text-sm text-cinza">Escolha um tutor na lista para ver a ficha.</p>
          ) : (
            <>
              <h2 className="font-bold">Tutor selecionado</h2>
              <div className="mt-3 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-roxo-fundo font-bold">{ficha.nome.charAt(0).toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{ficha.nome}</p>
                  <p className="text-xs text-cinza">
                    Desde {new Date(ficha.criado_em).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })} · {ficha.plano === "premium" ? "Premium" : "Grátis"} · {ficha.email}
                  </p>
                </div>
              </div>
              <dl className="mt-4 space-y-2 text-[13px]">
                {[
                  ["Pets", ficha.pets.map((p) => `${p.nome} (${p.especie === "gato" ? "gato" : "cão"})`).join(", ") || "—"],
                  ["Vacinas registradas", numero(ficha.vacinas)],
                  ["Lembretes ativos", numero(ficha.lembretes_ativos)],
                  ["Remédios", numero(ficha.remedios)],
                  ["Lugares salvos", numero(ficha.lugares_salvos)],
                  ["Último acesso", haQuanto(ficha.ultimo_acesso)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex justify-between gap-4 rounded-2xl bg-suave px-4 py-3">
                    <dt className="text-cinza">{rotulo}</dt>
                    <dd className="text-right font-semibold">{valor}</dd>
                  </div>
                ))}
              </dl>
              {ficha.pedidos_lgpd.length > 0 ? (
                <p className="mt-3 text-xs text-cinza">
                  Pedidos de privacidade: {ficha.pedidos_lgpd.map((p) => `${p.tipo} (${p.status})`).join(", ")}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`mailto:${ficha.email}`} className="rounded-full border border-[#DDE1E8] px-4 py-2 text-[13px] font-bold">
                  Enviar e-mail
                </a>
                {podeSuspender ? (
                  ficha.suspenso ? (
                    <button onClick={() => suspender(false)} className="rounded-full bg-verde-fundo px-4 py-2 text-[13px] font-bold text-verde-texto">
                      Reativar conta
                    </button>
                  ) : (
                    <button onClick={() => suspender(true)} className="rounded-full border border-[#DDE1E8] px-4 py-2 text-[13px] font-bold text-perigo">
                      Suspender conta
                    </button>
                  )
                ) : null}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-cinza">
                Dados de saúde do pet só aparecem com autorização do tutor e ficam no registro de auditoria.
              </p>
            </>
          )}
        </section>
      </div>
    </>
  );
}
