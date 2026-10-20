import Svg, { Path } from 'react-native-svg';
import type { CategoriaLugar } from './lugares';

type Props = {
  categoria: CategoriaLugar;
  tamanho?: number;
  cor?: string;
};

/** Traços do ícone de cada categoria (glifo único: pin, card e ficha). */
function caminhos(categoria: CategoriaLugar): string[] {
  switch (categoria) {
    case 'clinica':
      // Cruz médica.
      return ['M12 6.5v11', 'M6.5 12h11'];
    case 'banho_tosa':
      // Gota d'água.
      return ['M12 3.5c3.2 3.8 5.5 6.6 5.5 9a5.5 5.5 0 0 1-11 0c0-2.4 2.3-5.2 5.5-9z'];
    case 'petshop':
    default:
      // Sacola de compras.
      return ['M7.2 8.5h9.6l.9 10.5H6.3L7.2 8.5z', 'M9.5 8.5V7a2.5 2.5 0 0 1 5 0v1.5'];
  }
}

/** Ícone vetorial da categoria, no traço preto dos protótipos. */
export function GlifoLugar({ categoria, tamanho = 18, cor = '#111111' }: Props) {
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {caminhos(categoria).map((d) => (
        <Path key={d} d={d} />
      ))}
    </Svg>
  );
}
