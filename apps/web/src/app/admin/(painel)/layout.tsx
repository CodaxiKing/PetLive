import { Painel } from "@/components/admin/Painel";

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  return <Painel>{children}</Painel>;
}
