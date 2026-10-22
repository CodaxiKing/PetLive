"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Mascote } from "@/components/Mascote";

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CHAVE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type PetQR = {
  nome: string;
  especie: "cao" | "gato";
  foto_url: string | null;
  raca?: string | null;
  alergias?: string | null;
};
type TutorQR = {
  nome: string | null;
  telefone: string | null;
  cidade?: string | null;
};
type RespostaQR =
  | { valido: false }
  | {
      valido: true;
      pet: PetQR;
      tutor: TutorQR;
      permitir_localizacao_finder: boolean;
    };

type EstadoLocalizacao =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success" }
  | { status: "error"; mensagem: string };

function IconeLocalizacao({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function IconeCheck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconeAlerta({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  );
}

function IconeTelefone({ className = "h-5 w-5" }: { className?: string }) {
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

const digitos = (telefone: string) => telefone.replace(/\D/g, "");
const paraWhatsApp = (telefone: string) => (digitos(telefone).length <= 11 ? `55${digitos(telefone)}` : digitos(telefone));

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
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>,
};

function BotaoEnviarLocalizacao({
  estadoLocalizacao,
  permitirLocalizacao,
  onClick,
}: {
  estadoLocalizacao: EstadoLocalizacao;
  permitirLocalizacao: boolean;
  onClick: () => void;
}) {
  if (!permitirLocalizacao) return null;

  const desabilitado = estadoLocalizacao.status === "loading" || estadoLocalizacao.status === "success";

  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      aria-label={estadoLocalizacao.status === "success" ? "Localização já enviada" : "Enviar minha localização para o tutor"}
      aria-busy={estadoLocalizacao.status === "loading"}
      aria-disabled={desabilitado}
      className={`
        flex w-full items-center justify-center gap-2 rounded-full bg-azul px-6 py-3 text-[16px] font-bold text-white
        transition-colors focus:outline-none focus:ring-2 focus:ring-azul focus:ring-offset-2
        ${desabilitado ? "opacity-60 cursor-not-allowed" : "hover:bg-azul-escuro active:bg-azul-escuro"}
      `}
    >
      {estadoLocalizacao.status === "loading" ? (
        <>
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Obtendo localização…
        </>
      ) : estadoLocalizacao.status === "success" ? (
        <>
          <IconeCheck className="h-5 w-5" />
          Localização enviada ✓
        </>
      ) : (
        <>
          <IconeLocalizacao />
          Enviar minha localização
        </>
      )}
    </button>
  );
}

export default function Encontrado() {
  const { codigo } = useParams<{ codigo: string }>();
  const [resposta, setResposta] = useState<RespostaQR | null>(null);
  const [estadoLocalizacao, setEstadoLocalizacao] = useState<EstadoLocalizacao>({ status: "idle" });
  const [toast, setToast] = useState<{ mensagem: string; tipo: "sucesso" | "erro" } | null>(null);

  useEffect(() => {
    const pedido: Promise<RespostaQR> =
      URL_SUPABASE && CHAVE_ANON
        ? fetch(`${URL_SUPABASE}/rest/v1/rpc/public_qr`, {
            method: "POST",
            headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
            body: JSON.stringify({ p_codigo: codigo }),
          }).then((r) => (r.ok ? r.json() : { valido: false }))
        : Promise.resolve({ valido: false });
    pedido.then(
      (r) => setResposta(r),
      () => setResposta({ valido: false }),
    );
  }, [codigo]);

  if (!resposta) {
    return <main className="flex min-h-screen items-center justify-center bg-suave text-sm text-cinza">Abrindo a página do QR…</main>;
  }
  if (!resposta.valido) return <Expirado />;

  const pet = resposta.pet;
  const tutor = resposta.tutor;
  const especie = pet.especie === "gato" ? "Gato" : "Cão";
  const linhaRaca = [especie, pet.raca].filter(Boolean).join(" · ");
  const telefone = tutor.telefone?.trim() || null;
  const temWhats = Boolean(telefone);

  const mensagemWhats = encodeURIComponent(
    `Olá! Encontrei o ${pet.nome} pelo QR da coleira do PetLive.`
  );

  const acoesTelefone = telefone ? (
    <>
      <a
        href={`tel:${digitos(telefone)}`}
        className="flex h-14 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-tinta px-5 text-[15px] font-bold text-white"
      >
        <IconeTelefone />
        Ligar para {tutor.nome?.split(" ")[0] ?? "o tutor"}
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

  const handleEnviarLocalizacao = async () => {
    if (!("geolocation" in navigator)) {
      setToast({ mensagem: "Seu navegador não suporta geolocalização.", tipo: "erro" });
      return;
    }

    setEstadoLocalizacao({ status: "loading" });
    setToast(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      const resp = await fetch(`${URL_SUPABASE}/rest/v1/rpc/qr_location`, {
        method: "POST",
        headers: { apikey: CHAVE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ p_codigo: codigo, p_lat: latitude, p_lng: longitude }),
      });

      const data = await resp.json();

      if (data.sucesso) {
        setEstadoLocalizacao({ status: "success" });
        setToast({ mensagem: "Tutor avisado com sua localização ✓", tipo: "sucesso" });
      } else {
        setEstadoLocalizacao({ status: "error", mensagem: data.erro ?? "Erro ao enviar localização." });
        setToast({ mensagem: data.erro ?? "Erro ao enviar localização. Tente novamente.", tipo: "erro" });
      }
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setEstadoLocalizacao({ status: "error", mensagem: "Permissão de localização negada." });
          setToast({ mensagem: "Não foi possível obter sua localização. Verifique as permissões do navegador.", tipo: "erro" });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setEstadoLocalizacao({ status: "error", mensagem: "Localização indisponível." });
          setToast({ mensagem: "Não foi possível obter sua localização no momento. Tente novamente.", tipo: "erro" });
        } else if (err.code === err.TIMEOUT) {
          setEstadoLocalizacao({ status: "error", mensagem: "Tempo esgotado ao obter localização." });
          setToast({ mensagem: "Demorou muito para obter a localização. Tente novamente.", tipo: "erro" });
        } else {
          setEstadoLocalizacao({ status: "error", mensagem: "Erro desconhecido." });
          setToast({ mensagem: "Erro ao obter localização. Tente novamente.", tipo: "erro" });
        }
      } else {
        setEstadoLocalizacao({ status: "error", mensagem: "Erro de rede." });
        setToast({ mensagem: "Erro de conexão. Tente novamente em instantes.", tipo: "erro" });
      }
    }
  };

  const corTopo = "bg-azul text-tinta";

  return (
    <main className="min-h-screen bg-suave pb-28 print:bg-white print:pb-0 lg:pb-12">
      {/* Faixa do topo: marca e tipo da página. */}
      <header className={corTopo}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-5 py-3 lg:px-8">
          <p className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight">PetLive</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
              Pet encontrado
            </span>
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-5 lg:grid-cols-[22rem_1fr] lg:px-8 lg:pt-8">
        {/* Coluna do pet: identidade e contatos. */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="overflow-hidden rounded-[30px] bg-fundo text-center shadow-sm">
            <div className="bg-azul-fundo flex justify-center pb-4 pt-6">
              <div className="h-36 w-36 overflow-hidden rounded-full border-4 border-white bg-white shadow">
                {pet.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pet.foto_url} alt={`Foto de ${pet.nome}`} className="h-full w-full object-cover" />
                ) : (
                  <Mascote especie={pet.especie} className="h-full w-full" />
                )}
              </div>
            </div>
            <div className="px-5 pb-5 pt-3">
              <h1 className="text-4xl font-bold tracking-tight">{pet.nome}</h1>
              <p className="mt-1 text-[15px] text-cinza">{linhaRaca}</p>
              {pet.alergias?.trim() && (
                <Secao titulo="Alergias e condições" icone={I.alerta} fundo="bg-[#FCE1E6]">
                  <p className="text-[17px] font-semibold text-[#7A1B36]">{pet.alergias}</p>
                </Secao>
              )}
            </div>
          </section>

          {tutor.nome && (
            <section className="rounded-[26px] bg-fundo p-5 shadow-sm">
              <h2 className="text-[13px] font-bold uppercase tracking-wider text-[#5E6878]">Contato do tutor</h2>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-cinza">Tutor</p>
                    <p className="truncate text-[17px] font-bold">{tutor.nome}</p>
                    {tutor.cidade && <p className="text-[14px] text-cinza">{tutor.cidade}</p>}
                  </div>
                  {telefone ? (
                    <a href={`tel:${digitos(telefone)}`} aria-label={`Ligar para ${tutor.nome}`} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-tinta text-white print:hidden">
                      <IconeTelefone className="h-5 w-5" />
                    </a>
                  ) : null}
                </div>
              </div>
              {acoesTelefone ? (
                <div className="mt-4 hidden gap-2 print:hidden lg:flex">{acoesTelefone}</div>
              ) : (
                <p className="mt-3 text-[14px] text-cinza">O tutor não liberou o telefone para contato direto.</p>
              )}
            </section>
          )}

          {/* Botão de enviar localização — só aparece se o tutor autorizou. */}
          {resposta.permitir_localizacao_finder && (
            <section className="rounded-[26px] border-2 border-azul/30 bg-azul-fundo/50 p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-azul-escuro">
                <IconeLocalizacao className="h-4 w-4" />
                Encontrou este pet?
              </h2>
              <p className="mt-2 text-[14px] text-cinza">
                Toque no botão abaixo para enviar sua localização ao tutor. Seu telefone <strong>não</strong> será revelado.
              </p>
              <div className="mt-4">
                <BotaoEnviarLocalizacao
                  estadoLocalizacao={estadoLocalizacao}
                  permitirLocalizacao={resposta.permitir_localizacao_finder}
                  onClick={handleEnviarLocalizacao}
                />
              </div>
              {estadoLocalizacao.status === "error" && (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-perigo" role="alert">
                  <IconeAlerta />
                  {estadoLocalizacao.mensagem}
                </p>
              )}
            </section>
          )}

          <button
            onClick={() => window.print()}
            className="hidden h-12 w-full items-center justify-center rounded-full border border-borda bg-fundo text-[14px] font-bold print:hidden lg:flex"
          >
            Imprimir ou salvar em PDF
          </button>
        </aside>

        {/* Informações adicionais. */}
        <div className="space-y-4">
          <Secao titulo="Sobre esta página" icone={I.info}>
            <ul className="space-y-2 text-[14px] text-cinza">
              <li>Esta é a página pública do QR da coleira do <strong>{pet.nome}</strong>.</li>
              <li>Só são mostradas as informações que o tutor autorizou.</li>
              <li>Se você encontrou o pet, use o botão &ldquo;Enviar minha localização&rdquo; (se disponível) ou ligue para o tutor.</li>
              <li>O tutor será avisado imediatamente quando a localização for enviada.</li>
            </ul>
          </Secao>

          <p className="px-2 text-center text-[12px] leading-relaxed text-cinza">
            Página pública do QR, pelo PetLive. <Link href="/" className="font-semibold underline">Conheça o PetLive</Link>
          </p>
          <button onClick={() => window.print()} className="mx-auto text-[13px] font-bold underline print:hidden md:col-span-2 lg:hidden">
            Imprimir ou salvar em PDF
          </button>
        </div>
      </div>

      {/* Celular: ações de telefone sempre à mão. */}
      {acoesTelefone ? (
        <div className="fixed inset-x-0 bottom-0 flex gap-2 border-t border-borda bg-fundo/95 px-4 py-3 backdrop-blur print:hidden lg:hidden">
          {acoesTelefone}
        </div>
      ) : null}

      {/* Toast global. */}
      {toast && (
        <div
          className={`
            fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full px-5 py-3 text-[14px] font-semibold shadow-lg
            animate-in fade-in slide-up-2
            ${toast.tipo === "sucesso" ? "bg-verde-texto text-white" : "bg-perigo text-white"}
          `}
          role="status"
          aria-live="polite"
        >
          {toast.tipo === "sucesso" ? <IconeCheck className="h-5 w-5" /> : <IconeAlerta className="h-5 w-5" />}
          {toast.mensagem}
        </div>
      )}
    </main>
  );
}

function Expirado() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-suave px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-amarelo-fundo">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 11h12v9H6z" />
          <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
        </svg>
      </span>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">QR não encontrado</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cinza">
        Este QR não existe, foi desativado ou o link está incorreto.
      </p>
      <p className="mt-6 max-w-md rounded-[24px] bg-fundo px-6 py-4 text-left text-[14px] leading-relaxed">
        <strong>O que fazer:</strong> se você encontrou um pet com coleira do PetLive, tente escanear o QR novamente.
        Se o problema persistir, o tutor pode ter desativado o QR.
      </p>
      <Link href="/" className="mt-6 flex h-12 items-center rounded-full bg-tinta px-8 text-[15px] font-bold text-white">
        Conhecer o PetLive
      </Link>
    </main>
  );
}