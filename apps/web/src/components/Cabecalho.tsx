import Link from "next/link";
import { Logo } from "./Logo";

const LINKS = [
  { rotulo: "Recursos", href: "/#recursos" },
  { rotulo: "Como começar", href: "/#como-comecar" },
  { rotulo: "Planos", href: "/#planos" },
  { rotulo: "Para lojistas", href: "/lojistas" },
];

/** Cabeçalho do site: uma barra simples com a marca, quatro links e uma ação. */
export function Cabecalho() {
  return (
    <header className="relative z-20 bg-[var(--papel)]">
      <div className="site-moldura flex h-[72px] items-center justify-between gap-3">
        <Logo />

        <nav aria-label="Principal" className="hidden gap-8 text-[16px] font-semibold lg:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="link-sublinhado decoration-transparent hover:decoration-current">
              {link.rotulo}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/#baixar" className="botao hidden min-h-11 px-5 text-[16px] sm:inline-flex">
            Baixar o app
          </Link>

          {/* Menu sem script para telas menores que lg. */}
          <details className="group relative lg:hidden">
            <summary
              aria-label="Abrir menu"
              className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center bg-[var(--tom)] [&::-webkit-details-marker]:hidden"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav
              aria-label="Menu"
              className={"absolute right-0 top-14 flex w-60 flex-col bg-[var(--papel)] p-2 group-open:shadow-[0_18px_40px_rgba(17,17,17,0.18)]" /* taste-skill-ignore: só o menu aberto, que flutua */}
            >
              {[...LINKS, { rotulo: "Baixar o app", href: "/#baixar" }].map((link) => (
                <Link key={link.href} href={link.href} className="px-4 py-3 text-[16px] font-semibold hover:bg-[var(--tom)]">
                  {link.rotulo}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
