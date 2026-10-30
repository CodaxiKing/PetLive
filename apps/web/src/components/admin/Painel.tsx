"use client";

import Link from "next/link";
import Image from "next/image";
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
  sistema: ["M3 12h4l2-6 4 12 2-6h6"],
  financeiro: ["M3 7h18v12H3z", "M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M6 10v.01M18 16v.01"],
  campanhas: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  avaliacoes: ["M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"],
  breve: ["M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z", "M12 8v4l2.5 1.5"],
};

/** Áreas prontas; as demais do protótipo aparecem como "em breve". */
const AREAS: { rotulo: string; href?: string; icone: keyof typeof ICONES; papeis?: Papel[] }[] = [
  { rotulo: "Visão geral", href: "/admin", icone: "visao" },
  { rotulo: "Relatórios", href: "/admin/relatorios", icone: "relatorios", papeis: ["financeiro", "marketing", "leitura"] },
  { rotulo: "Assinaturas", href: "/admin/assinaturas", icone: "financeiro", papeis: ["financeiro", "leitura"] },
  { rotulo: "Planos e cupons", href: "/admin/planos", icone: "financeiro", papeis: ["financeiro", "leitura"] },
  { rotulo: "Financeiro", href: "/admin/financeiro", icone: "financeiro", papeis: ["financeiro", "leitura"] },
  { rotulo: "Usuários e pets", href: "/admin/usuarios", icone: "usuarios", papeis: ["suporte", "moderacao", "leitura"] },
  { rotulo: "Lojistas", href: "/admin/lojistas", icone: "moderacao", papeis: ["moderacao", "suporte", "leitura"] },
  { rotulo: "Suporte", href: "/admin/suporte", icone: "suporte", papeis: ["suporte", "leitura"] },
  { rotulo: "Equipe", href: "/admin/equipe", icone: "equipe", papeis: [] },
  { rotulo: "Avaliações", href: "/admin/avaliacoes", icone: "avaliacoes", papeis: ["suporte", "marketing", "leitura"] },
  { rotulo: "Moderação", href: "/admin/moderacao", icone: "moderacao", papeis: ["moderacao", "leitura"] },
  { rotulo: "Eventos", href: "/admin/eventos", icone: "moderacao", papeis: ["moderacao", "leitura"] },
  { rotulo: "Adoção e ONGs", href: "/admin/adocao", icone: "moderacao", papeis: ["moderacao", "leitura"] },
  { rotulo: "Campanhas", href: "/admin/campanhas", icone: "campanhas", papeis: ["marketing", "leitura"] },
  { rotulo: "Conteúdo mestre", href: "/admin/conteudo", icone: "conteudo" },
  { rotulo: "Integrações", href: "/admin/integracoes", icone: "sistema", papeis: ["leitura"] },
  { rotulo: "Sistema", href: "/admin/sistema", icone: "sistema" },
  { rotulo: "Privacidade e LGPD", href: "/admin/lgpd", icone: "lgpd", papeis: ["suporte", "leitura"] },
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
    return <div className="flex min-h-screen items-center justify-center bg-suave text-sm text-cinza">Conferindo o acesso…</div>;
  }

  const pode = (papeis?: Papel[]) => !papeis || admin.papel === "super" || papeis.includes(admin.papel);

  return (
    <ContextoAdmin.Provider value={admin}>
      <div className="admin-v2 flex min-h-screen bg-suave">
        <aside aria-label="Navegação administrativa" className="sticky top-0 flex h-screen w-[232px] flex-none flex-col gap-0.5 overflow-y-auto bg-tinta px-4 py-5 text-white">
          <Link href="/admin" className="admin-marca">
            <Image src="/logo-petlive.png" alt="" width={36} height={36} />
            <span><b>PetLive</b><small>Painel admin</small></span>
          </Link>
          <nav className="admin-navegacao" aria-label="Áreas do painel">
          {[
            { nome: "Visão", itens: ["Visão geral", "Relatórios"] },
            { nome: "Receita", itens: ["Assinaturas", "Planos e cupons", "Financeiro"] },
            { nome: "Pessoas", itens: ["Usuários e pets", "Lojistas", "Suporte", "Equipe"] },
            { nome: "Conteúdo", itens: ["Avaliações", "Moderação", "Eventos", "Adoção e ONGs", "Campanhas", "Conteúdo mestre"] },
            { nome: "Sistema", itens: ["Integrações", "Sistema", "Privacidade e LGPD"] },
          ].map(grupo => {
            const areas = AREAS.filter(area => grupo.itens.includes(area.rotulo) && pode(area.papeis));
            if (!areas.length) return null;
            const atual = (href?: string) => Boolean(href && (href === "/admin" ? caminho === href : caminho.startsWith(href)));
            return <details key={`${grupo.nome}:${caminho}`} className="admin-menu-dropdown" open={areas.some(area => atual(area.href))}>
              <summary>{grupo.nome}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
              <div className="admin-menu-links">{areas.map(area => area.href ? <Link key={area.rotulo} href={area.href} aria-current={atual(area.href) ? "page" : undefined} className={`flex h-8 items-center gap-3 rounded-full px-3.5 text-[13px] ${atual(area.href) ? "bg-azul font-bold text-tinta" : "font-semibold text-[#C9D0DB] hover:text-white"}`}><Icone caminhos={ICONES[area.icone]} />{area.rotulo}</Link> : null)}</div>
            </details>;
          })}
          </nav>
          <div className="mt-auto flex items-center gap-2.5 rounded-[18px] bg-[#182336] p-3">
            <span className="flex h-[38px] w-[38px] items-center justify-center rounded-xl bg-roxo-fundo font-extrabold text-tinta">
              {admin.nome.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">{admin.nome}</p>
              <p className="text-[11px] text-azul">{ROTULO_PAPEL[admin.papel]}</p>
            </div>
            <button onClick={sair} title="Sair" aria-label="Sair do painel" className="admin-sair text-[#C9D0DB] hover:text-white">
              <Icone caminhos={["M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4", "M15 8l4 4-4 4", "M19 12H9"]} />
              <span>Sair</span>
            </button>
          </div>
        </aside>
        <main className="admin-v2-conteudo min-w-0 flex-1"><div className="admin-rota" key={caminho}>{children}</div></main>
      </div>
    </ContextoAdmin.Provider>
  );
}

/** Cabeçalho das páginas: título, subtítulo e ações à direita. */
export function Cabecalho({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <header className="admin-cabecalho">
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] font-bold tracking-tight">{titulo}</h1>
        {subtitulo ? <p className="mt-0.5 text-[13px] text-[#6A7484]">{subtitulo}</p> : null}
      </div>
      <div className="admin-cabecalho-acoes">{children}</div>
    </header>
  );
}

/** Cartão de número (KPI) do protótipo: fundo pastel, rótulo, valor grande e linha de apoio. */
export function CartaoNumero({ rotulo, valor, apoio, cor }: { rotulo: string; valor: string; apoio?: string; fundo: string; cor: string }) {
  return (
    <div className="admin-kpi">
      <p className="admin-kpi-rotulo">{rotulo}</p>
      <p className="mt-2 text-[28px] font-bold leading-none tracking-tight">{valor}</p>
      {apoio ? <p className={`admin-kpi-apoio ${cor}`}>{apoio}</p> : null}
    </div>
  );
}

/** Empty detail panels keep a clear next step while no record is selected. */
export function EstadoPainel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <div className="admin-estado"><span className="admin-estado-icone" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h4"/></svg></span><h2>{titulo}</h2><p>{children}</p></div>;
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
