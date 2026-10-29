import { Cabecalho } from "@/components/Cabecalho";
import { ConsentimentoCookies } from "@/components/ConsentimentoCookies";
import { Rodape } from "@/components/Rodape";
import { Revelar } from "@/components/site/Revelar";

/** Site para tutores: cabeçalho, rodapé em blocos e as entradas das seções. */
export default function LayoutTutor({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* Aviso de cookies como faixa no topo: não cobre o conteúdo. */}
      <ConsentimentoCookies />
      <Cabecalho />
      <main className="flex-1">{children}</main>
      <Rodape />
      <Revelar />
    </>
  );
}
