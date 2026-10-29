"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { carregarAcessoLojista, PAPEL_LOJA, type LojaDaConta } from "@/lib/lojista/acesso";
import { lojistaConfigurado, supabaseLojista } from "@/lib/lojista/supabase";

type Acesso = NonNullable<Awaited<ReturnType<typeof carregarAcessoLojista>>>;
const Contexto = createContext<{ loja: LojaDaConta | null; atualizar: () => void } | null>(null);
export function useLojaPainel() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useLojaPainel fora do painel da loja");
  return valor;
}
type Estado = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; acesso: Acesso };
export function PainelLojista({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [tentativa, setTentativa] = useState(0);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [erroSaida, setErroSaida] = useState<string | null>(null);
  function atualizar() { setEstado({ tipo: "carregando" }); setTentativa(n => n + 1); }
  useEffect(() => {
    if (!lojistaConfigurado) return;
    const cliente = supabaseLojista();
    let vivo = true, revisao = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function conferir() {
      const versao = ++revisao;
      await Promise.resolve();
      if (!vivo || versao !== revisao) return;
      setEstado({ tipo: "carregando" });
      try {
        const acesso = await carregarAcessoLojista(cliente);
        if (!vivo || versao !== revisao) return;
        if (!acesso) { router.replace("/lojista/entrar"); return; }
        setEstado({ tipo: "pronto", acesso });
      } catch (e) {
        if (vivo && versao === revisao) setEstado({ tipo: "erro", mensagem: e instanceof Error ? e.message : "Não foi possível conferir seu acesso." });
      }
    }
    const { data } = cliente.auth.onAuthStateChange(() => {
      // Esconde dados imediatamente; a consulta acontece fora do callback Auth.
      revisao++; setEstado({ tipo: "carregando" });
      clearTimeout(timer); timer = setTimeout(() => { void conferir(); }, 0);
    });
    const retomar = () => { if (document.visibilityState === "visible") void conferir(); };
    document.addEventListener("visibilitychange", retomar);
    void conferir();
    return () => { vivo = false; revisao++; clearTimeout(timer); data.subscription.unsubscribe(); document.removeEventListener("visibilitychange", retomar); };
  }, [router, tentativa]);

  async function sair() {
    if (saindo) return;
    setSaindo(true); setErroSaida(null);
    try {
      const { error } = await supabaseLojista().auth.signOut({ scope: "local" });
      if (error) throw error;
      setEstado({ tipo: "carregando" }); router.replace("/lojista/entrar");
    } catch { setErroSaida("Não foi possível sair. Confira a conexão e tente novamente."); }
    finally { setSaindo(false); }
  }
  if (!lojistaConfigurado) return <Mensagem titulo="Painel em preparação" texto="Este ambiente ainda não está conectado. Tente novamente mais tarde." />;
  if (estado.tipo === "carregando") return <div role="status" className="grid min-h-screen place-items-center bg-suave text-cinza">Conferindo seu acesso…</div>;
  if (estado.tipo === "erro") return <Mensagem titulo="Não foi possível abrir o painel" texto={estado.mensagem}><button onClick={atualizar} className="rounded-full bg-tinta px-6 py-3 font-bold text-white">Tentar novamente</button><Link href="/lojista/entrar" className="text-sm underline">Voltar para entrar</Link></Mensagem>;
  const { lojas, usuario } = estado.acesso;
  const loja = lojas.find(l => l.id === selecionada) ?? lojas[0] ?? null;
  return <Contexto.Provider value={{ loja, atualizar }}>
    <a href="#conteudo-lojista" className="sr-only focus:not-sr-only focus:p-3">Ir para o conteúdo</a>
    <div className="min-h-screen bg-suave lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col bg-tinta px-5 py-6 text-white lg:sticky lg:top-0 lg:h-screen">
        <Link href="/lojista" className="text-2xl font-extrabold tracking-tight">PetLive <span className="rounded-full bg-azul px-2 py-1 text-[10px] tracking-wider text-tinta">LOJISTA</span></Link>
        <p className="mt-2 text-xs text-white/60">Seu espaço de trabalho</p>
        <nav aria-label="Menu da loja" className="mt-7 flex flex-wrap gap-2 lg:flex-col">
          <Link href="/lojista" aria-current="page" className="rounded-2xl bg-azul px-4 py-3 text-sm font-bold text-tinta">Visão geral</Link>
          {["Solicitações", "Catálogo", "Agenda", "Configurações"].map(nome => <span key={nome} className="flex items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm text-white/50">{nome}<span className="text-[10px]">Em breve</span></span>)}
        </nav>
        <div className="mt-6 border-t border-white/15 pt-4 lg:mt-auto"><p className="break-all text-xs text-white/70">{usuario.email}</p><button onClick={sair} disabled={saindo} className="mt-3 rounded-full border border-white/30 px-5 py-2 text-sm font-semibold disabled:opacity-50">{saindo ? "Saindo…" : "Sair desta sessão"}</button>{erroSaida ? <p role="alert" className="mt-3 text-sm text-rosa-fundo">{erroSaida}</p> : null}</div>
      </aside>
      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-borda bg-white px-5 py-5 md:px-9">
          <div><p className="text-xs font-semibold text-cinza">Painel da loja</p><p className="mt-1 text-lg font-bold">{loja?.name ?? "Sua conta"}</p></div>
          {loja ? <label className="flex flex-col gap-1 text-xs font-semibold text-cinza">Loja vinculada<select aria-label="Selecionar loja" value={loja.id} onChange={e => setSelecionada(e.target.value)} className="max-w-full rounded-xl border border-borda bg-white p-2 text-sm text-tinta">{lojas.map(l => <option key={l.id} value={l.id}>{l.name} · {PAPEL_LOJA[l.role]}</option>)}</select></label> : null}
        </header>
        <main id="conteudo-lojista" className="mx-auto max-w-6xl px-5 py-8 md:px-9">{children}</main>
      </div>
    </div>
  </Contexto.Provider>;
}
function Mensagem({ titulo, texto, children }: { titulo: string; texto: string; children?: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-suave px-6"><div className="flex max-w-lg flex-col items-start gap-5 rounded-[28px] bg-white p-8"><p className="font-extrabold text-azul-escuro">PetLive · Lojista</p><h1 className="text-2xl font-bold">{titulo}</h1><p role="alert" className="text-cinza">{texto}</p>{children}<Link href="/lojistas" className="text-sm underline">Conhecer o PetLive para lojas</Link></div></main>;
}
