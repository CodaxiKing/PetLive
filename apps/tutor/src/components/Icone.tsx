import type { IconProps } from 'phosphor-react-native';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { Book } from 'phosphor-react-native/src/icons/Book';
import { BowlFood } from 'phosphor-react-native/src/icons/BowlFood';
import { Cake } from 'phosphor-react-native/src/icons/Cake';
import { Calculator } from 'phosphor-react-native/src/icons/Calculator';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { Car } from 'phosphor-react-native/src/icons/Car';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { Crosshair } from 'phosphor-react-native/src/icons/Crosshair';
import { Drop } from 'phosphor-react-native/src/icons/Drop';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { Flag } from 'phosphor-react-native/src/icons/Flag';
import { Flask } from 'phosphor-react-native/src/icons/Flask';
import { GearSix } from 'phosphor-react-native/src/icons/GearSix';
import { Globe } from 'phosphor-react-native/src/icons/Globe';
import { Handbag } from 'phosphor-react-native/src/icons/Handbag';
import { Heart } from 'phosphor-react-native/src/icons/Heart';
import { House } from 'phosphor-react-native/src/icons/House';
import { IdentificationCard } from 'phosphor-react-native/src/icons/IdentificationCard';
import { LockSimple } from 'phosphor-react-native/src/icons/LockSimple';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MagnifyingGlassMinus } from 'phosphor-react-native/src/icons/MagnifyingGlassMinus';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';
import { PawPrint } from 'phosphor-react-native/src/icons/PawPrint';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Phone } from 'phosphor-react-native/src/icons/Phone';
import { Pill } from 'phosphor-react-native/src/icons/Pill';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { Scales } from 'phosphor-react-native/src/icons/Scales';
import { ShareNetwork } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShieldCheck } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SignOut } from 'phosphor-react-native/src/icons/SignOut';
import { SquaresFour } from 'phosphor-react-native/src/icons/SquaresFour';
import { Syringe } from 'phosphor-react-native/src/icons/Syringe';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { WifiSlash } from 'phosphor-react-native/src/icons/WifiSlash';
import type { ComponentType } from 'react';
import { colors } from '../theme/colors';

/**
 * Ícones das telas, da biblioteca Phosphor (versão 2 do protótipo).
 * Os nomes em português continuam os mesmos de antes, então as telas não
 * mudam. Cada ícone é importado pelo caminho próprio para o Metro não
 * carregar a biblioteca inteira.
 */
const DESENHOS = {
  escudo: ShieldCheck,
  casa: House,
  sino: Bell,
  local: MapPin,
  pessoas: Users,
  livro: Book,
  bandeira: Flag,
  telefone: Phone,
  rota: NavigationArrow,
  cruz: Plus,
  alerta: Warning,
  frasco: Flask,
  calculadora: Calculator,
  relogio: Clock,
  balanca: Scales,
  tigela: BowlFood,
  bolo: Cake,
  seta: CaretRight,
  busca: MagnifyingGlass,
  vacina: Syringe,
  capsula: Pill,
  gota: Drop,
  sacola: Handbag,
  pata: PawPrint,
  compartilhar: ShareNetwork,
  carro: Car,
  check: Check,
  documento: FileText,
  carteirinha: IdentificationCard,
  lapis: PencilSimple,
  camera: Camera,
  cadeado: LockSimple,
  mira: Crosshair,
  sair: SignOut,
  grade: SquaresFour,
  semRede: WifiSlash,
  lupaMenos: MagnifyingGlassMinus,
  engrenagem: GearSix,
  coracao: Heart,
  navegador: Globe,
} satisfies Record<string, ComponentType<IconProps>>;

export type NomeIcone = keyof typeof DESENHOS;

type Props = {
  nome: NomeIcone;
  size?: number;
  cor?: string;
  /** Traço mais grosso (2.2 ou mais) vira o peso "bold" do Phosphor. */
  espessura?: number;
};

export function Icone({ nome, size = 18, cor = colors.black, espessura = 1.8 }: Props) {
  const Desenho = DESENHOS[nome];
  return <Desenho size={size} color={cor} weight={espessura >= 2.2 ? 'bold' : 'regular'} aria-hidden />;
}
