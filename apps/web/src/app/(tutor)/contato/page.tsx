import type { Metadata } from "next";
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
    <div className="bg-fundo">
      <section className="border-b border-borda bg-azul-fundo">
        <div className="mx-auto max-w-[1440px] px-6 py-16 md:px-12 md:py-20 xl:px-[120px]">
          <p className="text-sm font-bold uppercase tracking-widest text-azul-escuro">Contato</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Fale com a gente
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cinza">
            Dúvidas sobre o app, sugestões ou pedidos sobre os seus dados. Respondemos por e-mail em até 2 dias úteis.
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-14 md:px-12 lg:grid-cols-[1.5fr_1fr] xl:px-[120px]">
        <FormularioContato tipo="contato" />

        <aside className="space-y-4">
          <div className="rounded-[28px] bg-suave p-6">
            <p className="font-extrabold">E-mail</p>
            <a href={`mailto:${EMAIL_CONTATO}`} className="mt-1 block text-cinza underline">
              {EMAIL_CONTATO}
            </a>
          </div>
          <div className="rounded-[28px] bg-rosa-fundo p-6 text-rosa-texto">
            <p className="font-extrabold">Emergência com o seu pet?</p>
            <p className="mt-1 leading-relaxed">
              Não espere a resposta: no app, toque em SOS para ligar para a clínica 24 h mais perto.
            </p>
          </div>
          <div className="rounded-[28px] bg-verde-fundo p-6 text-verde-texto">
            <p className="font-extrabold">Seus dados (LGPD)</p>
            <p className="mt-1 leading-relaxed">
              Exportar ou apagar a conta é feito no próprio app, em Perfil › Privacidade e dados.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
