"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Conteudo = {
  nome: string;
  especie: "cao" | "gato";
  foto_url: string | null;
  raca?: string | null;
  nascimento?: string | null;
  sexo?: "macho" | "femea" | null;
  peso?: number | null;
  peso_em?: string | null;
  vacinas?: { nome: string; aplicada_em: string; proxima_dose: string | null }[];
  vermifugos?: { produto: string | null; aplicado_em: string; proxima_dose: string | null }[];
  alergias?: string | null;
  remedios?: { nome: string; dose: string | null; frequencia: string | null; horarios: string[] | null; fim: string | null }[];
  castrado?: boolean | null;
  veterinario?: string | null;
  observacoes?: string | null;
  tutor?: { nome: string | null; telefone: string | null };
};
type Resposta = { valido: false } | { valido: true; tipo?: "carteirinha" | "emergencia"; conteudo: Conteudo; secoes: string[]; criado_em: string; expira_em: string };

/** "12/03/26" a partir de "2026-03-12". */
function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

function idade(nascimento: string | null | undefined): string | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00`);
  const hoje = new Date();
  let meses = (hoje.getFullYear() - n.getFullYear()) * 12 + hoje.getMonth() - n.getMonth();
  if (hoje.getDate() < n.getDate()) meses -= 1;
  if (meses < 12) return `${Math.max(meses, 0)} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function diasAte(iso: string): number {
  const alvo = new Date(`${iso}T00:00:00`).getTime();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje.getTime()) / 86_400_000);
}

/** "em dia", "vence em 5 dias", "atrasada desde 12/09/26". */
function situacao(proxima: string | null): { texto: string; ok: boolean } {
  if (!proxima) return { texto: "dose única", ok: true };
  const dias = diasAte(proxima);
  if (dias < 0) return { texto: `atrasada desde ${data(proxima)}`, ok: false };
  if (dias <= 7) return { texto: dias === 0 ? "vence hoje" : `vence em ${dias} ${dias === 1 ? "dia" : "dias"}`, ok: false };
  return { texto: `em dia até ${data(proxima)}`, ok: true };
}

/** "Gerada hoje às 14:32", "Gerada em 20/10 às 14:32". */
function quando(iso: string, verbo: string): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const amanha = new Date(hoje.getTime() + 86_400_000);
  const dia =
    d.toDateString() === hoje.toDateString()
      ? "hoje"
      : d.toDateString() === amanha.toDateString()
        ? "amanhã"
        : `em ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  return `${verbo} ${dia} às ${hora}`;
}

function soDigitos(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  return d.length <= 11 ? `55${d}` : d;
}

function Cartao({ titulo, fundo = "bg-suave", children }: { titulo: string; fundo?: string; children: ReactNode }) {
  return (
    <section className={`break-inside-avoid rounded-[26px] px-6 py-4 ${fundo}`}>
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">{titulo}</h2>
      <div className="mt-1 text-[15px] leading-snug">{children}</div>
    </section>
  );
}

/**
 * Carteirinha por link (protótipos FichaVista, FichaVistaPC e FichaExpirada):
 * página pública, sem login, com só o que o tutor escolheu incluir. Link
 * vencido ou cancelado não mostra nenhum dado do pet.
 */
export default function Ficha() {
  const { codigo } = useParams<{ codigo: string }>();
  const [resposta, setResposta] = useState<Resposta | null>(null);

  useEffect(() => {
    const pedido: Promise<Resposta> =
      URL_SUPABASE && CHAVE_ANON
        ? fetch(`${URL_SUPABASE}/rest/v1/rpc/carteirinha_publica`, {
            method: "POST",
            headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
            body: JSON.stringify({ p_codigo: codigo }),
          }).then((r) => (r.ok ? r.json() : { valido: false }))
        : Promise.resolve({ valido: false });
    pedido.then(setResposta, () => setResposta({ valido: false }));
  }, [codigo]);

  if (!resposta) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-cinza">Abrindo a carteirinha…</main>;
  }
  if (!resposta.valido) return <Expirada />;

  const c = resposta.conteudo;
  // Ficha de emergência: faixa vermelha, como no protótipo FichaVista.
  const emergencia = resposta.tipo === "emergencia";
  const rotuloFicha = emergencia ? "Ficha de emergência" : "Carteirinha do pet";
  const especie = c.especie === "gato" ? "Gato" : "Cão";
  const sexo = c.sexo ? (c.sexo === "femea" ? "fêmea" : "macho") : null;
  const sexoCastrado = [sexo, c.castrado === true ? (c.sexo === "femea" ? "castrada" : "castrado") : null].filter(Boolean).join(" ");
  const resumo = [especie, c.raca, idade(c.nascimento), c.peso ? `${String(c.peso).replace(".", ",")} kg` : null, sexoCastrado || null]
    .filter(Boolean)
    .join(" · ");
  const vacinas = c.vacinas ?? [];
  const emDia = vacinas.length > 0 && vacinas.every((v) => situacao(v.proxima_dose).ok);
  const telefone = c.tutor?.telefone?.trim() || null;
  const temSaude = c.castrado !== undefined;

  const cartoes = (
    <>
      {c.alergias !== undefined ? (
        <Cartao titulo="Alergias e condições" fundo="bg-[#FCE1E6]">
          {c.alergias?.trim() || "Nenhuma informada pelo tutor"}
        </Cartao>
      ) : null}
      {c.remedios !== undefined ? (
        <Cartao titulo="Remédios em uso">
          {c.remedios.length === 0
            ? "Nenhum remédio em uso"
            : c.remedios.map((r) => (
                <p key={r.nome}>
                  {[r.nome, r.dose, r.frequencia].filter(Boolean).join(" · ")}
                  {r.horarios?.length ? <span className="text-cinza"> · {r.horarios.map((h) => h.slice(0, 5)).join(", ")}</span> : null}
                  {r.fim ? <span className="text-cinza"> · até {data(r.fim)}</span> : null}
                </p>
              ))}
        </Cartao>
      ) : null}
      {c.vacinas !== undefined ? (
        <Cartao titulo="Vacinas">
          {vacinas.length === 0
            ? "Nenhuma vacina registrada"
            : vacinas.map((v, i) => {
                const s = situacao(v.proxima_dose);
                return (
                  <p key={`${v.nome}-${i}`} className={s.ok ? "text-verde-texto" : "text-perigo"}>
                    <span className="font-semibold">{v.nome}</span> {s.texto}
                    <span className="text-cinza"> · aplicada {data(v.aplicada_em)}</span>
                  </p>
                );
              })}
        </Cartao>
      ) : null}
      {c.vermifugos !== undefined || c.peso_em !== undefined ? (
        <Cartao titulo="Vermífugo e peso">
          {c.vermifugos !== undefined ? (
            <p>
              {c.vermifugos.length === 0
                ? "Vermífugo não registrado"
                : `Vermífugo em ${data(c.vermifugos[0].aplicado_em)}${c.vermifugos[0].produto ? ` (${c.vermifugos[0].produto})` : ""}`}
            </p>
          ) : null}
          {c.peso ? (
            <p>
              {String(c.peso).replace(".", ",")} kg{c.peso_em ? `, medido em ${data(c.peso_em)}` : ""}
            </p>
          ) : null}
        </Cartao>
      ) : null}
      {temSaude ? (
        <Cartao titulo="Saúde e cuidados">Castrado: {c.castrado === null ? "não informado" : c.castrado ? "sim" : "não"}</Cartao>
      ) : null}
      {c.veterinario !== undefined ? (
        <Cartao titulo="Veterinário habitual">{c.veterinario?.trim() || "Não informado"}</Cartao>
      ) : null}
      {c.observacoes !== undefined ? (
        <Cartao titulo="Observações do tutor">
          <p className="whitespace-pre-line">{c.observacoes?.trim() || "Nenhuma"}</p>
        </Cartao>
      ) : null}
    </>
  );

  const acoes = (
    <>
      {telefone ? (
        <>
          <a href={`tel:${telefone.replace(/[^\d+]/g, "")}`} className="flex h-14 items-center justify-center gap-2 rounded-full bg-tinta text-[15px] font-bold text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
            </svg>
            Ligar para o tutor
          </a>
          <a
            href={`https://wa.me/${soDigitos(telefone)}?text=${encodeURIComponent(`Olá! Abri a carteirinha de ${c.nome} pelo PetLive.`)}`}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center rounded-full bg-verde-fundo text-[14px] font-bold text-verde-texto"
          >
            Chamar no WhatsApp
          </a>
        </>
      ) : null}
      <button onClick={() => window.print()} className="flex h-12 items-center justify-center rounded-full bg-[#EEF1F5] text-[14px] font-bold">
        Imprimir ou salvar em PDF
      </button>
    </>
  );

  const aviso = "Informações do tutor, pelo PetLive. Confirme com ele. Não substitui o histórico da clínica. O tutor é avisado de que a ficha foi aberta. Não precisa de login.";

  return (
    <main className="min-h-screen bg-fundo print:bg-white">
      <header className={emergencia ? "bg-[#A3324F] text-white" : "bg-azul"}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5 lg:px-12">
          <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full bg-white lg:hidden">
            {c.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.foto_url} alt={`Foto de ${c.nome}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl" aria-hidden="true">{c.especie === "gato" ? "🐱" : "🐶"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between">
            <p className="flex items-center gap-3">
              <span className="hidden text-xl font-extrabold tracking-tight lg:inline">PetLive</span>
              <span
                className={`text-[13px] font-extrabold uppercase tracking-wider lg:rounded-full lg:px-3 lg:py-1 lg:text-[12px] ${emergencia ? "text-white/90 lg:bg-white/20" : "text-azul-texto lg:bg-white/60"}`}
              >
                {rotuloFicha}
              </span>
            </p>
            <h1 className="text-3xl font-bold tracking-tight lg:hidden">{c.nome}</h1>
            <p className={`text-[14px] lg:hidden ${emergencia ? "text-white/90" : "text-azul-texto"}`}>{resumo}</p>
            <p className="hidden text-[14px] font-bold lg:block">
              {quando(resposta.criado_em, "Gerada")} · {quando(resposta.expira_em, "válida até").replace("válida até em", "válida até")}
            </p>
          </div>
        </div>
      </header>
      <p className="bg-amarelo-fundo px-5 py-3 text-[14px] font-bold text-amarelo-texto lg:hidden">
        {quando(resposta.criado_em, "Gerada")} pelo tutor · {quando(resposta.expira_em, "válida até").replace("válida até em", "válida até")}
      </p>

      {/* Celular: uma coluna, como no protótipo FichaVista. */}
      <div className="mx-auto max-w-xl space-y-3 px-5 py-4 lg:hidden">
        {cartoes}
        {c.tutor ? (
          <Cartao titulo="Tutor" fundo="bg-azul-fundo">
            {[c.tutor.nome, telefone].filter(Boolean).join(" · ") || "—"}
          </Cartao>
        ) : null}
        <div className="grid gap-2 print:hidden">{acoes}</div>
        <p className="px-2 text-center text-[12px] leading-relaxed text-cinza">{aviso}</p>
      </div>

      {/* Computador da clínica: três colunas, como no protótipo FichaVistaPC. */}
      <div className="mx-auto hidden max-w-6xl grid-cols-[18rem_1fr_18rem] gap-6 px-12 py-8 lg:grid">
        <div>
          <div className="flex aspect-[5/4] items-center justify-center overflow-hidden rounded-[28px] bg-amarelo-fundo">
            {c.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.foto_url} alt={`Foto de ${c.nome}`} className="h-full w-full object-cover" />
            ) : (
              <span className="text-7xl" aria-hidden="true">{c.especie === "gato" ? "🐱" : "🐶"}</span>
            )}
          </div>
          <h1 className="mt-5 text-4xl font-medium tracking-tight">{c.nome}</h1>
          <p className="mt-1 text-[14px] text-cinza">{resumo}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.vacinas !== undefined && vacinas.length > 0 ? (
              <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${emDia ? "bg-verde-fundo text-verde-texto" : "bg-perigo-fundo text-perigo"}`}>
                {emDia ? "Vacinas em dia" : "Vacina vencendo ou atrasada"}
              </span>
            ) : null}
            {c.alergias?.trim() ? (
              <span className="rounded-full bg-[#FCE1E6] px-3 py-1 text-[11px] font-bold text-[#9B2242]">Tem alergia</span>
            ) : null}
          </div>
        </div>
        <div className="grid h-fit grid-cols-2 gap-4">{cartoes}</div>
        <div className="flex flex-col gap-3">
          {c.tutor ? (
            <section className="rounded-[26px] bg-azul-fundo px-6 py-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-azul-escuro">Tutor</h2>
              <p className="mt-1 text-xl font-medium">{c.tutor.nome || "—"}</p>
              {telefone ? <p className="text-[14px]">{telefone}</p> : null}
            </section>
          ) : null}
          <div className="grid gap-3 print:hidden">{acoes}</div>
          <p className="mt-auto pt-10 text-[11px] leading-relaxed text-cinza">{aviso}</p>
        </div>
      </div>
    </main>
  );
}

function Expirada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-fundo px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-amarelo-fundo">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 11h12v9H6z" />
          <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
        </svg>
      </span>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">Este link da ficha expirou</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cinza">
        O prazo do link acabou ou o tutor cancelou o acesso. Por segurança, os dados não ficam abertos.
      </p>
      <p className="mt-6 max-w-md rounded-[24px] bg-suave px-6 py-4 text-left text-[14px] leading-relaxed">
        <strong>O que fazer:</strong> peça ao tutor para enviar um <strong>novo link</strong> pelo PetLive. Se for uma emergência, ligue para ele ou atenda o pet normalmente.
      </p>
      <Link href="/" className="mt-6 flex h-12 items-center rounded-full bg-tinta px-8 text-[15px] font-bold text-white">
        Conhecer o PetLive
      </Link>
    </main>
  );
}
