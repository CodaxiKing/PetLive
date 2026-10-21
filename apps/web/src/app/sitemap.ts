import type { MetadataRoute } from "next";

const SITE = "https://petlive.app.br";

/** Páginas públicas do site; a página do QR (/p/[codigo]) não entra (Fase 2, privada por link). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/termos`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacidade`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/lgpd`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
