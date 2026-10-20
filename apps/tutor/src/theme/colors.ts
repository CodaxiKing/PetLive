// Cores do PetLive, extraídas do protótipo (arquivos .html em prototipo/).
// Fonte: Plus Jakarta Sans.

export const colors = {
  // Neutros
  text: '#2A211C', // títulos e texto principal
  textMuted: '#5E6878', // textos de apoio, legendas
  background: '#F3F5F8', // fundo das telas
  surface: '#FFFFFF', // cards e folhas
  border: '#E1E6EE', // divisórias e bordas de card
  borderStrong: '#C9D0DB', // bordas de campos e pílulas
  disabled: '#EEF1F5', // fundo de elemento desativado

  // Azul PetLive (marca)
  primary: '#9AD6F8', // azul principal: destaques, botões de marca
  primaryDark: '#2F6F93', // azul escuro: texto sobre azul claro
  primaryDeep: '#1D5F86', // azul mais forte: links e ações
  primarySurface: '#E3F3FC', // fundo azul claro de card
  hero: '#A9DCF6', // fundo do herói (boas-vindas)

  // Verde: saúde em dia, confirmações
  successSurface: '#DDF3E6',
  successText: '#25683F',

  // Roxo: Premium e avisos especiais
  premiumSurface: '#EBDDFB',
  premiumText: '#5B3C8F',

  // Amarelo: atenção, vacina vencendo
  warningSurface: '#FFF1C9',
  warningText: '#7A5F0A',

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
