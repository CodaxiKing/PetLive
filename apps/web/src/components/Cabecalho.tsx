import Link from "next/link";
import { Logo } from "./Logo";

const LINKS = [
  { rotulo: "Recursos", href: "/#recursos" },
  { rotulo: "Como funciona", href: "/#como-funciona" },
  { rotulo: "Para lojistas", href: "/#lojistas" },
  { rotulo: "Perguntas", href: "/#perguntas" },
];

/** Cabeçalho do site (referência: protótipo SitePetLive). */
export function Cabecalho() {
  return (
    <header className="relative z-20 h-[88px] bg-fundo">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 md:px-12 xl:px-[120px]">
        <Logo />

        <nav className="hidden gap-8 text-[15px] font-semibold lg:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:-translate-y-0.5">
              {link.rotulo}
            </Link>
          ))}
        </nav>

        {/* Menu sem JS para telas menores que lg. */}
        <details className="group relative lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-borda px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#111"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            Menu
          </summary>
          <nav className="absolute right-0 top-14 flex w-56 flex-col gap-1 rounded-3xl border border-borda bg-fundo p-3 shadow-lg">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-2.5 text-sm font-semibold hover:bg-suave"
              >
                {link.rotulo}
              </Link>
            ))}
            <Link
              href="/termos"
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-cinza hover:bg-suave"
            >
              Termos de uso
            </Link>
          </nav>
        </details>

        <div className="flex items-center gap-2.5">
          <Link
            href="/#download"
            className="hidden h-12 items-center gap-3 rounded-full bg-tinta pl-6 pr-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 sm:flex"
          >
            Baixar o app
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-azul">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#111"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
