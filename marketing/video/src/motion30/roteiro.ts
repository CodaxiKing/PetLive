/**
 * Roteiro do anúncio "PetLive-Motion-30s": 30 s, 30 fps, sem áudio.
 *
 * Quase todo ajuste fica aqui: textos de cada cena (TEXTOS), quando cada
 * cena começa (CENAS) e os momentos das interações dentro do celular
 * (BATIDAS). Tudo em quadros (30 por segundo).
 */

export const FPS = 30;
export const DURACAO = 30 * FPS;

/** Início de cada cena, em quadros. A última vai até DURACAO. */
export const CENAS = {
  gancho: 0,
  marca: 96,
  saude: 186,
  rotina: 366,
  lugares: 546,
  fechamento: 726,
} as const;

export type NomeCena = keyof typeof CENAS;

/** Títulos externos. `l2` ganha o marca-texto azul. */
export const TEXTOS = {
  gancho: { l1: "Os cuidados do seu pet,", l2: "em um só lugar." },
  marca: { l1: "Conheça o", l2: "PetLive." },
  saude: { etiqueta: "Saúde", l1: "Vacinas e histórico", l2: "sempre à mão." },
  rotina: { etiqueta: "Remédios", l1: "Mais organização", l2: "na rotina." },
  lugares: { etiqueta: "Mapa", l1: "Encontre cuidados", l2: "por perto." },
  /** Legendas acima dos cards que saem do celular. */
  destaques: {
    pets: "Seus pets",
    vacinas: "Histórico de vacinas",
    dose: "Dose confirmada",
    lugar: "Perto de você",
  },
  fechamento: {
    marca: "PetLive",
    apoio: ["Mais cuidado.", "Mais momentos juntos."],
    cta: "Conheça o PetLive",
    nota: "Telas ilustrativas com dados fictícios.",
  },
};

/** Momentos das interações (quadros absolutos). */
export const BATIDAS = {
  // Gancho → marca: o perfil volta para o Início.
  voltaInicio: 104,
  // Saúde: toque no atalho Carteirinha e o card de vacinas sai do celular.
  toqueCarteirinha: 206,
  abreCarteirinha: 214,
  vacinasSai: 262,
  vacinasVolta: 340,
  // Rotina: Medicamentos, aviso do horário e confirmação da dose das 20:00.
  abreRemedios: 372,
  avisoEntra: 392,
  avisoSai: 446,
  toqueDose: 466,
  doseSai: 482,
  doseVolta: 528,
  // Lugares: mapa, pins em ordem, toque na clínica e o card.
  abreMapa: 552,
  pinos: [574, 580, 586, 592, 598],
  toquePino: 626,
  cardSobe: 632,
  cardSai: 662,
  cardVolta: 712,
  // Fechamento: o celular volta ao Início enquanto mostra o verso.
  voltaInicioFinal: 744,
};

/**
 * Dados fictícios e coerentes entre as telas. "Hoje" no anúncio é 18/11/26,
 * 20:00: a V10 vence em 12 dias e a dose das 20:00 é a próxima.
 */
export const DADOS = {
  hora: "20:00",
  cidade: "Rio de Janeiro",
  saudacao: "Boa noite",
  pet: { nome: "Rex", especie: "Cão · SRD", sexo: "Macho", idade: "3 anos", peso: "28 kg" },
  outroPet: "Mia",
  vacinas: [
    { nome: "V10", aplicada: "30/11/25", proxima: "30/11/26" },
    { nome: "Antirrábica", aplicada: "15/03/26", proxima: "15/03/27" },
    { nome: "Gripe canina", aplicada: "10/06/26", proxima: "10/06/27" },
  ],
  proximaVacina: { texto: "V10 em 12 dias", selo: "V10 · 12 dias", fracao: 0.967 },
  remedio: { nome: "Antibiótico", dose: "1 comprimido", frequencia: "a cada 12 h", dia: 3, total: 7, doses: ["08:00", "20:00"] },
  suplemento: { nome: "Suplemento articular", dose: "1 sachê", frequencia: "1 vez ao dia", dia: 12, doses: ["09:00"] },
  lugar: { nome: "Clínica Bem-Estar Pet", categoria: "Clínica", distancia: "800 m" },
};
