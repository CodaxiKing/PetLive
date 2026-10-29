"use client";

import { useEffect } from "react";

/**
 * Revela, uma vez, cada parte marcada com `data-revelar` quando ela entra
 * na tela (a ordem de entrada vem de `--ordem`). Sem script nada fica
 * escondido: o CSS só esconde quando o <html> tem a classe `js`.
 *
 * O conteúdo da página pode chegar por streaming depois deste efeito, e a
 * navegação troca a página sem recarregar; por isso um MutationObserver
 * entrega ao IntersectionObserver cada parte nova que aparecer no DOM.
 */
export function Revelar() {
  useEffect(() => {
    const revelar = (el: Element) => el.classList.add("visivel");

    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll("[data-revelar]").forEach(revelar);
      return;
    }

    const visao = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) {
            revelar(entrada.target);
            visao.unobserve(entrada.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    const observarDentro = (raiz: ParentNode) => {
      raiz.querySelectorAll("[data-revelar]:not(.visivel)").forEach((el) => visao.observe(el));
    };
    observarDentro(document);

    const mudancas = new MutationObserver((registros) => {
      for (const r of registros) {
        r.addedNodes.forEach((no) => {
          if (!(no instanceof Element)) return;
          if (no.matches("[data-revelar]:not(.visivel)")) visao.observe(no);
          observarDentro(no);
        });
      }
    });
    mudancas.observe(document.body, { childList: true, subtree: true });

    return () => {
      visao.disconnect();
      mudancas.disconnect();
    };
  }, []);

  return null;
}
