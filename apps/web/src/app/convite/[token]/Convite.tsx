"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BotoesLojas } from "@/components/BotoesLojas";
import { FalhaLinkPublico } from "@/components/FalhaLinkPublico";
import { Mascote } from "@/components/Mascote";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Pet = { nome: string; especie: "cao" | "gato" };
type Resposta =
  | { limite: true }
  | { valido: false }
  | { valido: true; situacao: "enviado" | "aceito" | "recusado" | "cancelado" | "expirado"; titular: string; pets: Pet[]; expira_em: string };

const FECHADO: Record<string, string> = {
  aceito: "Este convite já foi aceito.",
  recusado: "Este convite foi recusado.",
  cancelado: "Quem convidou cancelou este convite.",
  expirado: "Este convite expirou. Peça um novo para quem convidou.",
};

function nomes(pets: Pet[]): string {
  const n = pets.map((p) => p.nome);
  return n.length <= 1 ? (n[0] ?? "o pet") : `${n.slice(0, -1).join(", ")} e ${n[n.length - 1]}`;
}

/**
 * Link do convite de guarda compartilhada (BUSINESS.md 5.45) para quem ainda
 * não tem o app: mostra quem convidou e os pets, sem dados de saúde, e leva
 * ao app pelo deep link ou às lojas.
 */
export default function Convite() {
  const { token } = useParams<{ token: string }>();
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [falhaRede, setFalhaRede] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    Promise.resolve()
      .then(() => {
        if (!URL_SUPABASE || !CHAVE_ANON) throw new Error("Supabase não configurado.");
        return fetch(`${URL_SUPABASE}/rest/v1/rpc/guarda_convite_publico`, {
          method: "POST",
          headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
          body: JSON.stringify({ p_token: token }),
        });
      })
      .then((r) => {
        if (!r.ok) throw new Error("A consulta do convite falhou.");
        return r.json() as Promise<Resposta>;
      })
      .then(
        (r) => {
          setResposta(r);
          setFalhaRede(false);
        },
        () => {
          setResposta(null);
          setFalhaRede(true);
        },
      );
  }, [token, tentativa]);

  if (falhaRede) {
    return (
      <FalhaLinkPublico
        onRetry={() => {
          setFalhaRede(false);
          setTentativa((n) => n + 1);
        }}
      />
    );
  }
  if (!resposta) return <main className="flex min-h-screen items-center justify-center bg-suave text-sm text-cinza">Abrindo o convite…</main>;

  const aberto = "valido" in resposta && resposta.valido && resposta.situacao === "enviado";
  const linkApp = `petlive://guarda/convite/link?t=${encodeURIComponent(token)}`;

  return (
    <main className="flex min-h-screen flex-col items-center bg-suave px-6 py-12 text-center">
      <p className="text-lg font-extrabold tracking-tight">PetLive</p>
      {"limite" in resposta ? (
        <p className="mt-10 max-w-md text-[15px] leading-relaxed text-cinza">Muitas consultas seguidas. Espere alguns minutos e abra o link de novo.</p>
      ) : !resposta.valido ? (
        <>
          <h1 className="mt-10 text-3xl font-medium tracking-tight">Convite não encontrado</h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cinza">Confira se o link está completo ou peça um novo para quem convidou você.</p>
        </>
      ) : (
        <>
          <div className="mt-8 flex gap-3">
            {resposta.pets.slice(0, 3).map((p) => (
              <span key={p.nome} className="flex h-24 w-24 items-end justify-center overflow-hidden rounded-full bg-azul">
                <Mascote especie={p.especie} className="h-20 w-20" />
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm font-semibold text-azul-texto">{resposta.titular} convidou você</p>
          <h1 className="mt-1 max-w-lg text-3xl font-medium leading-tight tracking-tight">Dividir os cuidados de {nomes(resposta.pets)}</h1>
          {aberto ? (
            <>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-cinza">
                Quem divide a guarda vê e atualiza vacinas, remédios, peso e lembretes, e tudo aparece para os dois na hora. Não precisa de Premium.
              </p>
              <ol className="mt-8 w-full max-w-md space-y-3 text-left">
                {["Baixe o PetLive no celular.", "Entre ou crie a conta com o e-mail que recebeu o convite.", "Volte aqui e toque em Abrir no app."].map((passo, i) => (
                  <li key={passo} className="flex items-center gap-3 rounded-3xl bg-white px-4 py-3 text-[15px]">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-tinta text-sm font-bold text-white">{i + 1}</span>
                    {passo}
                  </li>
                ))}
              </ol>
              <a href={linkApp} className="mt-8 flex h-14 w-full max-w-md items-center justify-center rounded-full bg-tinta text-[16px] font-bold text-white">
                Abrir no app
              </a>
              <div className="mt-6">
                <BotoesLojas />
              </div>
              <p className="mt-6 text-xs text-cinza">
                Vale até {new Date(resposta.expira_em).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}.
              </p>
            </>
          ) : (
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-cinza">{FECHADO[resposta.situacao]}</p>
          )}
        </>
      )}
    </main>
  );
}
