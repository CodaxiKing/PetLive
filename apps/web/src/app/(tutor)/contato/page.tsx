import type { Metadata } from "next";
import { Foto } from "@/components/site/Foto";
import { FormularioContato } from "@/components/FormularioContato";
import { EMAIL_CONTATO } from "@/lib/contato";

export const metadata: Metadata = {
  title: "Contato",
  description: "Fale com o PetLive: dúvidas, sugestões, privacidade e parcerias.",
  alternates: { canonical: "/contato" },
};

/** Contato (board: [WEB] Site "formulário de contato"). */
export default function PaginaContato() {
  return (
    <div className="bg-[var(--ceu)]">
      <section className="site-moldura grid items-end gap-8 py-[clamp(48px,6vw,96px)] lg:grid-cols-12">
        <div className="lg:col-span-6">
          <h1 data-revelar className="t-display max-w-[10ch]" style={{ fontSize: "clamp(44px, 5.4vw, 84px)" }}>
            Fale com a gente
          </h1>
          <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead mt-8 max-w-[40ch]">
            Dúvidas sobre o app, sugestões ou pedidos sobre os seus dados. Respondemos por e-mail em até 2 dias úteis.
          </p>
        </div>
        <figure data-revelar style={{ ["--ordem" as string]: 1 }} className="relative overflow-hidden rounded-[var(--raio-g)] aspect-[4/3] lg:col-span-6">
          <Foto src="/fotos/tutora.jpg" alt="Tutora sorrindo com o cão no colo, em casa" fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </figure>
      </section>

      <div className="site-moldura pb-[clamp(56px,8vw,120px)]">
        <div className="grid gap-2 lg:grid-cols-12">
          <div data-revelar className="rounded-[var(--raio-g)] bg-[var(--papel)] p-6 md:p-12 lg:col-span-8">
            <h2 className="mb-8 text-[22px] font-bold">Mensagem</h2>
            <FormularioContato tipo="contato" />
          </div>

          <aside className="grid gap-2 lg:col-span-4">
            <div data-revelar style={{ ["--ordem" as string]: 1 }} className="flex flex-col justify-between gap-6 rounded-[var(--raio-g)] bg-[var(--papel)] p-6">
              <h2 className="text-[22px] font-bold">E-mail</h2>
              <a href={`mailto:${EMAIL_CONTATO}`} className="link-sublinhado break-all text-[17px] font-semibold">
                {EMAIL_CONTATO}
              </a>
            </div>
            <div data-revelar style={{ ["--ordem" as string]: 2 }} className="rounded-[var(--raio-g)] bg-[var(--tinta)] p-6 text-[var(--papel)]">
              <h2 className="text-[22px] font-bold">Emergência com o seu pet?</h2>
              <p className="t-corpo mt-3">Não espere a resposta: no app, toque em SOS para ligar para a clínica 24 h mais perto.</p>
            </div>
            <div data-revelar style={{ ["--ordem" as string]: 3 }} className="rounded-[var(--raio-g)] bg-[var(--papel)] p-6">
              <h2 className="text-[22px] font-bold">Seus dados (LGPD)</h2>
              <p className="t-corpo mt-3">Exportar ou apagar a conta é feito no próprio app, em Perfil › Privacidade e dados.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
