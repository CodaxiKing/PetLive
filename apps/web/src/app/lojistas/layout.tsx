import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ConsentimentoCookies } from "@/components/ConsentimentoCookies";
import { MenuCelular } from "@/components/MenuCelular";
import { Rodape } from "@/components/Rodape";
import { Revelar } from "@/components/site/Revelar";

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

/** Página para lojistas: barra escura simples, o rodapé do site e as entradas das seções. */
export default function LayoutLojistas({ children }: LayoutProps<"/lojistas">) {
  return (
    <>
      <ConsentimentoCookies />
      <header className="relative z-20 bg-[#F2F4F7] text-tinta">
        <div className="site-moldura flex h-[76px] items-center justify-between gap-3">
          <Link href="/lojistas" className="flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight" aria-label="PetLive para lojistas">
            <Image src="/logo-petlive.png" alt="" width={36} height={36} priority />
            <span>
              PetLive <span className="hidden font-semibold text-azul-escuro sm:inline">para lojistas</span>
            </span>
          </Link>
          <nav aria-label="Lojistas" className="hidden gap-8 text-[16px] font-semibold lg:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="link-sublinhado decoration-transparent hover:decoration-current">
                {l.rotulo}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/lojista/entrar" className="hidden min-h-11 items-center px-3 text-[16px] font-semibold md:flex">
              Entrar
            </Link>
            <Link href="/" className="hidden min-h-11 items-center px-3 text-[16px] font-semibold sm:flex">
              Sou tutor
            </Link>
            <a href="#cadastro" className="botao min-h-11 bg-[var(--ceu)] px-4 sm:px-5 text-[16px] text-[var(--tinta)] hover:bg-[var(--ceu-claro)]">
              Cadastrar loja
            </a>
            <div className="text-[var(--tinta)]">
              <MenuCelular
                links={[...LINKS, { rotulo: "Entrar no painel", href: "/lojista/entrar" }, { rotulo: "Sou tutor", href: "/" }]}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>
      <Rodape publico="lojista" />
      <Revelar />
    </>
  );
}
