import Image from "next/image";
import Link from "next/link";
import { BotaoPreferenciasCookies } from "./ConsentimentoCookies";
import { Foto } from "./site/Foto";
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
  const convite =
    publico === "tutor"
      ? {
          texto: "Tem uma loja ou clínica?",
          frase: "Receba pedidos e reservas dos tutores pelo PetLive.",
          href: "/lojistas",
          foto: { src: "/fotos/consulta.jpg", alt: "Lulu-da-pomerânia sendo examinado na clínica" },
          acao: { rotulo: "Baixar o app", href: "/#baixar" },
        }
      : {
          texto: "Tem um cão ou gato?",
          frase: "A carteira de saúde do pet, com aviso na hora de cada dose.",
          href: "/",
          foto: { src: "/fotos/tutora.jpg", alt: "Tutora sorrindo com o cão no colo, em casa" },
          acao: { rotulo: "Cadastrar loja", href: "/lojistas#cadastro" },
        };
  return (
    <footer className="secao bg-[var(--papel)] p-2 pt-4 md:p-3 md:pt-5">
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

        {/* O nome de volta, grande, com a ação do público desta página. */}
        <div className="relative col-span-2 flex min-h-[220px] flex-col justify-between gap-10 overflow-hidden rounded-[var(--raio)] bg-[var(--tinta)] p-5 text-[var(--papel)] md:col-span-8 md:min-h-[360px] md:p-8">
          <div className="flex items-center justify-between gap-4">
            <Image src="/logo-petlive.png" alt="" width={52} height={52} />
            <Link href={convite.acao.href} className="botao min-h-11 bg-[var(--ceu)] px-5 text-[15px] text-[var(--tinta)] hover:bg-[var(--ceu-claro)]">
              {convite.acao.rotulo}
            </Link>
          </div>
          <p aria-hidden="true" className="font-bold leading-[0.9] tracking-[-0.05em]" style={{ fontSize: "clamp(84px, 15vw, 232px)" }}>
            PetLive
          </p>
        </div>

        {/* Convite ao outro público, com a foto do mundo dele. */}
        <Link
          href={convite.href}
          className="group relative col-span-2 grid min-h-[240px] grid-cols-[1fr_40%] overflow-hidden rounded-[var(--raio)] bg-[var(--ceu)] md:col-span-4 md:min-h-[360px]"
        >
          <span className="flex flex-col justify-between gap-6 p-5 md:p-6">
            <span>
              <span className="block text-[22px] font-bold leading-tight">{convite.texto}</span>
              <span className="t-pequeno mt-3 block">{convite.frase}</span>
            </span>
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tinta)] text-[var(--papel)] transition-transform duration-300 group-hover:translate-x-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </span>
          </span>
          <span className="relative m-2 ml-0 overflow-hidden rounded-[var(--raio-p)]">
            <Foto src={convite.foto.src} alt={convite.foto.alt} fill sizes="(min-width: 768px) 14vw, 40vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
          </span>
        </Link>
      </div>
    </footer>
  );
}
