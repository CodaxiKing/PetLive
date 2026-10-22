/**
 * Roteiro do anúncio, sem narração: a mensagem vai toda em texto animado.
 * Tempos em segundos do vídeo inteiro. Para mudar o ritmo, mexa só aqui.
 */

export const DURACAO_S = 40;

/** Início e fim de cada cena. A próxima entra por cima da anterior. */
export const CENAS = {
  gancho: { de: 0, ate: 4.6 },
  marca: { de: 4.6, ate: 8.6 },
  vacinas: { de: 8.6, ate: 15.2 },
  lugares: { de: 15.2, ate: 21.2 },
  emergencia: { de: 21.2, ate: 27.0 },
  cuidados: { de: 27.0, ate: 32.0 },
  emBreve: { de: 32.0, ate: 35.6 },
  cta: { de: 35.6, ate: DURACAO_S },
} as const;

export type NomeCena = keyof typeof CENAS;

/**
 * Frases de apoio, em tipografia cinética na parte de baixo de cada cena.
 * Palavras em `destaque` ganham a cor da cena.
 */
export const FRASES: { de: number; ate: number; texto: string; destaque?: string[] }[] = [
  { de: 2.1, ate: 4.4, texto: "e você nem lembrou?", destaque: ["nem", "lembrou?"] },
  { de: 10.2, ate: 12.4, texto: "Aviso na hora certa", destaque: ["hora", "certa"] },
  { de: 12.6, ate: 15.0, texto: "Um toque e a dose fica salva", destaque: ["toque"] },
  { de: 16.6, ate: 18.6, texto: "Tudo pertinho de você", destaque: ["pertinho"] },
  { de: 18.8, ate: 21.0, texto: "Com fotos, telefone e rota", destaque: ["rota"] },
  { de: 22.6, ate: 24.6, texto: "A clínica 24 h mais perto", destaque: ["24", "h"] },
  { de: 24.8, ate: 26.8, texto: "Primeiros socorros até sem internet", destaque: ["sem", "internet"] },
  { de: 28.4, ate: 31.8, texto: "Tudo no horário certo, sem esquecer", destaque: ["sem", "esquecer"] },
  { de: 33.4, ate: 35.4, texto: "Eventos, adoção e passeios", destaque: ["adoção"] },
];

/** Momentos de animação (segundos absolutos). */
export const BATIDAS = {
  carimboVenceu: 0.35,
  tituloGancho: 1.25,
  notificacao: 9.6,
  toqueAplicada: 12.0,
  doseRegistrada: 12.4,
  pinos: [15.7, 15.9, 16.1, 16.3, 16.5],
  pilulas: [16.0, 16.4, 16.8, 17.2],
  telaLugar: 18.6,
  rota: 17.4,
  clinica24h: 22.4,
  telaSocorros: 24.6,
  semInternet: 25.1,
  telaRotina: 29.0,
  cards: [32.5, 32.9, 33.3],
  baixeGratis: 36.7,
  site: 37.3,
};

/** Textos fixos de tela. */
export const TEXTOS = {
  site: "petlive.app",
  slogan: "A saúde do seu pet, sempre em dia.",
  ctaRegiao: "Rio de Janeiro · cães e gatos",
  // Confirme antes de publicar: só deixe as lojas em que o app já está.
  lojas: ["Android", "iPhone"],
};

/**
 * Trilha: a original gerada por scripts/gerar-audio.mjs. Para usar outra,
 * coloque o arquivo em public/ e troque o nome; null tira a música.
 */
export const MUSICA: string | null = "musica.wav";
export const VOLUME_MUSICA = 0.45;

export type Som = "carimbo" | "whoosh" | "pop" | "notificacao" | "clique" | "sucesso" | "confete" | "brilho" | "fareja" | "batimento" | "chave" | "boing" | "triste" | "impacto";

/**
 * Efeitos sonoros (public/sfx/<som>.wav), em segundos do vídeo. Os tempos
 * acompanham BATIDAS e as entradas das animações; `vol` padrão 0.8.
 */
export const EFEITOS: { em: number; som: Som; vol?: number }[] = [
  // Gancho
  { em: 0.35, som: "carimbo", vol: 1 },
  { em: 0.37, som: "confete", vol: 0.4 },
  { em: 0.9, som: "triste", vol: 0.55 },
  { em: 1.25, som: "whoosh", vol: 0.6 },
  ...[1.32, 1.42, 1.52, 1.65].map((em) => ({ em, som: "pop" as Som, vol: 0.45 })),
  // Marca
  { em: 4.6, som: "whoosh" },
  { em: 4.8, som: "pop", vol: 0.9 },
  { em: 5.1, som: "pop", vol: 0.6 },
  { em: 5.6, som: "boing", vol: 0.6 },
  { em: 6.07, som: "brilho", vol: 0.5 },
  { em: 6.3, som: "boing", vol: 0.45 },
  // Vacinas
  { em: 8.6, som: "whoosh" },
  { em: BATIDAS.notificacao, som: "notificacao", vol: 0.9 },
  { em: BATIDAS.toqueAplicada, som: "clique", vol: 1 },
  { em: BATIDAS.doseRegistrada, som: "sucesso", vol: 0.8 },
  { em: BATIDAS.doseRegistrada, som: "confete", vol: 0.7 },
  // Lugares
  { em: 15.2, som: "whoosh" },
  { em: 15.5, som: "fareja", vol: 0.7 },
  ...BATIDAS.pinos.map((em) => ({ em, som: "pop" as Som, vol: 0.4 })),
  ...BATIDAS.pilulas.map((em) => ({ em: em + 0.05, som: "pop" as Som, vol: 0.55 })),
  { em: 17.0, som: "fareja", vol: 0.6 },
  { em: BATIDAS.rota, som: "whoosh", vol: 0.4 },
  { em: BATIDAS.telaLugar, som: "whoosh", vol: 0.7 },
  { em: BATIDAS.telaLugar + 0.27, som: "pop", vol: 0.6 },
  // Emergência
  { em: 21.2, som: "whoosh" },
  { em: 21.67, som: "pop", vol: 0.6 },
  { em: BATIDAS.clinica24h, som: "whoosh", vol: 0.6 },
  { em: BATIDAS.clinica24h + 0.05, som: "batimento", vol: 0.8 },
  { em: BATIDAS.telaSocorros, som: "whoosh", vol: 0.7 },
  { em: BATIDAS.telaSocorros + 0.33, som: "pop", vol: 0.6 },
  { em: BATIDAS.semInternet, som: "sucesso", vol: 0.45 },
  // Cuidados
  { em: 27.0, som: "whoosh" },
  { em: BATIDAS.telaRotina, som: "whoosh", vol: 0.6 },
  ...[0, 1, 2, 3].map((i) => ({ em: BATIDAS.telaRotina + 0.2 + i * 0.2, som: "pop" as Som, vol: 0.5 })),
  ...[0, 1, 2, 3].map((i) => ({ em: BATIDAS.telaRotina + 0.67 + i * 0.2, som: "chave" as Som, vol: 0.7 })),
  { em: BATIDAS.telaRotina + 0.7, som: "brilho", vol: 0.45 },
  { em: BATIDAS.telaRotina + 1.0, som: "pop", vol: 0.6 },
  // Em breve
  { em: 32.0, som: "whoosh" },
  { em: 32.33, som: "pop", vol: 0.7 },
  ...BATIDAS.cards.map((em) => ({ em, som: "whoosh" as Som, vol: 0.45 })),
  { em: BATIDAS.cards[0] + 0.13, som: "pop", vol: 0.5 },
  // Fechamento
  { em: 35.6, som: "whoosh", vol: 0.9 },
  { em: 35.8, som: "pop", vol: 0.9 },
  { em: 35.95, som: "pop", vol: 0.6 },
  { em: 36.0, som: "boing", vol: 0.55 },
  { em: BATIDAS.baixeGratis, som: "impacto", vol: 1 },
  { em: BATIDAS.site, som: "sucesso", vol: 0.9 },
  { em: BATIDAS.site, som: "confete", vol: 0.8 },
  { em: BATIDAS.site + 0.5, som: "brilho", vol: 0.5 },
];
