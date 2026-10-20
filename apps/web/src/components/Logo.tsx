import Link from "next/link";

/** Marca PetLive: pata preta com almofadas azuis (mesma do protótipo). */
export function Logo({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight"
      aria-label="PetLive, página inicial"
    >
      <span
        className="flex items-center justify-center rounded-full bg-tinta"
        style={{ width: tamanho, height: tamanho }}
      >
        <svg
          width={tamanho * 0.55}
          height={tamanho * 0.55}
          viewBox="0 0 24 24"
          fill="#9AD6F8"
          aria-hidden="true"
        >
          <circle cx="6" cy="10" r="1.9" />
          <circle cx="10" cy="6" r="1.9" />
          <circle cx="14" cy="6" r="1.9" />
          <circle cx="18" cy="10" r="1.9" />
          <path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
        </svg>
      </span>
      <span>PetLive</span>
    </Link>
  );
}
