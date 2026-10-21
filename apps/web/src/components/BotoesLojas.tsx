/**
 * Botões das lojas de apps (board [WEB] "Site: botões de download das lojas
 * de apps e SEO"). Os links vêm do ambiente; enquanto o app não estiver
 * publicado, o botão aparece com "Em breve" e não é clicável.
 */
export const URL_GOOGLE_PLAY = process.env.NEXT_PUBLIC_URL_GOOGLE_PLAY;
export const URL_APP_STORE = process.env.NEXT_PUBLIC_URL_APP_STORE;

function Seta({ cor }: { cor: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={cor} aria-hidden="true">
      <path d="M7 3l12 9-12 9z" />
    </svg>
  );
}

function Botao({
  href,
  rotulo,
  escuro,
}: {
  href: string | undefined;
  rotulo: string;
  escuro: boolean;
}) {
  const classe = escuro
    ? "bg-tinta pl-3.5 pr-6.5 text-white"
    : "bg-fundo pl-3.5 pr-6";
  const conteudo = (
    <>
      <span
        className={`flex h-9.5 w-9.5 items-center justify-center rounded-full ${escuro ? "bg-azul" : "bg-tinta"}`}
      >
        <Seta cor={escuro ? "#111" : "#9AD6F8"} />
      </span>
      {rotulo}
      {href ? null : (
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${escuro ? "bg-white/15" : "bg-white"}`}
        >
          Em breve
        </span>
      )}
    </>
  );

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={`flex h-16 cursor-default items-center gap-3 rounded-full text-[15px] font-bold ${classe}`}
      >
        {conteudo}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-16 items-center gap-3 rounded-full text-[15px] font-bold transition-transform hover:-translate-y-0.5 active:scale-[0.97] ${classe}`}
    >
      {conteudo}
    </a>
  );
}

export function BotoesLojas() {
  return (
    <div className="mt-9 flex flex-wrap gap-3.5">
      <Botao href={URL_GOOGLE_PLAY} rotulo="Baixar no Google Play" escuro />
      <Botao href={URL_APP_STORE} rotulo="Baixar na App Store" escuro={false} />
    </div>
  );
}
