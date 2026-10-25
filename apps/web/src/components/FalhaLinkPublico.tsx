"use client";

export function FalhaLinkPublico({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-suave px-6 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-amarelo-fundo text-3xl" aria-hidden="true">
        !
      </span>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">Não foi possível abrir este link</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-cinza">
        Houve uma falha de conexão ao consultar o PetLive. Confira a internet e tente novamente. Isso não quer dizer que o link expirou.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 flex h-12 items-center rounded-full bg-tinta px-8 text-[15px] font-bold text-white"
      >
        Tentar novamente
      </button>
    </main>
  );
}
