"use client";

import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { painelConfigurado, rpcAdmin, supabaseAdmin, type AdminEu } from "@/lib/admin/supabase";

type Etapa =
  | { tipo: "senha" }
  | { tipo: "codigo"; fatorId: string }
  | { tipo: "cadastrar"; fatorId: string; qr: string; segredo: string };

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

  const campo = "h-14 w-full rounded-[14px] border border-borda bg-white px-4 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-azul";

  return (
    <div className="admin-login-v2">
      <section className="admin-login-foto" aria-label="PetLive para a equipe">
        <Image src="https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=900&q=70&auto=format&fit=crop" alt="Cão e gato juntos ao ar livre" fill priority unoptimized sizes="50vw" />
        <div className="admin-login-gradiente" />
        <Link href="/" className="admin-login-marca">
          <Image src="/logo-petlive.png" alt="" width={38} height={38} />
          <b>PetLive</b><span>Admin</span>
        </Link>
        <div className="admin-login-copy">
          <h1>O PetLive em um só painel</h1>
          <p>Assinaturas, avaliações, pedidos e lojas. Acesso só para a equipe.</p>
        </div>
      </section>
      <section className="admin-login-formulario">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="admin-login-marca-mobile"><Image src="/logo-petlive.png" alt="" width={36} height={36} /><b>PetLive</b><span>Admin</span></Link>
          <span className="admin-login-etapa">ACESSO DA EQUIPE · {etapa.tipo === "senha" ? "01 / 02" : "02 / 02"}</span>
          <h2 className="text-[30px] font-bold tracking-tight">{etapa.tipo === "senha" ? "Entrar no painel" : etapa.tipo === "cadastrar" ? "Proteja sua conta" : "Confirme seu acesso"}</h2>
          <p className="mt-2 text-sm leading-relaxed text-cinza">{etapa.tipo === "senha" ? "Use o e-mail da equipe PetLive para continuar." : "Use seu app autenticador para concluir a entrada com segurança."}</p>

          {!painelConfigurado ? (
            <p className="mt-6 rounded-2xl bg-perigo-fundo p-4 text-sm text-perigo">
              Falta configurar NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no build.
            </p>
          ) : null}

          {etapa.tipo === "senha" ? (
            <form onSubmit={entrarComSenha} className="mt-8 space-y-5">
              <div><label className="mb-2 block text-[13px] font-semibold" htmlFor="email">E-mail da equipe</label>
              <input id="email" type="email" required autoComplete="username" placeholder="[nome]@petlive.com.br" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} /></div>
              <div>
                <label className="mb-2 block text-[13px] font-semibold" htmlFor="senha">Senha</label>
                <div className="relative">
                <input id="senha" type={mostrarSenha ? "text" : "password"} required autoComplete="current-password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} className={`${campo} pr-24`} />
                <button type="button" onClick={() => setMostrarSenha((m) => !m)} className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold">
                  {mostrarSenha ? "Ocultar" : "Mostrar"}
                </button>
              </div>
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
                      className={`h-14 min-w-0 flex-1 rounded-[14px] border bg-white text-center text-xl font-bold outline-none focus-visible:ring-2 focus-visible:ring-azul ${d ? "border-tinta" : "border-borda"}`}
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
            <p role="alert" className="mt-4 rounded-[14px] bg-perigo-fundo p-4 text-sm font-semibold text-perigo">
              {erro}
            </p>
          ) : null}
          <p className="mt-6 text-center text-xs leading-relaxed text-cinza">Esqueceu a senha? Fale com um super admin.</p>
          {process.env.NODE_ENV === "development" ? (
            <div className="mt-6 rounded-2xl border border-borda bg-white p-4 text-center">
              <Link href="/admin/dev/AdminVisao.html" prefetch={false} className="inline-flex min-h-10 items-center justify-center rounded-full bg-azul-fundo px-5 text-xs font-bold text-azul-escuro">Abrir prévia dev</Link>
              <p className="mt-2 text-xs leading-relaxed text-cinza">Telas do canvas com dados fictícios. Disponível apenas no desenvolvimento local.</p>
            </div>
          ) : null}
          <div className="admin-login-seguranca"><span aria-hidden="true">✓</span> Acesso protegido com verificação em duas etapas</div>
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
      className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-tinta px-6 text-sm font-bold text-white transition hover:bg-[#243349] disabled:opacity-60"
    >
      <span className="flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <span className="text-center">{enviando ? "Conferindo…" : rotulo}</span>
    </button>
  );
}
