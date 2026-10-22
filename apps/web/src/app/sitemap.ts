import type { MetadataRoute } from "next";

const SITE = "https://petlive.app.br";

/** Páginas públicas do site; a página do QR (/r/[codigo]) e da ficha (/ficha/[codigo]) não entram (Fase 2, privadas por link). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/lojistas`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/contato`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/termos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/lgpd`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/creditos`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
