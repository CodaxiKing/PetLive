import { Suspense } from "react";
import Cuidador from "./Cuidador";

export default function CuidadorPagina() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-cinza">Abrindo…</main>}>
      <Cuidador />
    </Suspense>
  );
}
