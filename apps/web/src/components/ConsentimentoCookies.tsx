"use client";

import Link from "next/link";
import Script from "next/script";
import { useSyncExternalStore } from "react";

/**
 * Consentimento de cookies e analytics do site (board [WEB] "analytics e
 * consentimento de cookies", LGPD). Nada de medição antes do "Aceitar":
 * o Google Analytics só carrega com NEXT_PUBLIC_GA_ID e consentimento, e
 * começa com o Consent Mode negado. A escolha fica no navegador e pode ser
 * mudada em "Preferências de cookies", no rodapé.
 */
const ID_ANALYTICS = process.env.NEXT_PUBLIC_GA_ID ?? "";
const CHAVE = "petlive-cookies";
const EVENTO = "petlive:cookies";

type Escolha = "aceito" | "recusado" | null;

function lerEscolha(): Escolha {
  try {
    const valor = window.localStorage.getItem(CHAVE);
    return valor === "aceito" || valor === "recusado" ? valor : null;
  } catch {
    return null;
  }
}

function assinar(aoMudar: () => void) {
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

function salvar(escolha: Escolha) {
  try {
    if (escolha) window.localStorage.setItem(CHAVE, escolha);
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // Navegador sem armazenamento: a escolha vale só nesta página.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Reabre o aviso (link "Preferências de cookies" do rodapé). */
export function BotaoPreferenciasCookies({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => salvar(null)} className={className}>
      Preferências de cookies
    </button>
  );
}

export function ConsentimentoCookies() {
  // No servidor não há escolha: o aviso só aparece no navegador.
  const escolha = useSyncExternalStore(assinar, lerEscolha, () => "recusado" as Escolha);

  return (
    <>
      {escolha === "aceito" && ID_ANALYTICS ? (
        <>
          <Script id="consentimento-analytics" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
gtag('consent','update',{analytics_storage:'granted'});
gtag('js',new Date());gtag('config','${ID_ANALYTICS}',{anonymize_ip:true});`}
          </Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ID_ANALYTICS}`} strategy="afterInteractive" />
        </>
      ) : null}

      {escolha === null ? (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Aviso de cookies"
          className="fixed inset-x-3 bottom-3 z-50 rounded-[var(--raio)] border-2 border-[var(--tinta)] bg-[var(--ceu-claro)] p-4 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:p-5"
        >
          <p className="text-[15px] leading-relaxed text-tinta">
            Usamos cookies essenciais e, se você aceitar, cookies de medição. Nada de publicidade. Veja a{" "}
            <Link href="/privacidade" className="font-semibold text-tinta underline">
              política de privacidade
            </Link>
            .
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => salvar("recusado")}
              className="min-h-11 rounded-full bg-[var(--papel)] px-4 text-[15px] font-semibold transition-colors hover:bg-[var(--tom)]"
            >
              Só essenciais
            </button>
            <button type="button" onClick={() => salvar("aceito")} className="botao min-h-11 px-4 text-[15px]">
              Aceitar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
