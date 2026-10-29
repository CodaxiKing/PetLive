import Image, { type ImageProps, type StaticImageData } from "next/image";
import caoDormindo from "../../../public/fotos/cao-dormindo.jpg";
import consulta from "../../../public/fotos/consulta.jpg";
import gatoJanela from "../../../public/fotos/gato-janela.jpg";
import noite from "../../../public/fotos/noite.jpg";
import passeio from "../../../public/fotos/passeio.jpg";
import tutora from "../../../public/fotos/tutora.jpg";
import tutoraCelular from "../../../public/fotos/tutora-celular.jpg";

const FOTOS: Record<string, StaticImageData> = {
  "/fotos/cao-dormindo.jpg": caoDormindo,
  "/fotos/consulta.jpg": consulta,
  "/fotos/gato-janela.jpg": gatoJanela,
  "/fotos/noite.jpg": noite,
  "/fotos/passeio.jpg": passeio,
  "/fotos/tutora.jpg": tutora,
  "/fotos/tutora-celular.jpg": tutoraCelular,
};

/**
 * Foto do site. Fora da primeira tela ela só carrega quando chega perto
 * (lazy, o padrão do next/image) e, enquanto isso, mostra uma versão
 * desfocada dela mesma em vez de um buraco. `desliza` faz a foto andar um
 * pouco mais devagar que a página dentro da moldura.
 */
export function Foto({
  src,
  alt,
  desliza = false,
  className = "",
  ...props
}: Omit<ImageProps, "src"> & { src: string; desliza?: boolean }) {
  const estatica = FOTOS[src];
  return (
    <Image
      src={estatica ?? src}
      alt={alt}
      placeholder={estatica ? "blur" : "empty"}
      className={`${className} ${desliza ? "foto-desliza" : ""}`}
      {...props}
    />
  );
}
