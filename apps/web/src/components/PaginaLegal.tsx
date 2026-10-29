import type { Metadata } from "next";
import { Foto } from "@/components/site/Foto";

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
  /** Foto da faixa do título (de public/fotos). */
  foto?: { src: string; alt: string };
};

const FOTO_PADRAO = { src: "/fotos/gato-janela.jpg", alt: "Gatinho laranja sentado junto à janela" };

/**
 * Moldura das páginas legais: o título sobre o azul da marca e o texto
 * numa folha de papel, com um índice das seções ao lado no computador.
 */
export function PaginaLegal({ titulo, resumo, atualizado, secoes, foto = FOTO_PADRAO }: Props) {
  const ancora = (t: string) =>
    t
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  return (
    <div className="bg-[var(--ceu)]">
      <section className="site-moldura grid items-end gap-8 py-[clamp(48px,6vw,96px)] lg:grid-cols-12">
        <div className="lg:col-span-6">
          <h1 data-revelar className="t-display max-w-[12ch]" style={{ fontSize: "clamp(44px, 5.4vw, 84px)" }}>
            {titulo}
          </h1>
          <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-8 max-w-[40ch]">
            {resumo}
          </p>
          <p data-revelar style={{ ["--ordem" as string]: 2 }} className="t-pequeno mt-4 font-semibold">
            Última atualização: {atualizado}
          </p>
        </div>
        <figure data-revelar style={{ ["--ordem" as string]: 1 }} className="relative overflow-hidden rounded-[var(--raio-g)] aspect-[4/3] lg:col-span-6">
          <Foto src={foto.src} alt={foto.alt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </figure>
      </section>

      <div className="site-moldura pb-[clamp(56px,8vw,120px)]">
        <div className="grid gap-10 rounded-[var(--raio-g)] bg-[var(--papel)] p-6 md:p-12 lg:grid-cols-12">
          <nav aria-label="Nesta página" className="hidden lg:col-span-3 lg:block">
            <ul className="sticky top-6 space-y-2 text-[16px]">
              {secoes.map((secao) => (
                <li key={secao.titulo}>
                  <a href={`#${ancora(secao.titulo)}`} className="text-[var(--apagado)] hover:text-[var(--tinta)]">
                    {secao.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-12 lg:col-span-8 lg:col-start-5">
            {secoes.map((secao) => (
              <section key={secao.titulo} id={ancora(secao.titulo)} data-revelar className="scroll-mt-6">
                <h2 className="text-[22px] font-bold leading-tight">{secao.titulo}</h2>
                {secao.paragrafos?.map((paragrafo) => (
                  <p key={paragrafo} className="t-corpo mt-4 max-w-[60ch]">
                    {paragrafo}
                  </p>
                ))}
                {secao.itens && (
                  <ul className="mt-4 max-w-[60ch] space-y-3">
                    {secao.itens.map((item) => (
                      <li key={item} className="t-corpo flex gap-3">
                        <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[var(--tinta)]" />
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
    </div>
  );
}

export function metadataDaPagina(titulo: string, description: string): Metadata {
  return { title: titulo, description };
}
