/**
 * Conteúdo de emergência que vai junto com o app (BUSINESS.md 5.18):
 * funciona sem internet desde a instalação. Quando a função `content-pack`
 * existir, um pacote mais novo baixado substitui este (mesmo formato).
 *
 * Regras do conteúdo: de 3 a 6 passos curtos, sempre terminando em "vá à
 * clínica"; nada de doses, marcas ou remédios caseiros.
 *
 * IMPORTANTE: precisa de revisão veterinária antes do lançamento (board
 * "[BACKEND] Qualidade: Revisão veterinária do conteúdo de emergência").
 * Enquanto `revisao` for null, as telas avisam que a revisão está pendente.
 */

export type Revisao = { veterinario: string; crmv: string; em: string };

export type Situacao = {
  id: string;
  titulo: string;
  passos: string[];
};

export type NivelRisco = 'perigoso' | 'cuidado';

export type ItemToxico = {
  id: string;
  nome: string;
  /** Outros nomes para a busca (sem acento, minúsculas). */
  sinonimos: string[];
  risco: NivelRisco;
  /** Para quem vale: cão, gato ou os dois. */
  especies: ('cao' | 'gato')[];
  /** Resumo de uma linha mostrado na lista. */
  resumo: string;
  sintomas: string;
  oQueFazer: string;
};

export type PacoteEmergencia = {
  versao: number;
  revisao: Revisao | null;
  primeirosSocorros: Situacao[];
  toxicos: ItemToxico[];
};

const VA_A_CLINICA = 'Vá a uma clínica 24 h agora, mesmo que ele melhore.';

export const PACOTE_EMBUTIDO: PacoteEmergencia = {
  versao: 1,
  revisao: null,
  primeirosSocorros: [
    {
      id: 'engasgo',
      titulo: 'Engasgo',
      passos: [
        'Mantenha a calma e segure o pet com firmeza, sem apertar o pescoço.',
        'Abra a boca com cuidado e veja se o objeto está à vista.',
        'Só retire com os dedos se der para pegar fácil. Não empurre para dentro.',
        'Se ele não conseguir respirar ou ficar com a língua roxa, saia agora para a clínica.',
        VA_A_CLINICA,
      ],
    },
    {
      id: 'golpe-de-calor',
      titulo: 'Golpe de calor',
      passos: [
        'Leve o pet para a sombra e ao vento.',
        'Molhe com água fresca, não gelada, nas patas e na barriga.',
        'Ofereça água em pequenos goles.',
        VA_A_CLINICA,
      ],
    },
    {
      id: 'convulsao',
      titulo: 'Convulsão',
      passos: [
        'Afaste móveis e objetos para ele não se machucar.',
        'Não coloque a mão nem nada na boca do pet.',
        'Deixe o ambiente escuro e silencioso e marque quanto tempo dura.',
        'Quando passar, mantenha-o aquecido e em local calmo.',
        VA_A_CLINICA,
      ],
    },
    {
      id: 'sangramento',
      titulo: 'Sangramento',
      passos: [
        'Pressione o local com um pano limpo ou gaze, com firmeza.',
        'Se o pano encharcar, coloque outro por cima sem tirar o primeiro.',
        'Mantenha a pressão durante o caminho.',
        VA_A_CLINICA,
      ],
    },
    {
      id: 'picada-mordida',
      titulo: 'Picada ou mordida',
      passos: [
        'Afaste o pet do animal ou do inseto, sem se expor.',
        'Lave o local só com água corrente.',
        'Observe inchaço no rosto, falta de ar ou fraqueza.',
        'Se foi cobra, escorpião ou aranha, não corte nem aperte o local.',
        VA_A_CLINICA,
      ],
    },
    {
      id: 'atropelamento-queda',
      titulo: 'Atropelamento ou queda',
      passos: [
        'Proteja-se do trânsito antes de chegar perto.',
        'Mesmo um pet dócil pode morder com dor: cubra a cabeça com um pano.',
        'Mova o pet o mínimo possível, deitado sobre uma superfície firme.',
        'Mantenha-o aquecido durante o caminho.',
        VA_A_CLINICA,
      ],
    },
  ],
  toxicos: [
    {
      id: 'chocolate',
      nome: 'Chocolate',
      sinonimos: ['cacau', 'brigadeiro', 'bolo de chocolate'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Vômito, tremores e agitação',
      sintomas: 'Vômito, diarreia, agitação, coração acelerado, tremores e convulsão.',
      oQueFazer: 'Anote o tipo e a quantidade e ligue para a clínica. Não provoque vômito por conta própria.',
    },
    {
      id: 'uva',
      nome: 'Uva e passas',
      sinonimos: ['uva passa', 'passas'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Pode causar falha nos rins',
      sintomas: 'Vômito, falta de apetite, fraqueza e pouca urina, às vezes dias depois.',
      oQueFazer: 'Mesmo pouca quantidade pode ser grave. Vá à clínica.',
    },
    {
      id: 'cebola-alho',
      nome: 'Cebola e alho',
      sinonimos: ['cebola', 'alho', 'cebolinha', 'alho poro', 'tempero'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Fraqueza e urina escura',
      sintomas: 'Fraqueza, gengiva pálida, urina escura e cansaço, que podem aparecer dias depois.',
      oQueFazer: 'Crus, cozidos ou em pó fazem mal. Ligue para a clínica e conte quanto ele comeu.',
    },
    {
      id: 'xilitol',
      nome: 'Xilitol (adoçante)',
      sinonimos: ['adocante', 'chiclete', 'bala sem acucar', 'pasta de dente'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Queda de açúcar no sangue',
      sintomas: 'Fraqueza, tremores, desequilíbrio e convulsão, em poucos minutos.',
      oQueFazer: 'Vá à clínica agora. Confira o rótulo de chicletes, balas e doces diet.',
    },
    {
      id: 'lirio',
      nome: 'Lírio (gatos)',
      sinonimos: ['lirio', 'flor', 'planta'],
      risco: 'perigoso',
      especies: ['gato'],
      resumo: 'Muito tóxico para gatos',
      sintomas: 'Vômito, baba, falta de apetite e falha nos rins. Até o pólen e a água do vaso.',
      oQueFazer: 'Vá à clínica agora, mesmo sem sintomas.',
    },
    {
      id: 'remedio-humano',
      nome: 'Remédios de uso humano',
      sinonimos: ['remedio', 'analgesico', 'anti inflamatorio', 'comprimido', 'medicamento'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Analgésicos e anti-inflamatórios',
      sintomas: 'Vômito, sangue nas fezes, dor na barriga, fraqueza e dificuldade para respirar.',
      oQueFazer: 'Nunca dê remédio de gente ao pet. Leve a embalagem à clínica.',
    },
    {
      id: 'antipulgas-gato',
      nome: 'Antipulgas de cão em gato',
      sinonimos: ['antipulgas', 'pipeta', 'carrapaticida', 'coleira'],
      risco: 'perigoso',
      especies: ['gato'],
      resumo: 'Tremores e convulsão em gatos',
      sintomas: 'Tremores, baba, agitação e convulsão.',
      oQueFazer: 'Lave o local com água e sabão neutro e vá à clínica com a embalagem.',
    },
    {
      id: 'veneno-rato',
      nome: 'Veneno de rato',
      sinonimos: ['raticida', 'chumbinho', 'veneno', 'isca'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Sangramentos e convulsão',
      sintomas: 'Sangramento pelo nariz ou nas fezes, manchas roxas, fraqueza, tremores e convulsão.',
      oQueFazer: 'Vá à clínica agora e leve a embalagem se tiver.',
    },
    {
      id: 'produtos-limpeza',
      nome: 'Produtos de limpeza',
      sinonimos: ['agua sanitaria', 'cloro', 'desinfetante', 'soda', 'detergente'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Queimam a boca e o estômago',
      sintomas: 'Baba, boca vermelha, vômito, tosse e dificuldade para engolir.',
      oQueFazer: 'Não provoque vômito. Lave a pele com água e leve a embalagem à clínica.',
    },
    {
      id: 'macadamia',
      nome: 'Macadâmia',
      sinonimos: ['noz', 'castanha'],
      risco: 'perigoso',
      especies: ['cao'],
      resumo: 'Fraqueza nas patas traseiras',
      sintomas: 'Fraqueza, tremores, vômito e febre.',
      oQueFazer: 'Ligue para a clínica e conte quanto ele comeu.',
    },
    {
      id: 'alcool',
      nome: 'Bebida alcoólica',
      sinonimos: ['alcool', 'cerveja', 'vinho', 'massa crua', 'fermento'],
      risco: 'perigoso',
      especies: ['cao', 'gato'],
      resumo: 'Inclui massa crua com fermento',
      sintomas: 'Desequilíbrio, vômito, sonolência e respiração lenta.',
      oQueFazer: 'Vá à clínica. Massa crua também pode inchar no estômago.',
    },
    {
      id: 'cafe',
      nome: 'Café e energéticos',
      sinonimos: ['cafeina', 'cha preto', 'energetico', 'cha mate'],
      risco: 'cuidado',
      especies: ['cao', 'gato'],
      resumo: 'Agitação e coração acelerado',
      sintomas: 'Agitação, vômito, coração acelerado e tremores.',
      oQueFazer: 'Ligue para a clínica e conte quanto ele comeu ou bebeu.',
    },
    {
      id: 'abacate',
      nome: 'Abacate',
      sinonimos: ['guacamole'],
      risco: 'cuidado',
      especies: ['cao', 'gato'],
      resumo: 'Vômito e diarreia',
      sintomas: 'Vômito e diarreia. O caroço pode entalar.',
      oQueFazer: 'Observe e ligue para a clínica se vomitar mais de uma vez ou parar de comer.',
    },
    {
      id: 'osso-cozido',
      nome: 'Osso cozido',
      sinonimos: ['osso', 'frango', 'costela'],
      risco: 'cuidado',
      especies: ['cao', 'gato'],
      resumo: 'Pode lascar e furar',
      sintomas: 'Engasgo, vômito, barriga dura e dor, fezes com sangue.',
      oQueFazer: 'Não provoque vômito. Se tiver qualquer sintoma, vá à clínica.',
    },
    {
      id: 'comigo-ninguem-pode',
      nome: 'Comigo-ninguém-pode',
      sinonimos: ['planta', 'folha', 'costela de adao', 'antúrio', 'anturio'],
      risco: 'cuidado',
      especies: ['cao', 'gato'],
      resumo: 'Irrita a boca e a garganta',
      sintomas: 'Baba, boca inchada, dificuldade para engolir e vômito.',
      oQueFazer: 'Lave a boca com água por fora e ligue para a clínica.',
    },
  ],
};

/** Minúsculas e sem acento, para a busca. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Busca por nome ou sinônimo; perigosos primeiro, depois em ordem alfabética. */
export function buscarToxicos(itens: ItemToxico[], busca: string): ItemToxico[] {
  const termo = normalizar(busca);
  const filtrados = termo
    ? itens.filter(
        (item) =>
          normalizar(item.nome).includes(termo) || item.sinonimos.some((s) => normalizar(s).includes(termo)),
      )
    : itens;
  return [...filtrados].sort((a, b) => {
    if (a.risco !== b.risco) return a.risco === 'perigoso' ? -1 : 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

/** Linha de rodapé das telas: quem revisou e quando, ou o aviso de pendência. */
export function textoRevisao(pacote: PacoteEmergencia): string {
  if (!pacote.revisao) return 'Revisão veterinária pendente. Não substitui o atendimento.';
  const data = new Date(pacote.revisao.em).toLocaleDateString('pt-BR');
  return `Revisado por ${pacote.revisao.veterinario} (CRMV ${pacote.revisao.crmv}) em ${data}. Não substitui o atendimento.`;
}
