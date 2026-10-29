"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lojistaConfigurado, supabaseLojista } from "@/lib/lojista/supabase";
export default function EntrarLojista() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState<string | null>(null);
  const trava = useRef(false);
  useEffect(() => {
    if (!lojistaConfigurado) return;
    let vivo = true;
    void supabaseLojista().auth.getSession().then(({ data, error }) => { if (vivo && !error && data.session) router.replace("/lojista"); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [router]);
  async function entrar(e: FormEvent) {
    e.preventDefault(); if (trava.current || !lojistaConfigurado) return;
    trava.current = true; setOcupado(true); setErro(null);
    try {
      const { error } = await supabaseLojista().auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw error;
      setSenha(""); router.replace("/lojista");
    } catch { setErro("Não foi possível entrar. Confira seu e-mail, senha e conexão. Se criou a conta agora, confira também a confirmação por e-mail."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <main className="grid min-h-screen bg-suave lg:grid-cols-2">
    <section className="flex flex-col justify-between rounded-b-[40px] bg-azul-hero px-7 py-9 lg:rounded-b-none lg:rounded-r-[64px] lg:p-16"><Link href="/" className="text-3xl font-extrabold tracking-tight">PetLive</Link><div className="my-12 max-w-lg"><p className="text-sm font-bold uppercase tracking-widest text-azul-texto">Painel do lojista</p><h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight lg:text-6xl">Sua loja,<br />mais perto.</h1><p className="mt-6 max-w-md text-lg leading-relaxed text-azul-texto">Um espaço para acompanhar seu cadastro e organizar os próximos passos da sua loja no PetLive.</p></div><Link href="/lojistas" className="text-sm font-semibold text-azul-texto underline">Conheça o PetLive para lojas</Link></section>
    <section className="flex items-center justify-center px-6 py-12 lg:p-16"><div className="w-full max-w-md rounded-[32px] bg-white p-7 md:p-10"><h2 className="text-3xl font-semibold tracking-tight">Entre na sua conta</h2><p className="mt-3 text-sm leading-relaxed text-cinza">Use o e-mail da conta vinculada à sua loja.</p>{!lojistaConfigurado ? <p role="status" className="mt-5 rounded-2xl bg-amarelo-fundo p-4 text-sm text-amarelo-texto">O painel ainda não está conectado neste ambiente. Tente novamente mais tarde.</p> : null}
      <form onSubmit={entrar} className="mt-7 space-y-5"><fieldset disabled={ocupado || !lojistaConfigurado} className="space-y-5"><label className="block text-sm font-semibold">E-mail<input type="email" name="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-borda bg-suave px-4 py-3 outline-offset-4" /></label><label className="block text-sm font-semibold">Senha<input type="password" name="senha" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} className="mt-2 w-full rounded-2xl border border-borda bg-suave px-4 py-3 outline-offset-4" /></label><button disabled={ocupado || !lojistaConfigurado} type="submit" className="w-full rounded-full bg-tinta px-6 py-4 font-bold text-white disabled:opacity-40">{ocupado ? "Entrando…" : "Entrar no painel"}</button></fieldset>{erro ? <p role="alert" className="rounded-2xl bg-perigo-fundo p-4 text-sm text-perigo">{erro}</p> : null}</form><p className="mt-6 text-xs leading-relaxed text-cinza">O acesso à loja é conferido no servidor. Se sua conta não tiver um vínculo ativo, nenhum dado da loja será exibido.</p>
    </div></section>
  </main>;
}
