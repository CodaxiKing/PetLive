import type { Metadata } from 'next';
import { Suspense } from 'react';
import PetEncontrado from './PetEncontrado';
export const metadata: Metadata = { title: 'Pet encontrado · PetLive', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function PaginaQr() {
  return <Suspense fallback={<main className="mx-auto max-w-lg px-6 py-12" role="status">Abrindo o QR…</main>}><PetEncontrado /></Suspense>;
}
