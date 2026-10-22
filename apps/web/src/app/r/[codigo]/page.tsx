import { Suspense } from "react";
import QRPublica from "./QRPublica";

export default function QRPaginaPublica() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center text-sm text-cinza">Abrindo a página do QR…</main>}>
      <QRPublica />
    </Suspense>
  );
}