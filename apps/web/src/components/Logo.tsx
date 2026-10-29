import Image from "next/image";
import Link from "next/link";

/** Marca PetLive: o logo oficial do app (o P com a pata) e o nome. */
export function Logo({ tamanho = 36 }: { tamanho?: number }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-[22px] font-extrabold tracking-tight"
      aria-label="PetLive, página inicial"
    >
      <Image src="/logo-petlive.png" alt="" width={tamanho} height={tamanho} priority />
      <span>PetLive</span>
    </Link>
  );
}
