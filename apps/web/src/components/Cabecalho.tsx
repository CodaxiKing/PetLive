import Link from "next/link";
import { Logo } from "./Logo";
import { MenuCelular } from "./MenuCelular";

const LINKS = [
  { rotulo: "Recursos", href: "/#recursos" },
  { rotulo: "Como começar", href: "/#como-comecar" },
  { rotulo: "Planos", href: "/#planos" },
  { rotulo: "Para lojistas", href: "/lojistas" },
];

/** Cabeçalho do site: uma barra simples com a marca, quatro links e uma ação. */
export function Cabecalho() {
  return (
    <header className="relative z-20 bg-[#F2F4F7]">
      <div className="site-moldura flex h-[76px] items-center justify-between gap-3">
        <Logo />

        <nav aria-label="Principal" className="hidden gap-[26px] text-[15px] font-semibold lg:flex">
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

          <MenuCelular links={[...LINKS, { rotulo: "Baixar o app", href: "/#baixar" }]} />
        </div>
      </div>
    </header>
  );
}
