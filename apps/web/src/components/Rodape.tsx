import Link from "next/link";
import { BotaoPreferenciasCookies } from "./ConsentimentoCookies";
import { HoraRio } from "./site/HoraRio";

const NAVEGACAO = [
  { rotulo: "Recursos", href: "/#recursos" },
  { rotulo: "Como começar", href: "/#como-comecar" },
  { rotulo: "Planos", href: "/#planos" },
  { rotulo: "Perguntas", href: "/#perguntas" },
  { rotulo: "Contato", href: "/contato" },
];

const LEGAL = [
  { rotulo: "Termos de uso", href: "/termos" },
  { rotulo: "Privacidade", href: "/privacidade" },
  { rotulo: "Direitos na LGPD", href: "/lgpd" },
  { rotulo: "Créditos", href: "/creditos" },
];

// Fixo para o build ficar determinístico (new Date() quebra o prerender).
const ANO = 2026;

/**
 * Rodapé: o verso da carteirinha, em blocos que ocupam toda a largura.
 * O bloco azul convida o outro público (tutores ↔ lojistas).
 */
export function Rodape({ publico = "tutor" }: { publico?: "tutor" | "lojista" }) {
  const convite = publico === "tutor" ? { texto: "Tem uma loja ou clínica?", href: "/lojistas" } : { texto: "Tem um cão ou gato?", href: "/" };
  return (
    <footer className="bg-[var(--papel)] p-2 md:p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-12">
        <div className="col-span-2 flex min-h-[200px] flex-col justify-between gap-6 rounded-[var(--raio)] bg-[var(--tom)] p-5 md:col-span-4 md:min-h-[220px] md:p-6">
          <p className="max-w-[26ch] text-[22px] font-semibold leading-snug">
            A carteira de saúde do seu pet, com aviso na hora de cada cuidado.
          </p>
          <div className="t-pequeno space-y-2 text-[var(--apagado)]">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LEGAL.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-[var(--tinta)]">
                    {link.rotulo}
                  </Link>
                </li>
              ))}
              <li>
                <BotaoPreferenciasCookies className="hover:text-[var(--tinta)]" />
              </li>
            </ul>
            <p>© {ANO} PetLive. Fotos de Pexels, créditos completos em Créditos.</p>
          </div>
        </div>

        <nav aria-label="Rodapé" className="rounded-[var(--raio)] bg-[var(--tom)] p-5 md:col-span-3 md:min-h-[220px] md:p-6">
          <ul className="space-y-2 text-[17px] font-semibold">
            {NAVEGACAO.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-sublinhado decoration-transparent hover:decoration-current">
                  {link.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-h-[140px] flex-col justify-between rounded-[var(--raio)] bg-[var(--tom)] p-5 md:col-span-2 md:min-h-[220px] md:p-6">
          <p className="text-[17px] font-semibold">Rio de Janeiro</p>
          <p className="t-pequeno text-[var(--apagado)]">
            <HoraRio />
          </p>
        </div>

        <div className="col-span-2 flex min-h-[120px] flex-col justify-between gap-4 rounded-[var(--raio)] bg-[var(--tom)] p-5 md:col-span-3 md:min-h-[220px] md:p-6">
          <p className="t-pequeno text-[var(--apagado)]">Dúvidas sobre o app</p>
          <a href="mailto:suporte@petlive.app.br" className="link-sublinhado break-all text-[22px] font-semibold">
            suporte@petlive.app.br
          </a>
        </div>

        <div className="col-span-2 flex min-h-[160px] items-center justify-center rounded-[var(--raio)] bg-[var(--tinta)] p-6 text-[var(--papel)] md:col-span-8 md:min-h-[320px]">
          <p className="t-display" aria-hidden="true">
            PetLive
          </p>
        </div>

        <Link
          href={convite.href}
          className="group col-span-2 flex min-h-[160px] flex-col justify-between rounded-[var(--raio)] bg-[var(--ceu)] p-6 md:col-span-4 md:min-h-[320px]"
        >
          <span className="max-w-[14ch] text-[22px] font-bold leading-tight">{convite.texto}</span>
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="square"
            className="self-end transition-transform duration-300 group-hover:translate-x-2"
            aria-hidden="true"
          >
            <path d="M8 32h46M36 14l18 18-18 18" />
          </svg>
        </Link>
      </div>
    </footer>
  );
}
