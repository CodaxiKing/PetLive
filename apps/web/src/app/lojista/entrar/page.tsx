"use client";
import Link from "next/link";
import Image from "next/image";
import styles from "./entrar.module.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { lojistaConfigurado, supabaseLojista } from "@/lib/lojista/supabase";
export default function EntrarLojista() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false); const [erro, setErro] = useState<string | null>(null);
  const trava = useRef(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
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
  return (
    <main className={styles.pagina}>
      <section className={styles.apresentacao} aria-label="PetLive para lojistas">
        <Image src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200&q=85&auto=format&fit=crop" alt="Dois cães correndo juntos ao ar livre" fill priority unoptimized sizes="(max-width: 760px) 100vw, 50vw" className={styles.foto} />
        <div className={styles.gradiente} />
        <Link href="/" className={styles.marca} aria-label="PetLive — início">
          <Image src="/logo-petlive.png" alt="" width={40} height={40} />
          <b>PetLive</b><span>Para negócios</span>
        </Link>
        <div className={styles.mensagem}>
          <span className={styles.etiqueta}>PAINEL DO LOJISTA</span>
          <h1>Sua loja,<br />mais perto dos pets.</h1>
          <p>Um só lugar para acompanhar seu cadastro e organizar a presença da sua loja no PetLive.</p>
          <Link href="/lojistas">Conheça o PetLive para negócios <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className={styles.acesso} aria-labelledby="titulo-entrar-lojista">
        <div className={styles.formulario}>
          <Link href="/" className={styles.marcaMobile} aria-label="PetLive — início"><Image src="/logo-petlive.png" alt="" width={36} height={36} /><b>PetLive</b><span>Para negócios</span></Link>
          <div className={styles.icone} aria-hidden="true"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l2-6h14l2 6M4 13v7h16v-7M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></svg></div>
          <span className={styles.sobreTitulo}>BEM-VINDO DE VOLTA</span>
          <h2 id="titulo-entrar-lojista">Entre no seu painel</h2>
          <p className={styles.descricao}>Use o e-mail da conta vinculada à sua loja.</p>
          {!lojistaConfigurado ? <p role="status" className={styles.aviso}>O painel ainda não está conectado neste ambiente. Tente novamente mais tarde.</p> : null}

          <form onSubmit={entrar} aria-busy={ocupado}>
            <fieldset disabled={ocupado || !lojistaConfigurado} className={styles.campos}>
              <label htmlFor="lojista-email">E-mail da loja
                <input id="lojista-email" type="email" name="email" autoComplete="username" placeholder="voce@sualoja.com.br" required value={email} onChange={e => setEmail(e.target.value)} />
              </label>
              <div>
                <label htmlFor="lojista-senha">Senha</label>
                <div className={styles.senha}>
                  <input id="lojista-senha" type={mostrarSenha ? "text" : "password"} name="senha" autoComplete="current-password" placeholder="Sua senha" required value={senha} onChange={e => setSenha(e.target.value)} />
                  <button type="button" aria-controls="lojista-senha" aria-pressed={mostrarSenha} onClick={() => setMostrarSenha(v => !v)}>{mostrarSenha ? "Ocultar" : "Mostrar"}</button>
                </div>
              </div>
              <button disabled={ocupado || !lojistaConfigurado} type="submit" className={styles.entrar}>
                <span>{ocupado ? "Entrando…" : "Entrar no painel"}</span><span aria-hidden="true">→</span>
              </button>
            </fieldset>
            {erro ? <p role="alert" className={styles.erro}>{erro}</p> : null}
          </form>

          <p className={styles.cadastro}>Ainda não tem sua loja no PetLive? <Link href="/lojistas#cadastro">Conheça e cadastre seu negócio <span aria-hidden="true">↗</span></Link></p>
          <div className={styles.rodape}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3l8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6zM8 12l3 3 5-6"/></svg><span>Acesso exclusivo às lojas vinculadas à sua conta.</span></div>
          <Link href="/" className={styles.voltar}>← Voltar ao site</Link>
        </div>
      </section>
    </main>
  );
}
