import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { Easing } from "remotion";

// Mesma fonte do app (apps/tutor/src/theme/typography.ts).
export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

// Tokens do app (apps/tutor/src/theme/colors.ts) + os tons de fundo de cada
// cena do anúncio original.
export const C = {
  texto: "#2A211C",
  textoApoio: "#5E6878",
  fundoTela: "#F3F5F8",
  branco: "#FFFFFF",
  borda: "#E1E6EE",
  bordaForte: "#C9D0DB",
  preto: "#111111",

  azul: "#9AD6F8",
  azulEscuro: "#2F6F93",
  azulForte: "#1D5F86",
  azulClaro: "#E3F3FC",
  heroi: "#A9DCF6",

  verdeClaro: "#DDF3E6",
  verde: "#25683F",
  roxoClaro: "#EBDDFB",
  roxo: "#5B3C8F",
  amareloClaro: "#FFF1C9",
  amarelo: "#7A5F0A",
  laranja: "#E88F45",
  coral: "#E57373",
  vinho: "#A3304F",
  rosaClaro: "#FBDDE3",

  // Fundos das cenas
  creme: "#FDF0C8",
  ceu: "#DDEFF8",
  menta: "#D6F0E2",
  rosa: "#FADCE2",
  lavanda: "#E4DAF8",
  noite: "#121212",
};

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * Zonas seguras do Reels/TikTok/Shorts em 1080×1920: a interface do app cobre
 * o rodapé (nome, legenda, música) e a coluna da direita (curtir, comentar).
 * Nada importante deve ficar ali.
 */
export const SEGURO = { topo: 150, rodape: 1540, direita: 960 };
