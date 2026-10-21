import type { Metadata } from "next";

export type SecaoLegal = {
  titulo: string;
  paragrafos?: string[];
  itens?: string[];
};

type Props = {
  titulo: string;
  resumo: string;
  atualizado: string;
  secoes: SecaoLegal[];
};

/** Moldura das páginas legais: título, resumo, data de atualização e seções. */
export function PaginaLegal({ titulo, resumo, atualizado, secoes }: Props) {
  return (
    <div className="bg-fundo">
      <section className="border-b border-borda bg-azul-fundo">
        <div className="mx-auto max-w-[1440px] px-6 py-16 md:px-12 md:py-20 xl:px-[120px]">
          <p className="text-sm font-bold uppercase tracking-widest text-azul-escuro">
            Documento legal
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl">
            {titulo}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cinza">{resumo}</p>
          <p className="mt-6 text-sm font-semibold text-cinza">
            Última atualização: {atualizado}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-6 py-14 md:px-12 xl:px-[120px]">
        <div className="max-w-3xl space-y-12">
          {secoes.map((secao, i) => (
            <section key={secao.titulo}>
              <h2 className="text-2xl font-extrabold">
                <span className="mr-3 text-azul-escuro">{String(i + 1).padStart(2, "0")}</span>
                {secao.titulo}
              </h2>
              {secao.paragrafos?.map((paragrafo) => (
                <p key={paragrafo} className="mt-4 leading-relaxed text-cinza">
                  {paragrafo}
                </p>
              ))}
              {secao.itens && (
                <ul className="mt-4 space-y-3">
                  {secao.itens.map((item) => (
                    <li key={item} className="flex gap-3 leading-relaxed text-cinza">
                      <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-azul" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function metadataDaPagina(titulo: string, description: string): Metadata {
  return { title: titulo, description };
}
