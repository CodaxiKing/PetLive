import type { Metadata } from "next";

export const metadata: Metadata = {
  // A prévia do link não mostra nada do pet.
  title: "Cuidador temporário",
  description: "Acesso de cuidador enviado por um tutor pelo PetLive, com prazo.",
  robots: { index: false, follow: false },
};

export default function LayoutCuidador({ children }: LayoutProps<"/cuidador">) {
  return <>{children}</>;
}
