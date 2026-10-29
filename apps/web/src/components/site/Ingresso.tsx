import type { ReactNode } from "react";

/**
 * Ingresso de plano: parte principal e canhoto, separados por picote, com
 * entalhes na cor do fundo da seção (que precisa ser a tinta).
 */
export function Ingresso({
  titulo,
  linhas,
  preco,
  acao,
}: {
  titulo: string;
  linhas: string[];
  preco: string;
  acao: ReactNode;
}) {
  return (
    <div data-revelar className="relative grid w-full rounded-[var(--raio-g)] bg-[var(--papel)] md:min-h-[320px] md:grid-cols-[7fr_3fr]">
      <div className="flex flex-col justify-between gap-8 p-7 md:p-10">
        <h3 className="t-titulo max-w-[16ch]">{titulo}</h3>
        <ul className="grid gap-x-8 gap-y-2 text-[17px] sm:grid-cols-2">
          {linhas.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[var(--tinta)]" />
              {l}
            </li>
          ))}
        </ul>
      </div>
      <div className="relative order-first flex flex-col items-center justify-center gap-6 border-b-[6px] border-dotted border-[var(--tinta)] p-7 md:order-none md:border-b-0 md:border-l-[6px]">
        <p className="t-titulo text-center tabular-nums">{preco}</p>
        {acao}
      </div>
      {/* Entalhes onde as duas partes se encontram. */}
      <span aria-hidden="true" className="absolute hidden h-7 w-7 rounded-full bg-[var(--tinta)] md:left-[70%] md:top-0 md:block md:-translate-x-1/2 md:-translate-y-1/2" />
      <span aria-hidden="true" className="absolute hidden h-7 w-7 rounded-full bg-[var(--tinta)] md:bottom-0 md:left-[70%] md:block md:-translate-x-1/2 md:translate-y-1/2" />
    </div>
  );
}
