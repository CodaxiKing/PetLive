import type { Metadata } from "next";
import Link from "next/link";
import { BotaoPreferenciasCookies } from "@/components/ConsentimentoCookies";

export const metadata: Metadata = {
  title: "Para lojistas",
  description:
    "Petshops, clínicas e prestadores: vitrine, solicitações, agenda com horários livres e recebimento por Pix no PetLive.",
  alternates: { canonical: "/lojistas" },
};

const LINKS = [
  { rotulo: "Benefícios", href: "#beneficios" },
  { rotulo: "Serviços", href: "#servicos" },
  { rotulo: "Como começar", href: "#como-comecar" },
  { rotulo: "Planos", href: "#planos" },
];

function Pata({ cor = "#9AD6F8" }: { cor?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={cor} aria-hidden="true">
      <circle cx="6" cy="10" r="1.9" />
      <circle cx="10" cy="6" r="1.9" />
      <circle cx="14" cy="6" r="1.9" />
      <circle cx="18" cy="10" r="1.9" />
      <path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
    </svg>
  );
}

/** Página para lojistas (protótipo SiteLojistas): cabeçalho e rodapé próprios, escuros. */
export default function LayoutLojistas({ children }: LayoutProps<"/lojistas">) {
  return (
    <>
      <header className="relative z-20 bg-tinta text-white">
        <div className="mx-auto flex h-[88px] max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 md:px-12 xl:px-[120px]">
          <Link href="/lojistas" className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight" aria-label="PetLive para lojistas">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2A2A2A]">
              <Pata />
            </span>
            PetLive
            <span className="rounded-full bg-azul px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-tinta">LOJISTAS</span>
          </Link>
          <nav className="hidden gap-9 text-[15px] font-semibold text-[#C9D0DB] lg:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="transition hover:text-white">
                {l.rotulo}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/" className="hidden h-12 items-center px-5 text-sm font-semibold text-[#C9D0DB] hover:text-white sm:flex">
              Sou tutor
            </Link>
            <a
              href="#cadastro"
              className="flex h-12 items-center gap-3.5 rounded-full bg-azul pl-6 pr-1.5 text-sm font-bold text-tinta transition hover:-translate-y-0.5"
            >
              Cadastrar minha loja
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tinta">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-tinta text-white">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr] md:px-12 xl:px-[120px]">
          <div className="max-w-sm space-y-3">
            <p className="text-2xl font-extrabold tracking-tight">PetLive</p>
            <p className="text-sm leading-relaxed text-azul">Ferramentas para lojas, clínicas e prestadores de serviços pet.</p>
          </div>
          <nav aria-label="Lojistas" className="space-y-3 text-sm text-[#C9D0DB]">
            <p className="font-extrabold text-white">Lojistas</p>
            <a href="#beneficios" className="block hover:text-white">Benefícios</a>
            <a href="#planos" className="block hover:text-white">Planos</a>
            <a href="#cadastro" className="block hover:text-white">Cadastrar loja</a>
          </nav>
          <nav aria-label="PetLive" className="space-y-3 text-sm text-[#C9D0DB]">
            <p className="font-extrabold text-white">PetLive</p>
            <Link href="/" className="block hover:text-white">Para tutores</Link>
            <Link href="/contato" className="block hover:text-white">Contato</Link>
          </nav>
          <nav aria-label="Legal" className="space-y-3 text-sm text-[#C9D0DB]">
            <p className="font-extrabold text-white">Legal</p>
            <Link href="/termos" className="block hover:text-white">Termos de uso</Link>
            <Link href="/privacidade" className="block hover:text-white">Privacidade e LGPD</Link>
            <BotaoPreferenciasCookies className="block hover:text-white" />
          </nav>
        </div>
      </footer>
    </>
  );
}
