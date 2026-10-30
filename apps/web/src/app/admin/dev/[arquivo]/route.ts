import { readFile } from "node:fs/promises";
import { resolve } from "node:path";



/** Local canvas preview. Never authenticates a user or connects to the database. */
export async function GET(request: Request, context: { params: Promise<{ arquivo: string }> }) {
  const host = new URL(request.url).hostname;
  if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    return new Response("Não encontrado", { status: 404 });
  }
  const { arquivo } = await context.params;
  const html = /^Admin[A-Za-z]+\.html$/.test(arquivo);
  const assets: Record<string, string> = { "estilo.css": "text/css", "web.css": "text/css", "logo-petlive.png": "image/png" };
  if (!html && !Object.hasOwn(assets, arquivo)) return new Response("Não encontrado", { status: 404 });
  try {
    const arquivoLocal = resolve(process.cwd(), "../../prototipo/v2", arquivo);
    const bytes = await readFile(arquivoLocal);
    const headers = { "Content-Type": html ? "text/html; charset=utf-8" : assets[arquivo], "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
    if (!html) return new Response(bytes, { headers });
    const aviso = `<div style="height:40px;padding:10px 20px;background:#fff0c9;color:#63490d;font:12px system-ui;box-sizing:border-box;display:flex;justify-content:space-between"><b>DEV · Prévia do canvas · Dados fictícios, sem acesso ao banco</b><a href="/admin/entrar" style="color:inherit">Voltar à entrada</a></div>`;
    // The canvas uses a fixed export size; the local preview follows the window.
    const responsivo = `<style>
      *{box-sizing:border-box}
      .tela-web{width:100%;height:calc(100svh - 40px);min-height:640px;overflow:auto}
      .lateral{position:sticky;top:0;height:100%;overflow-y:auto}
      .menu{overflow-y:auto;flex:1;min-height:0}
      .dev-sair{display:flex;align-items:center;gap:10px;flex:none;margin-top:12px;padding:12px 10px;border-top:1px solid #2a3445;color:#c9d0db;font-size:13px;font-weight:600;text-decoration:none}
      .dev-sair:hover,.dev-sair:focus-visible{color:white;background:#243349;border-radius:12px}
      .menu details{margin-bottom:6px}
      .menu summary{display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:12px;color:#8a93a3;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;list-style:none}
      .menu summary::-webkit-details-marker{display:none}
      .menu summary::after{content:"⌄";font-size:16px;line-height:1}
      .menu details[open]>summary::after{transform:rotate(180deg)}
      .menu summary:hover,.menu summary:focus-visible{background:#243349;color:white}
      .menu details[open]>summary{color:#c9d0db}
      .principal{width:0;min-width:0;flex:1;padding-bottom:22px}
      .corpo{overflow:visible;display:flex;flex-direction:column;padding-bottom:0}
      .corpo>div[style*="display:grid"]{flex:1}
      .cabeca{flex-wrap:wrap}
      .cabeca .tit{min-width:200px}
      @media(max-width:900px){.lateral{width:190px}.principal{padding:20px 16px}.numeros{grid-template-columns:repeat(2,minmax(0,1fr))}.corpo>div[style*="display:grid"]{grid-template-columns:minmax(0,1fr)!important}.busca{display:none}.tela-web{height:auto;min-height:calc(100svh - 40px)}.lateral{height:calc(100svh - 40px)}.corpo{flex:none}}
    </style>`;
    const comDropdowns = bytes.toString("utf8").replace(/<nav class="menu">([\s\S]*?)<\/nav>/g, (_, conteudo: string) => {
      const grupos = conteudo.replace(/<h6>(.*?)<\/h6>([\s\S]*?)(?=<h6>|$)/g, (_, titulo: string, links: string) =>
        `<details${/class="ativa"/.test(links) ? " open" : ""}><summary>${titulo}</summary>${links}</details>`);
      return `<nav class="menu" aria-label="Áreas do painel">${grupos}</nav><a href="/admin/entrar" class="dev-sair"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></svg>Sair da prévia</a>`;
    });
    const pagina = comDropdowns
      .replace('content="width=1280"', 'content="width=device-width, initial-scale=1"')
      .replace("</head>", `${responsivo}</head>`)
      .replace("<body>", `<body>${aviso}`);
    return new Response(pagina, { headers });
  } catch {
    return new Response("Tela de demonstração não encontrada", { status: 404 });
  }
}
