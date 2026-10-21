import { Cabecalho } from "@/components/Cabecalho";
import { Rodape } from "@/components/Rodape";

/** Site para tutores: cabeçalho e rodapé do protótipo SitePetLive. */
export default function LayoutTutor({ children }: LayoutProps<"/">) {
  return (
    <>
      <Cabecalho />
      <main className="flex-1">{children}</main>
      <Rodape />
    </>
  );
}
