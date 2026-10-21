import Link from "next/link";
import { BotaoPreferenciasCookies } from "./ConsentimentoCookies";
import { Logo } from "./Logo";

const PRODUTO = [
  { rotulo: "Recursos", href: "/#recursos" },
  { rotulo: "Como funciona", href: "/#como-funciona" },
  { rotulo: "Para lojistas", href: "/lojistas" },
  { rotulo: "Perguntas", href: "/#perguntas" },
  { rotulo: "Contato", href: "/contato" },
];

const LEGAL = [
  { rotulo: "Termos de uso", href: "/termos" },
  { rotulo: "Política de privacidade", href: "/privacidade" },
  { rotulo: "Direitos na LGPD", href: "/lgpd" },
];

// Fixo para o build ficar determinístico (new Date() quebra o prerender).
const ANO = 2026;

/** Rodapé do site com os atalhos para as páginas legais. */
export function Rodape() {
  return (
    <footer className="border-t border-borda bg-suave">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-12 xl:px-[120px]">
        <div className="max-w-sm space-y-4">
          <Logo tamanho={36} />
          <p className="text-sm leading-relaxed text-cinza">
            A carteira de saúde do seu pet: vacinas, remédios e consultas em dia,
            lembretes no celular e serviços com horário marcado perto de você.
          </p>
        </div>

        <nav aria-label="Produto">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider">
            Produto
          </h2>
          <ul className="space-y-3 text-sm font-medium text-cinza">
            {PRODUTO.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-tinta">
                  {link.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider">
            Legal
          </h2>
          <ul className="space-y-3 text-sm font-medium text-cinza">
            {LEGAL.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition hover:text-tinta">
                  {link.rotulo}
                </Link>
              </li>
            ))}
            <li>
              <BotaoPreferenciasCookies className="transition hover:text-tinta" />
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-borda">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-6 py-6 text-xs text-cinza md:flex-row md:items-center md:justify-between md:px-12 xl:px-[120px]">
          <p>© {ANO} PetLive. Todos os direitos reservados.</p>
          <p>Feito no Brasil · Português (pt-BR)</p>
        </div>
      </div>
    </footer>
  );
}
