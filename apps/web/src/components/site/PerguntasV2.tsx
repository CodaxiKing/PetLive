"use client";

import { useId, useState } from "react";
import Link from "next/link";

const PERGUNTAS = [
  { titulo: "O PetLive substitui o veterinário?", resposta: "Não. O PetLive ajuda a organizar o histórico de saúde e os cuidados do dia a dia. Diagnósticos, tratamentos e decisões clínicas devem ser acompanhados por um veterinário." },
  { titulo: "Meus dados estão protegidos?", resposta: "Os dados do pet são privados por padrão. Você escolhe o que compartilhar e pode gerenciar seus consentimentos nas configurações de privacidade.", link: "/privacidade", acao: "Conhecer a política de privacidade" },
  { titulo: "Funciona sem internet?", resposta: "As informações já carregadas e os guias de emergência ficam disponíveis offline. Para sincronizar alterações e buscar lugares atualizados, é preciso se conectar à internet." },
];

export function PerguntasV2() {
  const [aberta, setAberta] = useState<number | null>(0);
  const prefixo = useId();
  return <section data-revelar className="v2-section v2-faq" id="perguntas">
    <div className="v2-faq-intro"><span className="v2-faq-etiqueta">PODEMOS AJUDAR?</span><h2>Perguntas frequentes</h2><p>Respostas para começar a cuidar com mais tranquilidade.</p><Link href="/contato">Ainda tem dúvidas? Fale com a gente <span aria-hidden="true">↗</span></Link></div>
    <div className="v2-faq-lista">{PERGUNTAS.map((item, indice) => {
      const expandida = aberta === indice;
      const painel = `${prefixo}-resposta-${indice}`;
      const botao = `${prefixo}-pergunta-${indice}`;
      return <article className={`v2-faq-item${expandida ? " aberta" : ""}`} key={item.titulo}>
        <h3><button id={botao} aria-expanded={expandida} aria-controls={painel} onClick={() => setAberta(expandida ? null : indice)}><span>{item.titulo}</span><span className="v2-faq-mais" aria-hidden="true"><span /><span /></span></button></h3>
        <div id={painel} role="region" aria-labelledby={botao} aria-hidden={!expandida} inert={!expandida} className="v2-faq-resposta"><div><div className="v2-faq-texto"><p>{item.resposta}</p>{item.link ? <Link href={item.link}>{item.acao} →</Link> : null}</div></div></div>
      </article>;
    })}</div>
  </section>;
}
