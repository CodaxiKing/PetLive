import { Suspense } from "react";
import Ficha from "./Ficha";

export default function FichaPagina() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-cinza">Abrindo a carteirinha…</main>}>
      <Ficha />
    </Suspense>
  );
}
