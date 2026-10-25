"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FalhaLinkPublico } from "@/components/FalhaLinkPublico";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Dose = { medication_id: string; nome: string; dose: string | null; prevista_para: string; confirmada_em: string | null; confirmada_por: string };
type Pet = {
  id: string;
  nome: string;
  sexo: "macho" | "femea" | null;
  alergias: string | null;
  veterinario: string | null;
  vacinas: { nome: string; proxima_dose: string | null }[] | null;
  vermifugo: string | null;
  doses: Dose[] | null;
};
type Visao =
  | { valido: false }
  | {
      valido: true;
      cuidador: string;
      tutor: { nome: string | null; telefone: string | null };
      fim: string;
      ver: { vacinas: boolean; remedios: boolean; contatos: boolean };
      pets: Pet[];
    };

async function rpc<T>(nome: string, corpo: object): Promise<T> {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error((JSON.parse(texto) as { message?: string }).message ?? "Não deu certo. Tente de novo.");
  return (texto ? JSON.parse(texto) : null) as T;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataCurta = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

function falta(iso: string, agora: number): string {
  const min = Math.round((new Date(iso).getTime() - agora) / 60_000);
  if (min < -30) return `atrasada ${Math.round(-min / 60) || 1} h`;
  if (min <= 0) return "agora";
  if (min < 60) return `falta ${min} min`;
  return `falta ${Math.round(min / 60)} h`;
}

function resumoVacinas(p: Pet, agora: number): string {
  const partes: string[] = [];
  const vacinas = p.vacinas ?? [];
  const hoje = new Date(agora).toISOString().slice(0, 10);
  const atrasadas = vacinas.filter((v) => v.proxima_dose && v.proxima_dose < hoje).map((v) => v.nome);
  if (vacinas.length === 0) partes.push("Nenhuma vacina registrada");
  else if (atrasadas.length) partes.push(`Atrasada: ${atrasadas.join(", ")}`);
  else partes.push(`${vacinas.map((v) => v.nome).slice(0, 3).join(", ")} em dia`);
  if (p.vermifugo) {
    const meses = Math.floor((agora - new Date(`${p.vermifugo}T12:00:00`).getTime()) / (30 * 86_400_000));
    partes.push(meses < 1 ? "vermífugo este mês" : `vermífugo há ${meses} ${meses === 1 ? "mês" : "meses"}`);
  }
  return partes.join(" · ");
}

/**
 * Visão do cuidador (protótipo CuidadorVisao): página sem login, com o que o
 * tutor liberou e os dados de agora. O cuidador marca a dose dada; o tutor é
 * avisado. Depois do prazo ou revogado, nada aparece.
 */
export default function Cuidador() {
  const { codigo } = useParams<{ codigo: string }>();
  const [visao, setVisao] = useState<Visao | null>(null);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [falhaRede, setFalhaRede] = useState(false);
  // Hora da última leitura: base de "falta 2 h" e dos dias que restam.
  const [agora, setAgora] = useState(0);

  const carregar = useCallback(() => {
    const pedido = Promise.resolve().then(() => {
      if (!URL_SUPABASE || !CHAVE_ANON) throw new Error("Supabase não configurado.");
      return rpc<Visao>("cuidador_visao", { p_codigo: codigo });
    });
    pedido.then(
      (v) => {
        setVisao(v);
        setFalhaRede(false);
        setAgora(Date.now());
      },
      () => {
        setVisao(null);
        setFalhaRede(true);
      },
    );
  }, [codigo]);

  useEffect(() => {
    carregar();
    // Doses mudam ao longo do dia (e o tutor pode marcar pelo app).
    const t = setInterval(carregar, 120_000);
    return () => clearInterval(t);
  }, [carregar]);

  async function feito(d: Dose) {
    setErro(null);
    setMarcando(d.medication_id + d.prevista_para);
    try {
      await rpc("cuidador_marcar_dose", { p_codigo: codigo, p_medication: d.medication_id, p_prevista_para: d.prevista_para });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setMarcando(null);
    }
  }

  if (!visao && falhaRede) return <FalhaLinkPublico onRetry={carregar} />;
  if (!visao) return <main className="flex min-h-screen items-center justify-center text-sm text-cinza">Abrindo…</main>;
  if (!visao.valido) return <Encerrado />;

  const dias = Math.max(Math.ceil((new Date(visao.fim).getTime() - agora) / 86_400_000), 0);
  const nomes = visao.pets.map((p) => `${p.sexo === "femea" ? "da" : "do"} ${p.nome}`).join(" e ");
  const telefone = visao.tutor.telefone?.trim() || null;

  return (
    <main className="min-h-screen bg-fundo pb-28">
      <header className="bg-[#2F6F93] text-white">
        <div className="mx-auto max-w-xl px-5 py-6">
          <p className="text-[13px] font-extrabold uppercase tracking-wider text-white/85">Cuidador temporário</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Você cuida {nomes} até {dataCurta(visao.fim)}
          </h1>
          <p className="mt-1 text-[14px] text-white/90">
            Acesso criado por {visao.tutor.nome ?? "o tutor"} para {visao.cuidador} · termina {dias <= 1 ? "em menos de 1 dia" : `em ${dias} dias`}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-xl space-y-3 px-5 py-4">
        {erro ? <p className="rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
        {visao.pets.map((p) => (
          <div key={p.id} className="space-y-3">
            {visao.pets.length > 1 ? <h2 className="pt-2 text-xl font-bold">{p.nome}</h2> : null}
            {visao.ver.remedios ? (
              <section className="space-y-2">
                <h3 className="text-[15px] font-bold">Remédios de hoje</h3>
                {(p.doses ?? []).length === 0 ? (
                  <p className="rounded-[24px] bg-suave px-5 py-4 text-[14px] text-cinza">Nenhum remédio para hoje.</p>
                ) : (
                  (p.doses ?? []).map((d) =>
                    d.confirmada_em ? (
                      <div key={d.medication_id + d.prevista_para} className="flex items-center gap-3 rounded-[24px] bg-verde-fundo px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-verde-texto">
                            {d.nome}
                            {d.dose ? ` · ${d.dose}` : ""}
                          </p>
                          <p className="text-[13px] text-verde-texto">
                            Dado às {hora(d.confirmada_em)} por {d.confirmada_por === visao.cuidador ? "você" : d.confirmada_por}
                          </p>
                        </div>
                        <span className="text-2xl text-verde-texto" aria-hidden="true">✓</span>
                      </div>
                    ) : (
                      <div key={d.medication_id + d.prevista_para} className="flex items-center gap-3 rounded-[24px] bg-suave px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">
                            {d.nome}
                            {d.dose ? ` · ${d.dose}` : ""}
                          </p>
                          <p className="text-[13px] text-cinza">
                            {hora(d.prevista_para)} · {falta(d.prevista_para, agora)}
                          </p>
                        </div>
                        <button
                          onClick={() => feito(d)}
                          disabled={marcando !== null}
                          className="h-11 rounded-full bg-tinta px-6 text-[14px] font-bold text-white disabled:opacity-50"
                        >
                          {marcando === d.medication_id + d.prevista_para ? "…" : "Feito"}
                        </button>
                      </div>
                    ),
                  )
                )}
              </section>
            ) : null}
            {visao.ver.vacinas ? (
              <section className="rounded-[24px] bg-suave px-5 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">Vacinas e vermífugo</h3>
                <p className="mt-1 text-[15px]">{resumoVacinas(p, agora)}</p>
              </section>
            ) : null}
            {visao.ver.contatos && p.alergias?.trim() ? (
              <section className="rounded-[24px] bg-[#FCE1E6] px-5 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">Alergias</h3>
                <p className="mt-1 text-[15px]">{p.alergias}</p>
              </section>
            ) : null}
            {visao.ver.contatos ? (
              <section className="rounded-[24px] bg-azul-fundo px-5 py-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">Emergência</h3>
                <p className="mt-1 text-[15px]">Veterinário: {p.veterinario?.trim() || "não informado"}</p>
                <p className="text-[15px]">
                  Tutor: {visao.tutor.nome ?? "—"}
                  {telefone ? ` · ${telefone}` : ""}
                </p>
              </section>
            ) : null}
          </div>
        ))}
        <p className="px-2 text-center text-[12px] leading-relaxed text-cinza">
          Você vê só o que o tutor liberou, até o fim do prazo. Cada acesso fica registrado. Em emergência, ligue para o tutor ou vá à clínica mais perto.
        </p>
      </div>

      {telefone ? (
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-fundo via-fundo to-transparent px-5 pb-5 pt-6">
          <a href={`tel:${telefone.replace(/[^\d+]/g, "")}`} className="mx-auto flex h-14 max-w-xl items-center justify-center gap-2 rounded-full bg-tinta text-[15px] font-bold text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
            Ligar para o tutor
          </a>
        </div>
      ) : null}
    </main>
  );
}

function Encerrado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-fundo px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-amarelo-fundo">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 11h12v9H6z" />
          <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
        </svg>
      </span>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">Este acesso terminou</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cinza">
        O prazo combinado acabou ou o tutor encerrou o acesso. Por segurança, os dados do pet não ficam abertos.
      </p>
      <p className="mt-6 max-w-md rounded-[24px] bg-suave px-6 py-4 text-left text-[14px] leading-relaxed">
        <strong>Ainda está cuidando do pet?</strong> Peça ao tutor um novo acesso pelo PetLive.
      </p>
      <Link href="/" className="mt-6 flex h-12 items-center rounded-full bg-tinta px-8 text-[15px] font-bold text-white">
        Conhecer o PetLive
      </Link>
    </main>
  );
}
