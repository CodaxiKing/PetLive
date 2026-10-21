import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // Páginas do QR e da ficha de emergência (Fase 2) são privadas por link.
    rules: { userAgent: "*", allow: "/", disallow: ["/p/", "/ficha/"] },
    sitemap: "https://petlive.app.br/sitemap.xml",
  };
}
