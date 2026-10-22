"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { painelConfigurado, rpcAdmin, supabaseAdmin, type AdminEu } from "@/lib/admin/supabase";

type Etapa =
  | { tipo: "senha" }
  | { tipo: "codigo"; fatorId: string }
  | { tipo: "cadastrar"; fatorId: string; qr: string; segredo: string };

function Pata() {
  return (
    <svg width="220" height="220" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.1" aria-hidden="true">
      <circle cx="6" cy="10" r="1.8" />
      <circle cx="10" cy="6" r="1.8" />
      <circle cx="14" cy="6" r="1.8" />
      <circle cx="18" cy="10" r="1.8" />
      <path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
    </svg>
  );
}

/**
 * Entrar no painel (protótipo AdminLogin): e-mail e senha da equipe e o código
 * de 6 números do app autenticador. No primeiro acesso, mostra o QR para
 * cadastrar o app (Google Authenticator, 1Password, Authy...).
 */
export default function EntrarAdmin() {
  const router = useRouter();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "senha" });
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [codigo, setCodigo] = useState(["", "", "", "", "", ""]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const caixas = useRef<(HTMLInputElement | null)[]>([]);

  async function entrarComSenha(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const supabase = supabaseAdmin();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw new Error(error.message.includes("Invalid login") ? "E-mail ou senha incorretos." : error.message);

      const eu = await rpcAdmin<AdminEu>("admin_eu");
      if (!eu.admin) {
        await supabase.auth.signOut();
        throw new Error("Esta conta não é da equipe PetLive.");
      }

      const { data: fatores } = await supabase.auth.mfa.listFactors();
      const verificado = fatores?.totp.find((f) => f.status === "verified");
      if (verificado) {
        setEtapa({ tipo: "codigo", fatorId: verificado.id });
      } else {
        // Primeiro acesso: tira fatores pela metade e cadastra um novo.
        for (const f of fatores?.all ?? []) {
          if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
        const { data, error: erroCadastro } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: `Painel PetLive ${new Date().toLocaleDateString("pt-BR")}`,
        });
        if (erroCadastro) throw new Error(erroCadastro.message);
        setEtapa({ tipo: "cadastrar", fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
      }
      setTimeout(() => caixas.current[0]?.focus(), 50);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não deu para entrar.");
    } finally {
      setEnviando(false);
    }
  }

  async function verificarCodigo(e: FormEvent) {
    e.preventDefault();
    if (etapa.tipo === "senha") return;
    const texto = codigo.join("");
    if (texto.length !== 6) return setErro("Digite os 6 números do app autenticador.");
    setErro(null);
    setEnviando(true);
    const { error } = await supabaseAdmin().auth.mfa.challengeAndVerify({ factorId: etapa.fatorId, code: texto });
    setEnviando(false);
    if (error) {
      setErro("Código inválido ou vencido. Confira o app e tente de novo.");
      setCodigo(["", "", "", "", "", ""]);
      caixas.current[0]?.focus();
      return;
    }
    router.replace("/admin");
  }

  function digitar(i: number, valor: string) {
    const numeros = valor.replace(/\D/g, "");
    // Colar o código inteiro numa caixa preenche todas.
    if (numeros.length > 1) {
      const novos = numeros.slice(0, 6).split("");
      setCodigo([...novos, ...Array(6 - novos.length).fill("")]);
      caixas.current[Math.min(novos.length, 5)]?.focus();
      return;
    }
    const novo = [...codigo];
    novo[i] = numeros;
    setCodigo(novo);
    if (numeros && i < 5) caixas.current[i + 1]?.focus();
  }

  const campo = "h-14 w-full rounded-[28px] bg-suave px-6 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-azul";

  return (
    <div className="grid min-h-screen md:grid-cols-[1fr_1.25fr]">
      <section className="relative hidden overflow-hidden bg-azul-hero px-12 py-10 md:block">
        <p className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          PetLive <span className="rounded-full bg-roxo-fundo px-2 py-0.5 text-[10px] font-extrabold tracking-wider">ADMIN</span>
        </p>
        <h1 className="mt-28 max-w-sm text-5xl font-medium leading-[1.05] tracking-tight">O PetLive em um só painel</h1>
        <p className="mt-4 max-w-sm text-cinza">Tutores, pets, privacidade e equipe. Acesso só para a equipe.</p>
        <div className="absolute bottom-10 right-10 opacity-90">
          <Pata />
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <h2 className="text-3xl font-medium tracking-tight">Entrar</h2>
          <p className="mt-1 text-sm text-cinza">Use o e-mail da equipe PetLive.</p>

          {!painelConfigurado ? (
            <p className="mt-6 rounded-2xl bg-perigo-fundo p-4 text-sm text-perigo">
              Falta configurar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build.
            </p>
          ) : null}

          {etapa.tipo === "senha" ? (
            <form onSubmit={entrarComSenha} className="mt-6 space-y-3">
              <label className="sr-only" htmlFor="email">E-mail</label>
              <input id="email" type="email" required autoComplete="username" placeholder="[nome]@petlive.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
              <div className="relative">
                <label className="sr-only" htmlFor="senha">Senha</label>
                <input id="senha" type={mostrarSenha ? "text" : "password"} required autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} className={`${campo} pr-24`} />
                <button type="button" onClick={() => setMostrarSenha((m) => !m)} className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold">
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <BotaoEntrar enviando={enviando} rotulo="Continuar" />
            </form>
          ) : (
            <form onSubmit={verificarCodigo} className="mt-6 space-y-4">
              {etapa.tipo === "cadastrar" ? (
                <div className="rounded-3xl bg-suave p-4 text-sm leading-relaxed">
                  <p className="font-bold">Primeiro acesso: cadastre o app autenticador</p>
                  <p className="mt-1 text-cinza">Escaneie o QR com o Google Authenticator, 1Password ou Authy e digite o código que aparecer.</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={etapa.qr} alt="QR para cadastrar o app autenticador" className="mx-auto my-3 h-44 w-44 rounded-2xl bg-white p-2" />
                  <p className="break-all text-center text-xs text-cinza">
                    Sem câmera? Digite a chave: <span className="font-mono font-semibold text-tinta">{etapa.segredo}</span>
                  </p>
                </div>
              ) : null}
              <fieldset>
                <legend className="text-sm font-bold">Código de verificação</legend>
                <div className="mt-2 flex gap-2">
                  {codigo.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        caixas.current[i] = el;
                      }}
                      inputMode="numeric"
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      aria-label={`Número ${i + 1} do código`}
                      value={d}
                      onChange={(e) => digitar(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !codigo[i] && i > 0) caixas.current[i - 1]?.focus();
                      }}
                      className={`h-14 w-12 rounded-2xl text-center text-xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-azul ${d ? "border-2 border-tinta bg-fundo" : "bg-suave"}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-cinza">Abra o app autenticador no celular e digite o código de 6 números.</p>
              </fieldset>
              <BotaoEntrar enviando={enviando} rotulo="Entrar no painel" />
              <button
                type="button"
                className="w-full text-center text-xs font-semibold text-cinza underline"
                onClick={async () => {
                  await supabaseAdmin().auth.signOut();
                  setEtapa({ tipo: "senha" });
                  setCodigo(["", "", "", "", "", ""]);
                }}
              >
                Entrar com outra conta
              </button>
            </form>
          )}

          {erro ? (
            <p role="alert" className="mt-4 text-sm font-semibold text-perigo">
              {erro}
            </p>
          ) : null}
          <p className="mt-6 text-center text-xs text-cinza">Esqueceu a senha? Fale com um super admin.</p>
        </div>
      </section>
    </div>
  );
}

function BotaoEntrar({ enviando, rotulo }: { enviando: boolean; rotulo: string }) {
  return (
    <button
      type="submit"
      disabled={enviando}
      className="flex h-14 w-full items-center gap-3 rounded-full bg-tinta pl-2 pr-6 font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-azul">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <span className="flex-1 text-center">{enviando ? "Conferindo…" : rotulo}</span>
    </button>
  );
}
