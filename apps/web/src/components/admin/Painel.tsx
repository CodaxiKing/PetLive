"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ROTULO_PAPEL, rpcAdmin, supabaseAdmin, type AdminEu, type Papel } from "@/lib/admin/supabase";

type Admin = Extract<AdminEu, { admin: true }>;
const ContextoAdmin = createContext<Admin | null>(null);

/** Admin da sessão (só existe dentro do painel, depois do 2FA). */
export function useAdmin(): Admin {
  const admin = useContext(ContextoAdmin);
  if (!admin) throw new Error("useAdmin fora do painel");
  return admin;
}

const ICONES: Record<string, string[]> = {
  visao: ["M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"],
  usuarios: ["M9 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z", "M3.5 19c.4-3.4 2.6-5 5.5-5s5.1 1.6 5.5 5", "M16.5 14.2c2.4.2 3.7 1.6 4 4.3"],
  equipe: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "M9 12l2 2 4-4"],
  suporte: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.4", "M12 17h.01"],
  moderacao: ["M6 21V4", "M6 5h11l-2 4 2 4H6"],
  lgpd: ["M6 11h12v9H6z", "M8.5 11V8a3.5 3.5 0 0 1 7 0v3"],
  relatorios: ["M4 20h16", "M7 16v-4", "M12 16V7", "M17 16v-7"],
  conteudo: ["M6 4h12v16H6z", "M9 8h6", "M9 12h6", "M9 16h3"],
  breve: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4l2.5 1.5"],
};

/** Áreas prontas; as demais do protótipo aparecem como "em breve". */
const AREAS: { rotulo: string; href?: string; icone: keyof typeof ICONES; papeis?: Papel[] }[] = [
  { rotulo: "Visão geral", href: "/admin", icone: "visao" },
  { rotulo: "Relatórios", href: "/admin/relatorios", icone: "relatorios", papeis: ["financeiro", "marketing", "leitura"] },
  { rotulo: "Assinaturas", icone: "breve" },
  { rotulo: "Planos e cupons", icone: "breve" },
  { rotulo: "Avaliações", icone: "breve" },
  { rotulo: "Usuários e pets", href: "/admin/usuarios", icone: "usuarios", papeis: ["suporte", "moderacao", "leitura"] },
  { rotulo: "Suporte", href: "/admin/suporte", icone: "suporte", papeis: ["suporte", "leitura"] },
  { rotulo: "Moderação", href: "/admin/moderacao", icone: "moderacao", papeis: ["moderacao", "leitura"] },
  { rotulo: "Campanhas", icone: "breve" },
  { rotulo: "Conteúdo mestre", href: "/admin/conteudo", icone: "conteudo" },
  { rotulo: "Integrações", icone: "breve" },
  { rotulo: "Sistema", icone: "breve" },
  { rotulo: "Privacidade e LGPD", href: "/admin/lgpd", icone: "lgpd", papeis: ["suporte", "leitura"] },
  { rotulo: "Equipe", href: "/admin/equipe", icone: "equipe", papeis: [] },
];

function Icone({ caminhos }: { caminhos: string[] }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/**
 * Moldura do painel (protótipo AdminVisao): menu preto à esquerda com as
 * áreas e o cartão de quem entrou. Sem sessão com 2FA, volta para Entrar.
 */
export function Painel({ children }: { children: ReactNode }) {
  const router = useRouter();
  const caminho = usePathname();
  const [admin, setAdmin] = useState<Admin | null>(null);

  useEffect(() => {
    let vivo = true;
    supabaseAdmin()
      .auth.getSession()
      .then(async ({ data }) => {
        if (!data.session) return router.replace("/admin/entrar");
        const eu = await rpcAdmin<AdminEu>("admin_eu").catch(() => ({ admin: false }) as AdminEu);
        if (!vivo) return;
        if (!eu.admin || !eu.verificado) return router.replace("/admin/entrar");
        setAdmin(eu);
      });
    return () => {
      vivo = false;
    };
  }, [router]);

  async function sair() {
    await supabaseAdmin().auth.signOut();
    router.replace("/admin/entrar");
  }

  if (!admin) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F5F6FA] text-sm text-cinza">Conferindo o acesso…</div>;
  }

  const pode = (papeis?: Papel[]) => !papeis || admin.papel === "super" || papeis.includes(admin.papel);

  return (
    <ContextoAdmin.Provider value={admin}>
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <aside className="sticky top-0 flex h-screen w-60 flex-none flex-col gap-0.5 overflow-y-auto bg-tinta px-4 py-5 text-white">
          <p className="flex items-center gap-2.5 px-2 pb-2.5 text-xl font-extrabold tracking-tight">
            PetLive <span className="rounded-full bg-roxo-fundo px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-tinta">ADMIN</span>
          </p>
          {AREAS.filter((a) => pode(a.papeis)).map((area) => {
            const ativa = area.href && (area.href === "/admin" ? caminho === "/admin" : caminho.startsWith(area.href));
            const classe = "flex h-8 items-center gap-3 rounded-[14px] px-3.5 text-[13px]";
            return area.href ? (
              <Link key={area.rotulo} href={area.href} className={`${classe} ${ativa ? "bg-azul font-bold text-tinta" : "font-semibold text-[#C9D0DB] hover:text-white"}`}>
                <Icone caminhos={ICONES[area.icone]} />
                {area.rotulo}
              </Link>
            ) : (
              <span key={area.rotulo} title="Chega na próxima etapa" className={`${classe} cursor-default font-semibold text-[#5E6878]`}>
                <Icone caminhos={ICONES.breve} />
                {area.rotulo}
                <span className="ml-auto text-[10px] uppercase tracking-wider">breve</span>
              </span>
            );
          })}
          <div className="mt-auto flex items-center gap-2.5 rounded-[18px] bg-[#1E1E1E] p-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-roxo-fundo font-extrabold text-tinta">
              {admin.nome.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">{admin.nome}</p>
              <p className="text-[11px] text-azul">{ROTULO_PAPEL[admin.papel]}</p>
            </div>
            <button onClick={sair} title="Sair" aria-label="Sair do painel" className="text-[#C9D0DB] hover:text-white">
              <Icone caminhos={["M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4", "M15 8l4 4-4 4", "M19 12H9"]} />
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
      </div>
    </ContextoAdmin.Provider>
  );
}

/** Cabeçalho das páginas: título, subtítulo e ações à direita. */
export function Cabecalho({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3.5">
      <div className="min-w-0 flex-1">
        <h1 className="text-[32px] font-medium tracking-tight">{titulo}</h1>
        {subtitulo ? <p className="mt-0.5 text-[13px] text-[#6A7484]">{subtitulo}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** Cartão de número (KPI) do protótipo: fundo pastel, rótulo, valor grande e linha de apoio. */
export function CartaoNumero({ rotulo, valor, apoio, fundo, cor }: { rotulo: string; valor: string; apoio?: string; fundo: string; cor: string }) {
  return (
    <div className={`rounded-[28px] p-5 ${fundo}`}>
      <p className={`text-xs font-bold ${cor}`}>{rotulo}</p>
      <p className="mt-2 text-[34px] font-medium leading-none tracking-tight">{valor}</p>
      {apoio ? <p className={`mt-2 text-xs font-semibold ${cor}`}>{apoio}</p> : null}
    </div>
  );
}

export const numero = (n: number | null | undefined) => (n ?? 0).toLocaleString("pt-BR");

/** "hoje", "ontem", "há 3 dias" ou a data. */
export function haQuanto(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
