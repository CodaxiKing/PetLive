import type { Metadata } from "next";

export const metadata: Metadata = {
  // A prévia do WhatsApp não mostra quem convidou nem os pets.
  title: "Convite do PetLive",
  description: "Convite para dividir os cuidados de um pet no PetLive.",
  robots: { index: false, follow: false },
};

export default function LayoutConvite({ children }: LayoutProps<"/convite">) {
  return <>{children}</>;
}
