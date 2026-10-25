import { Suspense } from "react";
import Convite from "./Convite";

export default function ConvitePagina() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-suave text-sm text-cinza">Abrindo o convite…</main>}>
      <Convite />
    </Suspense>
  );
}
