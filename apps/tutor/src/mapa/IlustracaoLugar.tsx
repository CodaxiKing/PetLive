import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import type { CategoriaLugar } from './lugares';

/**
 * Ilustração do lugar nos pins e no cartão do mapa (protótipo Mapa: "cada
 * um com a foto do local"). Sem foto do Google, cada categoria tem a sua.
 */
export function IlustracaoLugar({ categoria, tamanho }: { categoria: CategoriaLugar; tamanho: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 48 48" aria-hidden>
      {desenho(categoria)}
    </Svg>
  );
}

function desenho(categoria: CategoriaLugar) {
  switch (categoria) {
    case 'clinica':
      return (
        <>
          <Rect width={48} height={48} fill="#CFE8FB" />
          <Rect y={34} width={48} height={14} fill="#B9D9A8" />
          <Rect x={9} y={14} width={30} height={24} rx={2} fill="#fff" />
          <Rect x={9} y={14} width={30} height={5} fill="#7CC8F0" />
          <Path d="M24 22v8M20 26h8" stroke="#E5484D" strokeWidth={3} strokeLinecap="round" />
          <Rect x={21} y={31} width={6} height={7} fill="#A9DCF6" />
        </>
      );
    case 'banho_tosa':
      return (
        <>
          <Rect width={48} height={48} fill="#E3F3FC" />
          <Circle cx={14} cy={14} r={5} fill="#fff" />
          <Circle cx={34} cy={10} r={3.5} fill="#fff" />
          <Circle cx={38} cy={22} r={4.5} fill="#fff" />
          <Ellipse cx={24} cy={38} rx={16} ry={6} fill="#7CC8F0" />
          <Ellipse cx={24} cy={31} rx={9} ry={8} fill="#EDB878" />
          <Circle cx={24} cy={25} r={7} fill="#EDB878" />
          <Circle cx={21} cy={24} r={1.3} fill="#2A211C" />
          <Circle cx={27} cy={24} r={1.3} fill="#2A211C" />
          <Ellipse cx={24} cy={27.5} rx={2} ry={1.4} fill="#2A211C" />
          <Circle cx={18} cy={20} r={3} fill="#fff" />
          <Circle cx={30} cy={19} r={3.4} fill="#fff" />
        </>
      );
    case 'petshop':
      return (
        <>
          <Rect width={48} height={48} fill="#FFF1C9" />
          <Rect y={36} width={48} height={12} fill="#D9C79A" />
          <Rect x={8} y={16} width={32} height={22} fill="#fff" />
          <Path d="M6 16h36l-3-8H9z" fill="#E88F45" />
          <Path d="M12 8l-3 8M20 8l-2 8M28 8l1 8M36 8l2 8" stroke="#fff" strokeWidth={2.4} />
          <Rect x={13} y={22} width={12} height={10} rx={1.5} fill="#CFE8FB" />
          <Rect x={29} y={24} width={6} height={14} fill="#8A6A4A" />
        </>
      );
    case 'creche':
      return (
        <>
          <Rect width={48} height={48} fill="#DDF3E6" />
          <Rect y={30} width={48} height={18} fill="#9ACD8E" />
          <Circle cx={40} cy={9} r={5} fill="#FFD966" />
          <Ellipse cx={24} cy={29} rx={9} ry={7} fill="#EDB878" />
          <Circle cx={24} cy={21} r={8} fill="#EDB878" />
          <Path d="M16 17c-4 2-4 9-2 11M32 17c4 2 4 9 2 11" stroke="#B97A3C" strokeWidth={4} strokeLinecap="round" fill="none" />
          <Circle cx={21} cy={20} r={1.4} fill="#2A211C" />
          <Circle cx={27} cy={20} r={1.4} fill="#2A211C" />
          <Ellipse cx={24} cy={24} rx={2.2} ry={1.6} fill="#2A211C" />
        </>
      );
    case 'hotelzinho':
      return (
        <>
          <Rect width={48} height={48} fill="#EBDDFB" />
          <Rect y={36} width={48} height={12} fill="#C9B1EA" />
          <Path d="M6 24L24 9l18 15z" fill="#B3478B" />
          <Rect x={10} y={24} width={28} height={14} fill="#fff" />
          <Rect x={14} y={27} width={7} height={7} fill="#FFD966" />
          <Rect x={27} y={27} width={7} height={7} fill="#FFD966" />
          <Rect x={21} y={30} width={6} height={8} fill="#7A5A9A" />
        </>
      );
    case 'parque':
      return (
        <>
          <Rect width={48} height={48} fill="#CFE8FB" />
          <Rect y={32} width={48} height={16} fill="#9ACD8E" />
          <Rect x={22} y={24} width={4} height={14} fill="#8A6A4A" />
          <Circle cx={24} cy={18} r={10} fill="#5FAF6E" />
          <Circle cx={17} cy={23} r={6} fill="#5FAF6E" />
          <Circle cx={31} cy={23} r={6} fill="#5FAF6E" />
          <Circle cx={10} cy={10} r={4} fill="#FFD966" />
        </>
      );
    case 'praia':
      return (
        <>
          <Rect width={48} height={48} fill="#CFE8FB" />
          <Circle cx={36} cy={12} r={6} fill="#FFD966" />
          <Rect y={26} width={48} height={10} fill="#7CC8F0" />
          <Path d="M0 28c4-2 8-2 12 0s8 2 12 0 8-2 12 0 8 2 12 0" stroke="#fff" strokeWidth={2} fill="none" />
          <Rect y={36} width={48} height={12} fill="#F3DCA8" />
        </>
      );
    case 'restaurante':
      return (
        <>
          <Rect width={48} height={48} fill="#FFF1C9" />
          <Rect y={36} width={48} height={12} fill="#D9C79A" />
          <Path d="M6 14h36l-3-7H9z" fill="#E5484D" />
          <Path d="M13 7l-2 7M21 7l-1 7M28 7l1 7M35 7l2 7" stroke="#fff" strokeWidth={2.2} />
          <Rect x={10} y={26} width={28} height={3} rx={1.5} fill="#8A6A4A" />
          <Rect x={14} y={29} width={3} height={9} fill="#8A6A4A" />
          <Rect x={31} y={29} width={3} height={9} fill="#8A6A4A" />
          <Circle cx={24} cy={22} r={4} fill="#fff" />
        </>
      );
    case 'hotel':
      return (
        <>
          <Rect width={48} height={48} fill="#EBDDFB" />
          <Rect y={38} width={48} height={10} fill="#C9B1EA" />
          <Rect x={12} y={8} width={24} height={30} fill="#fff" />
          <Rect x={16} y={12} width={6} height={5} fill="#A9DCF6" />
          <Rect x={26} y={12} width={6} height={5} fill="#A9DCF6" />
          <Rect x={16} y={21} width={6} height={5} fill="#A9DCF6" />
          <Rect x={26} y={21} width={6} height={5} fill="#A9DCF6" />
          <Rect x={21} y={30} width={6} height={8} fill="#7A5A9A" />
        </>
      );
  }
}
