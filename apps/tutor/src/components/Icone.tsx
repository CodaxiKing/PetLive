import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

/**
 * Ícones de traço usados nas telas do protótipo (viewBox 24, traço 1.8).
 * Cada entrada é a lista de formas do SVG original.
 */
const DESENHOS = {
  escudo: ['M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z', 'M9 12l2 2 4-4'],
  casa: ['M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'],
  sino: ['M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z', 'M10 21h4'],
  local: ['M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z', { cx: 12, cy: 10, r: 2.4 }],
  pessoas: [
    { cx: 9, cy: 8, r: 3.2 },
    'M3.5 19c.4-3.4 2.6-5 5.5-5s5.1 1.6 5.5 5',
    { cx: 17, cy: 9, r: 2.4 },
    'M16.5 14.2c2.4.2 3.7 1.6 4 4.3',
  ],
  livro: ['M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z', 'M5 17a3 3 0 0 1 3-3h10'],
  bandeira: ['M6 21V4', 'M6 5h11l-2 4 2 4H6'],
  telefone: [
    'M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  ],
  rota: ['M5 19l14-7L5 5l3 7z'],
  cruz: ['M12 5v14M5 12h14'],
  alerta: ['M12 3l9 16H3z', 'M12 10v4', 'M12 17v.5'],
  frasco: ['M9 3h6', 'M10 3v4L6 18a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-11V3'],
  calculadora: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 7h8', 'M8 12h.5M12 12h.5M16 12h.5M8 16h.5M12 16h.5M16 16h.5'],
  relogio: [{ cx: 12, cy: 12, r: 8 }, 'M12 8v4l2.5 1.5'],
  balanca: ['M5 7h14l-2 13H7z', 'M9 11a3 3 0 0 1 6 0', 'M12 11l1.5-1.5'],
  tigela: ['M3 11h18a9 9 0 0 1-18 0z', 'M8 7c0-1.5 1-2 1-3M12 7c0-1.5 1-2 1-3M16 7c0-1.5 1-2 1-3'],
  bolo: ['M5 21V12h14v9', 'M3 21h18', 'M5 15c2 1.5 4.5 1.5 7 0s5-1.5 7 0', 'M12 12V8', 'M12 5.5v.5'],
  seta: ['M9 6l6 6-6 6'],
  busca: [{ cx: 11, cy: 11, r: 7 }, 'M20 20l-4-4'],
  vacina: ['M14 4l6 6-9 9-6-6z', 'M5 13l6 6'],
  capsula: ['M5 9h14a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6z', 'M12 9v6'],
  gota: ['M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z'],
  sacola: ['M6 8h12l-1 12H7z', 'M9 8V7a3 3 0 0 1 6 0v1'],
  pata: [
    { cx: 6, cy: 10, r: 1.8 },
    { cx: 10, cy: 6, r: 1.8 },
    { cx: 14, cy: 6, r: 1.8 },
    { cx: 18, cy: 10, r: 1.8 },
    'M12 12c-3 0-5 3-5 5.5 0 1.5 1.2 2.5 2.7 2.2l2.3-.5 2.3.5c1.5.3 2.7-.7 2.7-2.2 0-2.5-2-5.5-5-5.5z',
  ],
  compartilhar: [{ cx: 6, cy: 12, r: 2.5 }, { cx: 18, cy: 6, r: 2.5 }, { cx: 18, cy: 18, r: 2.5 }, 'M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6'],
  carro: ['M5 16v-4l2-5h10l2 5v4z', 'M5 16v2.5M19 16v2.5', 'M5 12h14', 'M8 14.5h.01M16 14.5h.01'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  documento: ['M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5', 'M9 13h6M9 17h6'],
  carteirinha: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', { cx: 9, cy: 11, r: 2 }, 'M6 16c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4', 'M14 10h4M14 14h4'],
  lapis: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  camera: ['M3 8h4l2-3h6l2 3h4v11H3z', { cx: 12, cy: 13, r: 3.5 }],
  cadeado: ['M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  mira: [{ cx: 12, cy: 12, r: 3 }, 'M12 2v3M12 19v3M2 12h3M19 12h3'],
  sair: ['M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4', 'M15 8l4 4-4 4', 'M19 12H9'],
  grade: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  semRede: ['M3 3l18 18', 'M8.5 16.4a5 5 0 0 1 7 0', 'M5 12.9a10 10 0 0 1 4.3-2.6', 'M14.7 10.3A10 10 0 0 1 19 12.9', 'M2 9.4a14.5 14.5 0 0 1 3.9-2.6', 'M10.3 5.6A14.5 14.5 0 0 1 22 9.4', 'M12 20h.01'],
  lupaMenos: [{ cx: 11, cy: 11, r: 7 }, 'M20 20l-4-4', 'M8 11h6'],
  engrenagem: [{ cx: 12, cy: 12, r: 3 }, 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1'],
  coracao: ['M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  navegador: [{ cx: 12, cy: 12, r: 8.5 }, 'M3.5 12h17', 'M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z'],
} as const;

export type NomeIcone = keyof typeof DESENHOS;

type Props = {
  nome: NomeIcone;
  size?: number;
  cor?: string;
  espessura?: number;
};

export function Icone({ nome, size = 18, cor = colors.black, espessura = 1.8 }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={espessura}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {DESENHOS[nome].map((forma, i) =>
        typeof forma === 'string' ? (
          <Path key={i} d={forma} />
        ) : (
          <Circle key={i} cx={forma.cx} cy={forma.cy} r={forma.r} />
        ),
      )}
    </Svg>
  );
}
