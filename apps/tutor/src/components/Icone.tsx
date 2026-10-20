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
