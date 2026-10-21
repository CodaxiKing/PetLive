import { normalizar } from '../sos/conteudo';

/**
 * Calculadoras (BUSINESS.md 5.20): idade em anos humanos, porção diária de
 * ração e peso ideal. Tudo roda no aparelho, sem internet. As tabelas vão
 * junto com o app (versão abaixo) até o `content-pack` trazê-las do
 * conteúdo mestre. São estimativas, não diagnóstico.
 */
export const VERSAO_TABELAS = 1;

export type Especie = 'cao' | 'gato';
export type Porte = 'pequeno' | 'medio' | 'grande' | 'gigante';
export type Fase = 'filhote' | 'adulto' | 'idoso';
export type Atividade = 'baixa' | 'normal' | 'alta';

export const ROTULO_PORTE: Record<Porte, string> = {
  pequeno: 'Pequeno',
  medio: 'Médio',
  grande: 'Grande',
  gigante: 'Gigante',
};
export const ROTULO_FASE: Record<Fase, string> = { filhote: 'Filhote', adulto: 'Adulto', idoso: 'Idoso' };
export const ROTULO_ATIVIDADE: Record<Atividade, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta' };

/** Porte do cão pelo peso adulto (kg). */
export function portePeloPeso(kg: number): Porte {
  if (kg < 10) return 'pequeno';
  if (kg < 25) return 'medio';
  if (kg < 45) return 'grande';
  return 'gigante';
}

// ---------------------------------------------------------------------------
// Idade em anos humanos
// ---------------------------------------------------------------------------

/** Anos humanos somados por ano de vida depois dos 2 anos. */
const ANOS_POR_ANO: Record<Especie, Record<Porte, number>> = {
  cao: { pequeno: 4, medio: 5, grande: 6, gigante: 7 },
  gato: { pequeno: 4, medio: 4, grande: 4, gigante: 4 },
};

/**
 * 1º ano = 15 anos humanos, 2º ano = +9, depois +4 a +7 por ano conforme
 * o porte (cães maiores envelhecem mais rápido). Antes de 1 ano, proporcional.
 */
export function idadeHumana(especie: Especie, porte: Porte, anos: number): number {
  if (anos <= 0) return 0;
  if (anos <= 1) return Math.round(anos * 15);
  if (anos <= 2) return Math.round(15 + (anos - 1) * 9);
  return Math.round(24 + (anos - 2) * ANOS_POR_ANO[especie][porte]);
}

// ---------------------------------------------------------------------------
// Fase da vida
// ---------------------------------------------------------------------------

/** Idade (anos) a partir da qual o cão é considerado idoso, por porte. */
const IDOSO_A_PARTIR: Record<Porte, number> = { pequeno: 10, medio: 8, grande: 7, gigante: 6 };

export function faseDaVida(especie: Especie, porte: Porte, anos: number): Fase {
  const fimFilhote = especie === 'cao' && porte === 'gigante' ? 1.5 : 1;
  if (anos < fimFilhote) return 'filhote';
  const idoso = especie === 'gato' ? 11 : IDOSO_A_PARTIR[porte];
  return anos >= idoso ? 'idoso' : 'adulto';
}

// ---------------------------------------------------------------------------
// Porção diária de ração
// ---------------------------------------------------------------------------

/** Energia da ração seca de referência (kcal por grama). */
const KCAL_POR_GRAMA = 3.7;

/** Fator sobre a energia de repouso (RER) por espécie, fase e castração. */
function fatorEnergia(especie: Especie, fase: Fase, castrado: boolean, meses: number): number {
  if (especie === 'cao') {
    if (fase === 'filhote') return meses < 4 ? 3 : 2;
    if (fase === 'idoso') return 1.4;
    return castrado ? 1.6 : 1.8;
  }
  if (fase === 'filhote') return 2.5;
  if (fase === 'idoso') return 1.1;
  return castrado ? 1.2 : 1.4;
}

const AJUSTE_ATIVIDADE: Record<Especie, Record<Atividade, number>> = {
  cao: { baixa: 0.8, normal: 1, alta: 1.4 },
  gato: { baixa: 0.85, normal: 1, alta: 1.2 },
};

export type Porcao = { gramasDia: number; refeicoes: number; gramasRefeicao: number; kcalDia: number };

/**
 * Energia de repouso = 70 × peso^0,75 (kcal), vezes o fator da fase e da
 * atividade, convertida em gramas de uma ração seca de ~3.700 kcal/kg.
 */
export function porcaoDiaria(opcoes: {
  especie: Especie;
  pesoKg: number;
  fase: Fase;
  atividade: Atividade;
  castrado: boolean;
  anos: number;
}): Porcao | null {
  const { especie, pesoKg, fase, atividade, castrado, anos } = opcoes;
  if (!(pesoKg > 0) || pesoKg > 120) return null;
  const repouso = 70 * Math.pow(pesoKg, 0.75);
  // A atividade só ajusta adultos e idosos: filhote segue a tabela de crescimento.
  const ajuste = fase === 'filhote' ? 1 : AJUSTE_ATIVIDADE[especie][atividade];
  const kcalDia = repouso * fatorEnergia(especie, fase, castrado, anos * 12) * ajuste;
  const gramasDia = Math.max(5, Math.round(kcalDia / KCAL_POR_GRAMA / 5) * 5);
  const refeicoes = fase === 'filhote' ? 3 : 2;
  return {
    gramasDia,
    refeicoes,
    gramasRefeicao: Math.round(gramasDia / refeicoes),
    kcalDia: Math.round(kcalDia),
  };
}

// ---------------------------------------------------------------------------
// Peso ideal
// ---------------------------------------------------------------------------

type Faixa = [number, number];

/** Faixa de peso adulto (kg) das raças mais comuns no Brasil. */
const RACAS: Record<Especie, Record<string, Faixa>> = {
  cao: {
    'shih tzu': [4, 7.5],
    yorkshire: [2, 3.5],
    'lhasa apso': [5, 8],
    maltes: [2, 4],
    'spitz alemao': [1.5, 3.5],
    'lulu da pomerania': [1.5, 3.5],
    pinscher: [2, 5],
    chihuahua: [1.5, 3],
    'poodle toy': [2, 4],
    poodle: [3, 8],
    'bulldog frances': [8, 14],
    'bulldog ingles': [18, 25],
    pug: [6, 9],
    beagle: [9, 14],
    dachshund: [7, 14],
    schnauzer: [5, 8],
    'cocker spaniel': [12, 15],
    'border collie': [14, 20],
    pitbull: [14, 27],
    'husky siberiano': [16, 27],
    dalmata: [20, 32],
    boxer: [25, 32],
    'golden retriever': [25, 34],
    labrador: [25, 36],
    'pastor alemao': [22, 40],
    rottweiler: [35, 60],
    akita: [32, 59],
  },
  gato: {
    persa: [3, 5.5],
    siames: [3, 5],
    angora: [3, 5],
    sphynx: [3, 5.5],
    bengal: [3.5, 7],
    ragdoll: [4.5, 9],
    'maine coon': [5, 11],
  },
};

/** Faixa por porte, para SRD ou raça fora da tabela. */
const FAIXA_PORTE: Record<Porte, Faixa> = {
  pequeno: [3, 10],
  medio: [10, 25],
  grande: [25, 45],
  gigante: [45, 90],
};
const FAIXA_GATO: Faixa = [3.5, 5.5];

export type PesoIdeal = { faixa: Faixa; origem: 'raca' | 'porte' | 'especie'; raca?: string };

/** Procura a raça pelo nome digitado; senão usa o porte (cão) ou a média (gato). */
export function pesoIdeal(especie: Especie, porte: Porte, raca?: string | null): PesoIdeal {
  const nome = raca ? normalizar(raca).replace(/[-_]/g, ' ') : '';
  if (nome) {
    const tabela = RACAS[especie];
    // Nome exato primeiro; depois a raça mais longa contida no texto ("golden retriever macho").
    const chave =
      (nome in tabela ? nome : null) ??
      Object.keys(tabela)
        .sort((a, b) => b.length - a.length)
        .find((r) => nome.includes(r));
    if (chave) return { faixa: tabela[chave], origem: 'raca', raca: chave };
  }
  if (especie === 'gato') return { faixa: FAIXA_GATO, origem: 'especie' };
  return { faixa: FAIXA_PORTE[porte], origem: 'porte' };
}

/** Diferença do peso atual para a faixa: 0 dentro dela, + acima, − abaixo. */
export function diferencaDaFaixa(pesoKg: number, [min, max]: Faixa): number {
  if (pesoKg > max) return pesoKg - max;
  if (pesoKg < min) return pesoKg - min;
  return 0;
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function formatarKg(kg: number): string {
  const arredondado = Math.round(kg * 10) / 10;
  return Number.isInteger(arredondado) ? String(arredondado) : arredondado.toFixed(1).replace('.', ',');
}

/** "12,5" ou "12.5" -> 12.5; vazio ou inválido -> NaN. */
export function lerNumero(texto: string): number {
  const limpo = texto.replace(',', '.').replace(/[^\d.]/g, '');
  return limpo ? Number(limpo) : NaN;
}

/** Idade em anos (com fração) a partir de 'YYYY-MM-DD'. */
export function anosDesde(nascimento: string | null | undefined, hoje = new Date()): number | null {
  if (!nascimento) return null;
  const data = new Date(`${nascimento}T12:00:00`);
  if (Number.isNaN(data.getTime())) return null;
  const anos = (hoje.getTime() - data.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return anos >= 0 ? anos : null;
}
