import type { Metadata } from "next";
export const metadata: Metadata = { title: { default: "Painel da loja", template: "%s · Loja PetLive" }, robots: { index: false, follow: false } };
export default function LayoutLojista({ children }: { children: React.ReactNode }) { return <>{children}</>; }
