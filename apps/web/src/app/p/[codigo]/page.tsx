import type { Metadata } from 'next';
import PetEncontrado from './PetEncontrado';
export const metadata: Metadata = { title: 'Pet encontrado · PetLive', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function PaginaQr() { return <PetEncontrado />; }
