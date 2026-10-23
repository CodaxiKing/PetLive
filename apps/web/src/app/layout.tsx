import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://petlive.app"),
  title: {
    default: "PetLive — a saúde do seu pet, sempre em dia",
    template: "%s · PetLive",
  },
  description:
    "Carteira de saúde do pet, lembretes de vacinas e remédios, clínicas por perto e serviços com horário marcado.",
  keywords: [
    "carteira de vacinação do pet",
    "lembrete de vacina",
    "remédio do cachorro",
    "clínica veterinária 24 horas Rio de Janeiro",
    "app para tutores de cães e gatos",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    locale: "pt_BR",
    type: "website",
    siteName: "PetLive",
    url: "/",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
