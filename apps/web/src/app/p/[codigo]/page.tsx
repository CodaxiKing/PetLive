import { Suspense } from "react";
import Encontrado from "./Encontrado";

export default function EncontradoPagina() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-cinza">Abrindo a página do QR…</main>}>
      <Encontrado />
    </Suspense>
  );
}