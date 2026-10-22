import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel PetLive" },
  // Painel interno: fora do Google.
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  return <>{children}</>;
}
