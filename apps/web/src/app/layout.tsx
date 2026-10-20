import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://petlive.app.br"),
  title: {
    default: "PetLive — a saúde do seu pet, sempre em dia",
    template: "%s · PetLive",
  },
  description:
    "Carteira de saúde do pet, lembretes de vacinas e remédios, clínicas por perto e serviços com horário marcado.",
  openGraph: {
    locale: "pt_BR",
    type: "website",
    siteName: "PetLive",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Cabecalho />
        <main className="flex-1">{children}</main>
        <Rodape />
      </body>
    </html>
  );
}
