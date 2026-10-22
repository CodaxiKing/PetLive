import type { Metadata } from "next";

export const metadata: Metadata = {
  // A prévia do WhatsApp não mostra nada do pet: os dados só aparecem
  // para quem abre o link.
  title: "Ficha do pet",
  description: "Ficha do pet enviada por um tutor pelo PetLive. O link vale por tempo limitado.",
  robots: { index: false, follow: false },
};

export default function LayoutFicha({ children }: LayoutProps<"/ficha">) {
  return <>{children}</>;
}
