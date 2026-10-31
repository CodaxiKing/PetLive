import Link from "next/link";
import { Logo } from "./Logo";
import { BotaoPreferenciasCookies } from "./ConsentimentoCookies";

export function Rodape({ publico = "tutor" }: { publico?: "tutor" | "lojista" }) {
  return <footer className="v2-rodape"><div className="v2-rodape-conteudo">
    <div><Logo /><p>O PetLive organiza informações de saúde do seu pet. Não substitui a consulta veterinária.</p><small>© 2026 PetLive</small></div>
    <nav aria-label="Produto"><b>Produto</b><Link href="/#recursos">Recursos</Link><Link href="/#planos">Planos</Link><Link href={publico === "tutor" ? "/lojistas" : "/"}>{publico === "tutor" ? "Para lojistas" : "Para tutores"}</Link><Link href="/#baixar">Baixar o app</Link></nav>
    <nav aria-label="Ajuda"><b>Ajuda</b><Link href="/#perguntas">Perguntas frequentes</Link><Link href="/contato">Fale com a gente</Link><a href="mailto:suporte@petlive.app">suporte@petlive.app</a></nav>
    <nav aria-label="Legal"><b>Legal</b><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/lgpd">LGPD</Link><Link href="/creditos">Créditos</Link><BotaoPreferenciasCookies /></nav>
  </div></footer>;
}
