"use client";

import { useCallback, useEffect, useState } from "react";
import { haQuanto } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Alerta = {
  id: string;
  status: "ativo" | "encontrado" | "encerrado" | "expirado";
  pet: string;
  especie: "cao" | "gato";
  foto: string | null;
  tutor: string;
  mensagem: string | null;
  raio_km: number;
  lat: number;
  lng: number;
  mostrar_telefone: boolean;
  reconhecimento: boolean;
  criado_em: string;
  expira_em: string;
  encerrado_em: string | null;
  avisados: number;
  avistamentos: number;
  alertas_do_tutor_30d: number;
};

const STATUS: Record<Alerta["status"], { rotulo: string; cor: string }> = {
  ativo: { rotulo: "Ativo", cor: "bg-rosa-fundo text-rosa-texto" },
  encontrado: { rotulo: "Encontrado", cor: "bg-verde-fundo text-verde-texto" },
  encerrado: { rotulo: "Encerrado", cor: "bg-suave text-cinza" },
  expirado: { rotulo: "Expirou", cor: "bg-suave text-cinza" },
};
const MOTIVOS = ["Foto de outro animal", "Texto ofensivo ou golpe", "Alerta repetido", "Pet já foi encontrado"];

/**
 * Pets perdidos (BUSINESS.md 5.29): alertas ativos e dos últimos 30 dias. A
 * equipe só encerra alerta abusivo; o tutor recebe o motivo. A localização
 * aparece aproximada (3 casas, ~100 m).
 */
export function PetsPerdidos({ pode }: { pode: boolean }) {
  const [lista, setLista] = useState<Alerta[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    rpcAdmin<Alerta[]>("admin_perdidos").then(setLista, (e: Error) => setErro(e.message));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function encerrar(id: string) {
    setErro(null);
    try {
      await rpcAdmin("admin_perdido_encerrar", { p_id: id, p_motivo: motivo });
      setMotivo("");
      setAberto(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  return (
    <section className="mt-4 rounded-[28px] bg-fundo p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">Pets perdidos</h2>
        <span className="text-xs text-cinza">Ativos e dos últimos 30 dias</span>
      </div>
      {erro ? <p className="mt-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
      {!lista ? (
        <p className="mt-3 text-sm text-cinza">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="mt-3 text-sm text-cinza">Nenhum alerta de pet perdido.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {lista.map((a) => (
            <li key={a.id} className="rounded-2xl bg-suave px-4 py-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-3">
                {a.foto && /^https:\/\//i.test(a.foto) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.foto} alt="" referrerPolicy="no-referrer" className="h-11 w-11 flex-none rounded-xl object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {a.pet} <span className="font-normal text-cinza">· {a.especie === "gato" ? "gato" : "cão"} · tutor {a.tutor}</span>
                  </p>
                  <p className="text-xs text-cinza">
                    Criado {haQuanto(a.criado_em)} · raio {a.raio_km} km · {a.avisados} avisados · {a.avistamentos} avistamentos
                    {a.reconhecimento ? " · busca por foto" : ""}
                    {a.alertas_do_tutor_30d > 2 ? ` · ${a.alertas_do_tutor_30d} alertas do tutor em 30 dias` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[a.status].cor}`}>{STATUS[a.status].rotulo}</span>
              </div>
              {a.mensagem ? <p className="mt-2 rounded-xl bg-fundo px-3 py-2">“{a.mensagem}”</p> : null}
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                <a href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=15/${a.lat}/${a.lng}`} target="_blank" rel="noreferrer" className="text-azul-escuro underline">
                  Ver a região no mapa
                </a>
                {pode && a.status === "ativo" ? (
                  <button onClick={() => setAberto(aberto === a.id ? null : a.id)} className="text-perigo underline">
                    Encerrar alerta abusivo
                  </button>
                ) : null}
              </div>
              {aberto === a.id ? (
                <div className="mt-2 rounded-2xl border border-[#DDE1E8] bg-fundo p-3">
                  <p className="text-xs font-bold">Motivo (o tutor vê no app)</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {MOTIVOS.map((m) => (
                      <button key={m} onClick={() => setMotivo(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${motivo === m ? "bg-tinta text-white" : "bg-suave"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <input aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ou escreva o motivo" className="mt-2 h-9 w-full rounded-full bg-suave px-3 text-[13px] outline-none" />
                  <button onClick={() => encerrar(a.id)} className="mt-2 h-9 w-full rounded-full border border-[#DDE1E8] text-[13px] font-bold text-perigo">
                    Encerrar e avisar o tutor
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
