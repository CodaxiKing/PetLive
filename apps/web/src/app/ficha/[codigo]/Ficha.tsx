"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Mascote } from "@/components/Mascote";
import { FalhaLinkPublico } from "@/components/FalhaLinkPublico";

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
  tutor?: {
    nome: string | null;
    telefone: string | null;
    whatsapp?: boolean | null;
    cidade?: string | null;
    emergencia_nome?: string | null;
    emergencia_telefone?: string | null;
  };
};
type Resposta =
  | { valido: false }
  | { valido: true; tipo?: "carteirinha" | "emergencia"; conteudo: Conteudo; secoes: string[]; criado_em: string; expira_em: string };

/** "12/03/26" a partir de "2026-03-12". */
function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a.slice(2)}`;
}

function idade(nascimento: string | null | undefined, agora: number): string | null {
  if (!nascimento) return null;
  const n = new Date(`${nascimento}T12:00:00`);
  const hoje = new Date(agora);
  let meses = (hoje.getFullYear() - n.getFullYear()) * 12 + hoje.getMonth() - n.getMonth();
  if (hoje.getDate() < n.getDate()) meses -= 1;
  if (meses < 12) return `${Math.max(meses, 0)} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"}`;
}

type Situacao = { texto: string; tom: "ok" | "atencao" | "atrasada" };

function situacao(proxima: string | null, agora: number): Situacao {
  if (!proxima) return { texto: "Dose única", tom: "ok" };
  const hoje = new Date(agora);
  hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((new Date(`${proxima}T00:00:00`).getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return { texto: `Atrasada desde ${data(proxima)}`, tom: "atrasada" };
  if (dias <= 30) return { texto: dias === 0 ? "Vence hoje" : `Vence em ${dias} ${dias === 1 ? "dia" : "dias"}`, tom: "atencao" };
  return { texto: `Em dia até ${data(proxima)}`, tom: "ok" };
}

const TOM: Record<Situacao["tom"], string> = {
  ok: "bg-verde-fundo text-verde-texto",
  atencao: "bg-amarelo-fundo text-amarelo-texto",
  atrasada: "bg-perigo-fundo text-perigo",
};

/** "Gerada hoje às 14:32", "Válida até amanhã às 14:32", "Válida até 24/10 às 08:00". */
function quando(iso: string, verbo: string, agora: number): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date(agora);
  const amanha = new Date(agora + 86_400_000);
  const ontem = new Date(agora - 86_400_000);
  const dia =
    d.toDateString() === hoje.toDateString()
      ? "hoje"
      : d.toDateString() === amanha.toDateString()
        ? "amanhã"
        : d.toDateString() === ontem.toDateString()
          ? "ontem"
          : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${verbo} ${dia} às ${hora}`;
}

const digitos = (telefone: string) => telefone.replace(/\D/g, "");
const paraWhatsApp = (telefone: string) => (digitos(telefone).length <= 11 ? `55${digitos(telefone)}` : digitos(telefone));
/** Telefone escrito no meio de um texto (ex.: o veterinário habitual). */
const telefoneNoTexto = (texto: string) => texto.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/)?.[0] ?? null;

function IconeLigar({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function IconeWhatsApp({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.7z" />
      <path d="M9.5 9.5c.3 1.6 1.4 3 3 3.8l.9-.9 1.6.7-.3 1.4c-2.8.1-5.6-2.6-5.6-5.4l1.4-.3.7 1.6z" />
    </svg>
  );
}

function Secao({ titulo, icone, fundo = "bg-fundo", children }: { titulo: string; icone: ReactNode; fundo?: string; children: ReactNode }) {
  return (
    <section className={`break-inside-avoid rounded-[26px] border border-borda/60 p-5 ${fundo}`}>
      <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[#5E6878]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-tinta shadow-sm" aria-hidden="true">
          {icone}
        </span>
        {titulo}
      </h2>
      <div className="mt-3 text-[15px] leading-snug">{children}</div>
    </section>
  );
}

const I = {
  alerta: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>,
  remedio: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="9" width="18" height="6" rx="3" /><path d="M12 9v6" /></svg>,
  vacina: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M18 3l3 3M16 5l3 3-9 9H7v-3z" /><path d="M5 19l2-2" /></svg>,
  peso: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M9 9h6" /></svg>,
  cruz: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M12 5v14M5 12h14" /></svg>,
  nota: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M6 4h12v16H6z" /><path d="M9 9h6M9 13h6" /></svg>,
  pessoa: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></svg>,
};

/**
 * Carteirinha e ficha de emergência por link (protótipos FichaVista,
 * FichaVistaPC e FichaExpirada): página pública, sem login, só com o que o
 * tutor escolheu. No celular, ligar e WhatsApp ficam fixos embaixo. Link
 * vencido ou cancelado não mostra nenhum dado do pet.
 */
export default function Ficha() {
  const { codigo } = useParams<{ codigo: string }>();
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const [falhaRede, setFalhaRede] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  // Hora da leitura: base de "vence em 5 dias" e da idade.
  const [agora, setAgora] = useState(0);

  useEffect(() => {
    const pedido: Promise<Resposta> = Promise.resolve().then(() => {
      if (!URL_SUPABASE || !CHAVE_ANON) throw new Error("Supabase não configurado.");
      return fetch(`${URL_SUPABASE}/rest/v1/rpc/carteirinha_publica`, {
        method: "POST",
        headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ p_codigo: codigo }),
      }).then((r) => {
        if (!r.ok) throw new Error("A consulta do link falhou.");
        return r.json() as Promise<Resposta>;
      });
    });
    pedido.then(
      (r) => {
        setResposta(r);
        setFalhaRede(false);
        setAgora(Date.now());
      },
      () => {
        setResposta(null);
        setFalhaRede(true);
      },
    );
  }, [codigo, tentativa]);

  if (falhaRede) {
    return (
      <FalhaLinkPublico
        onRetry={() => {
          setFalhaRede(false);
          setResposta(null);
          // A mudança do estado reinicia a tela; a leitura é acionada pelo efeito abaixo.
          setTentativa((n) => n + 1);
        }}
      />
    );
  }
  if (!resposta) {
    return <main className="flex min-h-screen items-center justify-center bg-suave text-sm text-cinza">Abrindo a carteirinha…</main>;
  }
  if (!resposta.valido) return <Expirada />;

  const c = resposta.conteudo;
  const emergencia = resposta.tipo === "emergencia";
  const especie = c.especie === "gato" ? "Gato" : "Cão";
  const sexo = c.sexo ? (c.sexo === "femea" ? "Fêmea" : "Macho") : null;
  const castrado = c.castrado === true ? (c.sexo === "femea" ? "castrada" : "castrado") : c.castrado === false ? (c.sexo === "femea" ? "não castrada" : "não castrado") : null;
  const linhaRaca = [especie, c.raca].filter(Boolean).join(" · ");
  const fichas = [
    idade(c.nascimento, agora),
    c.peso ? `${String(c.peso).replace(".", ",")} kg` : null,
    [sexo, castrado].filter(Boolean).join(", ") || null,
  ].filter(Boolean) as string[];

  const vacinas = c.vacinas ?? [];
  const situacoes = vacinas.map((v) => situacao(v.proxima_dose, agora));
  const atrasadas = situacoes.filter((s) => s.tom === "atrasada").length;
  const telefone = c.tutor?.telefone?.trim() || null;
  const temWhats = Boolean(telefone && c.tutor?.whatsapp !== false);
  const emergenciaTel = c.tutor?.emergencia_telefone?.trim() || null;
  const telVet = c.veterinario ? telefoneNoTexto(c.veterinario) : null;
  const remedios = c.remedios ?? [];

  const resumo: { texto: string; tom: string }[] = [];
  if (c.alergias?.trim()) resumo.push({ texto: "Tem alergia", tom: "bg-[#FCE1E6] text-[#9B2242]" });
  if (c.vacinas !== undefined && vacinas.length) {
    resumo.push(
      atrasadas
        ? { texto: `${atrasadas} ${atrasadas === 1 ? "vacina atrasada" : "vacinas atrasadas"}`, tom: TOM.atrasada }
        : { texto: "Vacinas em dia", tom: TOM.ok },
    );
  }
  if (remedios.length) resumo.push({ texto: `Usa ${remedios.length} ${remedios.length === 1 ? "remédio" : "remédios"}`, tom: TOM.atencao });

  const corTopo = emergencia ? "bg-[#A3324F] text-white" : "bg-azul text-tinta";
  const mensagemWhats = encodeURIComponent(`Olá! Abri a ${emergencia ? "ficha de emergência" : "carteirinha"} de ${c.nome} pelo PetLive.`);

  const acoes = telefone ? (
    <>
      <a href={`tel:${digitos(telefone)}`} className="flex h-14 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-tinta px-5 text-[15px] font-bold text-white">
        <IconeLigar />
        Ligar para {c.tutor?.nome?.split(" ")[0] ?? "o tutor"}
      </a>
      {temWhats ? (
        <a
          href={`https://wa.me/${paraWhatsApp(telefone)}?text=${mensagemWhats}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Chamar no WhatsApp"
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-[15px] font-bold text-white"
        >
          <IconeWhatsApp />
          <span className="hidden sm:inline lg:hidden xl:inline">WhatsApp</span>
        </a>
      ) : null}
    </>
  ) : null;

  return (
    <main className="min-h-screen bg-suave pb-28 print:bg-white print:pb-0 lg:pb-12">
      {/* Faixa do topo: marca, o tipo do link e a validade. */}
      <header className={corTopo}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-3 lg:px-8">
          <p className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight">PetLive</span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${emergencia ? "bg-white/20" : "bg-white/60"}`}>
              {emergencia ? "Ficha de emergência" : "Carteirinha do pet"}
            </span>
          </p>
          <p className="text-[12px] font-semibold opacity-90">{quando(resposta.expira_em, "Válida até", agora)}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-5 lg:grid-cols-[22rem_1fr] lg:px-8 lg:pt-8">
        {/* Coluna do pet: identidade, resumo e contatos (fixa no computador). */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="overflow-hidden rounded-[30px] bg-fundo text-center shadow-sm">
            <div className={`flex justify-center pb-4 pt-6 ${emergencia ? "bg-[#FDE0E6]" : "bg-azul-fundo"}`}>
              <div className="h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-white shadow">
                {c.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.foto_url} alt={`Foto de ${c.nome}`} className="h-full w-full object-cover" />
                ) : (
                  <Mascote especie={c.especie} className="h-full w-full" />
                )}
              </div>
            </div>
            <div className="px-5 pb-5 pt-3">
              <h1 className="text-4xl font-bold tracking-tight">{c.nome}</h1>
              <p className="mt-1 text-[15px] text-cinza">{linhaRaca}</p>
              {fichas.length ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {fichas.map((f) => (
                    <span key={f} className="rounded-full bg-suave px-3 py-1.5 text-[13px] font-semibold">{f}</span>
                  ))}
                </div>
              ) : null}
              {resumo.length ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {resumo.map((r) => (
                    <span key={r.texto} className={`rounded-full px-3 py-1 text-[12px] font-bold ${r.tom}`}>{r.texto}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          {c.tutor ? (
            <section className="rounded-[26px] bg-fundo p-5 shadow-sm">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#5E6878]">Contatos</h2>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-cinza">Tutor</p>
                    <p className="truncate text-[17px] font-bold">{c.tutor.nome ?? "—"}</p>
                    <p className="text-[14px] text-cinza">{[telefone, c.tutor.cidade].filter(Boolean).join(" · ") || "Sem telefone informado"}</p>
                  </div>
                  {telefone ? (
                    <a href={`tel:${digitos(telefone)}`} aria-label="Ligar para o tutor" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tinta text-white print:hidden">
                      <IconeLigar className="h-5 w-5" />
                    </a>
                  ) : null}
                </div>
                {c.tutor.emergencia_nome || emergenciaTel ? (
                  <div className="flex items-center justify-between gap-3 border-t border-borda pt-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-cinza">Se não atender</p>
                      <p className="truncate text-[16px] font-bold">{c.tutor.emergencia_nome ?? "Contato de emergência"}</p>
                      {emergenciaTel ? <p className="text-[14px] text-cinza">{emergenciaTel}</p> : null}
                    </div>
                    {emergenciaTel ? (
                      <a href={`tel:${digitos(emergenciaTel)}`} aria-label="Ligar para o contato de emergência" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-suave print:hidden">
                        <IconeLigar className="h-5 w-5" />
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {acoes ? <div className="mt-4 hidden gap-2 print:hidden lg:flex">{acoes}</div> : null}
            </section>
          ) : null}

          <button
            onClick={() => window.print()}
            className="hidden h-12 w-full items-center justify-center rounded-full border border-borda bg-fundo text-[14px] font-bold print:hidden lg:flex"
          >
            Imprimir ou salvar em PDF
          </button>
        </aside>

        {/* Seções escolhidas pelo tutor. */}
        <div className="grid h-fit gap-4 md:grid-cols-2">
          {c.alergias !== undefined ? (
            <div className="md:col-span-2">
              <Secao titulo="Alergias e condições" icone={I.alerta} fundo={c.alergias?.trim() ? "bg-[#FCE1E6]" : "bg-fundo"}>
                <p className={c.alergias?.trim() ? "text-[17px] font-semibold text-[#7A1B36]" : "text-cinza"}>
                  {c.alergias?.trim() || "Nenhuma informada pelo tutor"}
                </p>
              </Secao>
            </div>
          ) : null}

          {c.remedios !== undefined ? (
            <div className="md:col-span-2">
              <Secao titulo="Remédios em uso" icone={I.remedio}>
                {remedios.length === 0 ? (
                  <p className="text-cinza">Nenhum remédio em uso</p>
                ) : (
                  <ul className="divide-y divide-borda">
                    {remedios.map((r) => (
                      <li key={r.nome} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                        <div>
                          <p className="font-bold">{r.nome}</p>
                          <p className="text-[14px] text-cinza">{[r.dose, r.frequencia].filter(Boolean).join(" · ")}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {(r.horarios ?? []).map((h) => (
                            <span key={h} className="rounded-full bg-amarelo-fundo px-2.5 py-1 text-[12px] font-bold text-amarelo-texto">{h.slice(0, 5)}</span>
                          ))}
                          {r.fim ? <span className="rounded-full bg-suave px-2.5 py-1 text-[12px] font-semibold text-cinza">até {data(r.fim)}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </div>
          ) : null}

          {c.vacinas !== undefined ? (
            <div className="md:col-span-2">
              <Secao titulo="Vacinas" icone={I.vacina}>
                {vacinas.length === 0 ? (
                  <p className="text-cinza">Nenhuma vacina registrada</p>
                ) : (
                  <ul className="divide-y divide-borda">
                    {vacinas.map((v, i) => (
                      <li key={`${v.nome}-${i}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="font-bold">{v.nome}</p>
                          <p className="text-[13px] text-cinza">Aplicada em {data(v.aplicada_em)}</p>
                        </div>
                        <span className={`flex-none rounded-full px-3 py-1 text-[12px] font-bold ${TOM[situacoes[i].tom]}`}>{situacoes[i].texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </div>
          ) : null}

          {c.vermifugos !== undefined || c.peso_em !== undefined ? (
            <Secao titulo="Vermífugo e peso" icone={I.peso}>
              {c.vermifugos !== undefined ? (
                <p>
                  {c.vermifugos.length === 0 ? (
                    <span className="text-cinza">Vermífugo não registrado</span>
                  ) : (
                    <>
                      Vermífugo em <strong>{data(c.vermifugos[0].aplicado_em)}</strong>
                      {c.vermifugos[0].produto ? ` (${c.vermifugos[0].produto})` : ""}
                    </>
                  )}
                </p>
              ) : null}
              {c.peso ? (
                <p className="mt-1">
                  <strong>{String(c.peso).replace(".", ",")} kg</strong>
                  {c.peso_em ? <span className="text-cinza">, medido em {data(c.peso_em)}</span> : null}
                </p>
              ) : null}
            </Secao>
          ) : null}

          {c.veterinario !== undefined ? (
            <Secao titulo="Veterinário habitual" icone={I.cruz}>
              <p>{c.veterinario?.trim() || <span className="text-cinza">Não informado</span>}</p>
              {telVet ? (
                <a href={`tel:${digitos(telVet)}`} className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-bold text-azul-escuro underline print:hidden">
                  <IconeLigar className="h-4 w-4" />
                  Ligar para o veterinário
                </a>
              ) : null}
            </Secao>
          ) : null}

          {c.castrado !== undefined ? (
            <Secao titulo="Saúde e cuidados" icone={I.pessoa}>
              <p>Castrado: {c.castrado === null ? "não informado" : c.castrado ? "sim" : "não"}</p>
            </Secao>
          ) : null}

          {c.observacoes !== undefined ? (
            <div className="md:col-span-2">
              <Secao titulo="Observações do tutor" icone={I.nota}>
                <p className="whitespace-pre-line">{c.observacoes?.trim() || <span className="text-cinza">Nenhuma</span>}</p>
              </Secao>
            </div>
          ) : null}

          <p className="px-2 text-center text-[12px] leading-relaxed text-cinza md:col-span-2">
            Informações do tutor, pelo PetLive. {quando(resposta.criado_em, "Gerada", agora)}. Confirme com ele: não substituem o histórico da clínica.
            {emergencia ? " O tutor é avisado de que a ficha foi aberta." : ""}{" "}
            <Link href="/" className="font-semibold underline">Conheça o PetLive</Link>
          </p>
          <button onClick={() => window.print()} className="mx-auto text-[13px] font-bold underline print:hidden md:col-span-2 lg:hidden">
            Imprimir ou salvar em PDF
          </button>
        </div>
      </div>

      {/* Celular: ligar e WhatsApp sempre à mão. */}
      {acoes ? (
        <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t border-borda bg-fundo/95 px-4 py-3 backdrop-blur print:hidden lg:hidden">{acoes}</div>
      ) : null}
    </main>
  );
}

function Expirada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-suave px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-amarelo-fundo">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 11h12v9H6z" />
          <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
        </svg>
      </span>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">Este link expirou</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cinza">
        O prazo do link acabou ou o tutor cancelou o acesso. Por segurança, os dados do pet não ficam abertos.
      </p>
      <p className="mt-6 max-w-md rounded-[24px] bg-fundo px-6 py-4 text-left text-[14px] leading-relaxed">
        <strong>O que fazer:</strong> peça ao tutor para enviar um <strong>novo link</strong> pelo PetLive. Se for uma emergência, ligue para ele ou atenda o pet normalmente.
      </p>
      <Link href="/" className="mt-6 flex h-12 items-center rounded-full bg-tinta px-8 text-[15px] font-bold text-white">
        Conhecer o PetLive
      </Link>
    </main>
  );
}
