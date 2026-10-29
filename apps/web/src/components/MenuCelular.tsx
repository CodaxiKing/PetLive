"use client";

import Link from "next/link";

/**
 * Menu das telas menores que lg. Funciona sem script (é um <details>); com
 * script, fecha ao escolher um link, para a página descer até a seção sem o
 * menu aberto por cima.
 */
export function MenuCelular({ links }: { links: { rotulo: string; href: string }[] }) {
  return (
    <details className="group relative lg:hidden">
      <summary
        aria-label="Abrir menu"
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-full bg-[var(--tom)] [&::-webkit-details-marker]:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <nav
        aria-label="Menu"
        onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
        className={"absolute right-0 top-14 flex w-60 flex-col rounded-[var(--raio)] bg-[var(--papel)] p-2 group-open:shadow-[0_18px_40px_rgba(17,17,17,0.18)]" /* taste-skill-ignore: só o menu aberto, que flutua */}
      >
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-[var(--raio-p)] px-4 py-3 text-[16px] font-semibold hover:bg-[var(--tom)]">
            {link.rotulo}
          </Link>
        ))}
      </nav>
    </details>
  );
}
