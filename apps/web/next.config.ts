import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Imagem enxuta para o Docker (Coolify): .next/standalone roda só com `node server.js`.
  output: "standalone",
  // Monorepo: o rastreio das dependências parte da raiz do repositório.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  cacheComponents: true,
  partialPrefetching: true,
  // Página de status (public/status): HTML próprio, sem o layout do site, em /status.
  async rewrites() {
    return [{ source: "/status", destination: "/status/index.html" }];
  },
};

export default nextConfig;
