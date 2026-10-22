import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pet encontrado",
  description: "Página pública do QR da coleira do PetLive. Ajude a devolver o pet para casa.",
  robots: { index: false, follow: false },
};

export default function LayoutEncontrado({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}