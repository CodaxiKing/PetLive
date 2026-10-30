"use client";

import { useCallback, useEffect, useState } from "react";
import { haQuanto, numero } from "@/components/admin/Painel";
import { rpcAdmin, supabaseAdmin } from "@/lib/admin/supabase";

type Denuncia = {
  alvo_tipo: "post" | "comentario";
  alvo_id: string;
  denuncias: number;
  motivos: string[];
  ultima: string;
  texto: string | null;
  foto_path: string | null;
  status: "publicado" | "oculto" | "removido" | null;
  autor: string | null;
};
type Dados = { posts_7d: number; perfis_publicos: number; denuncias: Denuncia[] };

/**
 * Comunidade (BUSINESS.md 5.28): denúncias de posts e comentários. Com 3
 * denúncias o conteúdo já some do app; a equipe remove de vez ou mantém.
 */
export function Comunidade({ pode }: { pode: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    rpcAdmin<Dados>("admin_comunidade").then(
      async (d) => {
        setDados(d);
        const caminhos = d.denuncias.map((x) => x.foto_path).filter((c): c is string => Boolean(c));
        if (!caminhos.length) return;
        const { data } = await supabaseAdmin().storage.from("comunidade").createSignedUrls(caminhos, 600);
        setFotos(Object.fromEntries((data ?? []).flatMap((x) => (x.path && x.signedUrl ? [[x.path, x.signedUrl]] : []))));
      },
      (e: Error) => setErro(e.message),
    );
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(d: Denuncia, remover: boolean) {
    setErro(null);
    try {
      await rpcAdmin("admin_comunidade_decidir", { p_tipo: d.alvo_tipo, p_alvo: d.alvo_id, p_remover: remover });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <section className="mt-4 admin-surface bg-fundo p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-bold">Comunidade: denúncias</h2>
        {dados ? (
          <span className="text-xs text-cinza">
            {numero(dados.perfis_publicos)} perfis públicos · {numero(dados.posts_7d)} posts em 7 dias
          </span>
        ) : null}
      </div>
      {erro ? <p className="mt-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
      {!dados ? (
        <p className="mt-3 text-sm text-cinza">Carregando…</p>
      ) : dados.denuncias.length === 0 ? (
        <p className="mt-3 text-sm text-cinza">Nenhuma denúncia em aberto.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dados.denuncias.map((d) => (
            <li key={`${d.alvo_tipo}-${d.alvo_id}`} className="flex flex-wrap items-start gap-3 rounded-2xl bg-suave px-4 py-3 text-[13px]">
              {d.foto_path && fotos[d.foto_path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotos[d.foto_path]} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {d.alvo_tipo === "post" ? "Post" : "Comentário"} de {d.autor ?? "—"}
                  <span className="ml-2 rounded-full bg-rosa-fundo px-2 py-0.5 text-[11px] font-bold text-rosa-texto">{d.denuncias} {d.denuncias === 1 ? "denúncia" : "denúncias"}</span>
                  {d.status === "oculto" ? <span className="ml-1 rounded-full bg-amarelo-fundo px-2 py-0.5 text-[11px] font-bold text-amarelo-texto">Escondido no app</span> : null}
                </p>
                {d.texto ? <p className="mt-1">“{d.texto}”</p> : null}
                <p className="mt-1 text-xs text-cinza">{d.motivos.join(" · ")} · {haQuanto(d.ultima)}</p>
              </div>
              {pode && d.status !== "removido" ? (
                <div className="flex gap-2">
                  <button onClick={() => decidir(d, true)} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">Remover</button>
                  <button onClick={() => decidir(d, false)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Manter</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
