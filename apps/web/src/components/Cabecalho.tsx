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
    <header className="h-[88px] bg-fundo">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6 md:px-12 xl:px-[120px]">
        <Logo />

        <nav className="hidden gap-8 text-[15px] font-semibold lg:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:-translate-y-0.5">
              {link.rotulo}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/#download"
            className="flex h-12 items-center gap-3 rounded-full bg-tinta pl-6 pr-1.5 text-sm font-semibold text-white transition hover:-translate-y-0.5"
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
