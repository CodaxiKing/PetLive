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
    case 'parque':
      // Árvore.
      return ['M12 3.5a5 5 0 0 1 5 5 4.5 4.5 0 0 1-5 4.5 4.5 4.5 0 0 1-5-4.5 5 5 0 0 1 5-5z', 'M12 13v7.5'];
    case 'praia':
      // Sol sobre as ondas.
      return ['M8 11a4 4 0 0 1 8 0', 'M4 15c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0 3.2-1.3 4.8 0', 'M4 19c1.6-1.3 3.2-1.3 4.8 0s3.2 1.3 4.8 0 3.2-1.3 4.8 0', 'M12 4v1.5'];
    case 'restaurante':
      // Garfo e faca.
      return ['M8 3.5v17', 'M5.5 3.5v4a2.5 2.5 0 0 0 5 0v-4', 'M16.5 20.5V3.5c-1.9 1-3 3.2-3 6v3h3'];
    case 'hotel':
      // Cama.
      return ['M3.5 18.5v-11', 'M3.5 14.5h17v4', 'M20.5 14.5v-2a3 3 0 0 0-3-3h-6v5', 'M7.5 11.5h.01'];
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
