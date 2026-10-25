// Cores do PetLive, extraídas do protótipo (arquivos .html em prototipo/).
// Fonte: Plus Jakarta Sans.

export const colors = {
  // Neutros
  text: '#111111', // títulos e texto principal do canvas
  textMuted: '#566070', // textos de apoio, legendas
  background: '#F3F5F8', // fundo das telas
  surface: '#FFFFFF', // cards e folhas
  border: '#E1E6EE', // divisórias e bordas de card
  borderStrong: '#C9D0DB', // bordas de campos e pílulas
  disabled: '#EEF1F5', // fundo de elemento desativado

  // Azul PetLive (marca)
  primary: '#9AD6F8', // azul principal: destaques, botões de marca
  primaryDark: '#1A5577', // azul escuro: texto sobre azul claro (#2F6F93 do protótipo, escurecido para contraste AA sobre o herói)
  primaryDeep: '#1A5577', // azul mais forte: links e ações
  primarySurface: '#E0F1FA', // fundo azul claro de card
  hero: '#9AD6F8', // fundo do herói (boas-vindas)

  // Verde: saúde em dia, confirmações
  successSurface: '#D8F2E3',
  successText: '#1F6B45',

  // Roxo: Premium e avisos especiais
  premiumSurface: '#EADCFB',
  premiumText: '#5B3E8A',

  // Saúde e emergência: significado definido em prototipo/paleta.json.
  healthSurface: '#FDE0E6',
  healthText: '#A3324F',
  emergency: '#C0392B',

  // Amarelo: atenção, vacina vencendo
  warningSurface: '#FFF0C9',
  warningText: '#8A6414',

  // Laranja e coral: mascote e ilustrações
  orange: '#E88F45',
  orangeSoft: '#F2A65A',
  coral: '#E57373',

  // Ações
  danger: '#C62828', // excluir, cancelar
  dangerSurface: '#FDECEC',
  overlay: 'rgba(42, 33, 28, 0.45)', // fundo de modal
  white: '#FFFFFF',
  black: '#111111',
} as const;

export type ColorName = keyof typeof colors;
