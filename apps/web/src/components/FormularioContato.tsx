"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  EMAIL_CONTATO,
  EMAIL_PARCEIROS,
  contatoConfigurado,
  enviarContato,
  type ResultadoContato,
} from "@/lib/contato";

const TIPOS_LOJA = [
  { valor: "petshop", rotulo: "Petshop" },
  { valor: "clinica", rotulo: "Clínica veterinária" },
  { valor: "banho_tosa", rotulo: "Banho e tosa" },
  { valor: "passeador", rotulo: "Passeador" },
  { valor: "creche", rotulo: "Creche pet" },
  { valor: "hotelzinho", rotulo: "Hotelzinho pet" },
  { valor: "outro", rotulo: "Outro" },
];

const MENSAGENS: Record<Exclude<ResultadoContato, "ok">, string> = {
  limite: "Você já enviou mensagens hoje. Responderemos em breve.",
  invalido: "Confira o nome, o e-mail e a mensagem.",
  erro: "Não deu para enviar agora.",
};

const campo =
  "h-12 w-full rounded-2xl border border-borda bg-fundo px-4 text-[15px] outline-none transition focus:border-tinta focus-visible:ring-2 focus-visible:ring-azul";

/**
 * Formulário do site: "contato" (página Contato) ou "lojista" (interesse de
 * lojas na página Para lojistas, BUSINESS.md 4.5). Grava pela função do
 * Supabase; sem ela configurada, oferece o e-mail.
 */
export function FormularioContato({ tipo, escuro = false }: { tipo: "contato" | "lojista"; escuro?: boolean }) {
  const [estado, setEstado] = useState<"livre" | "enviando" | ResultadoContato>("livre");
  const email = tipo === "lojista" ? EMAIL_PARCEIROS : EMAIL_CONTATO;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const texto = (nome: string) => String(dados.get(nome) ?? "").trim();
    setEstado("enviando");
    const resultado = await enviarContato({
      tipo,
      nome: texto("nome"),
      email: texto("email"),
      telefone: texto("telefone"),
      mensagem: texto("mensagem"),
      lojaNome: texto("loja"),
      lojaTipo: texto("tipoLoja"),
      cidade: texto("cidade"),
      isca: texto("site"),
    });
    setEstado(resultado);
  }

  if (estado === "ok") {
    return (
      <div role="status" className="rounded-[28px] bg-verde-fundo p-8 text-verde-texto">
        <p className="text-xl font-extrabold">Recebemos, obrigado!</p>
        <p className="mt-2 leading-relaxed">
          {tipo === "lojista"
            ? "Avisaremos você por e-mail quando o cadastro de lojas abrir na sua cidade."
            : "Respondemos pelo e-mail informado em até 2 dias úteis."}
        </p>
      </div>
    );
  }

  const rotulo = `mb-1.5 block text-sm font-semibold ${escuro ? "text-white" : "text-tinta"}`;

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-1">
        <label htmlFor={`${tipo}-nome`} className={rotulo}>
          Seu nome
        </label>
        <input id={`${tipo}-nome`} name="nome" required minLength={2} maxLength={120} autoComplete="name" className={campo} />
      </div>
      <div className="sm:col-span-1">
        <label htmlFor={`${tipo}-email`} className={rotulo}>
          E-mail
        </label>
        <input id={`${tipo}-email`} name="email" type="email" required maxLength={254} autoComplete="email" className={campo} />
      </div>

      {tipo === "lojista" ? (
        <>
          <div>
            <label htmlFor="lojista-loja" className={rotulo}>
              Nome da loja
            </label>
            <input id="lojista-loja" name="loja" required maxLength={120} autoComplete="organization" className={campo} />
          </div>
          <div>
            <label htmlFor="lojista-tipo" className={rotulo}>
              O que a loja faz
            </label>
            <select id="lojista-tipo" name="tipoLoja" required defaultValue="" className={campo}>
              <option value="" disabled>
                Escolha
              </option>
              {TIPOS_LOJA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="lojista-telefone" className={rotulo}>
              WhatsApp (opcional)
            </label>
            <input id="lojista-telefone" name="telefone" type="tel" maxLength={30} autoComplete="tel" className={campo} />
          </div>
          <div>
            <label htmlFor="lojista-cidade" className={rotulo}>
              Cidade
            </label>
            <input id="lojista-cidade" name="cidade" required maxLength={120} autoComplete="address-level2" className={campo} />
          </div>
        </>
      ) : null}

      <div className="sm:col-span-2">
        <label htmlFor={`${tipo}-mensagem`} className={rotulo}>
          {tipo === "lojista" ? "Quer contar mais? (opcional)" : "Mensagem"}
        </label>
        <textarea
          id={`${tipo}-mensagem`}
          name="mensagem"
          rows={4}
          required={tipo === "contato"}
          minLength={tipo === "contato" ? 5 : undefined}
          maxLength={2000}
          className={`${campo} h-auto py-3`}
        />
      </div>

      {/* Isca para robôs: escondida de pessoas e de leitores de tela. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${tipo}-site`}>Não preencha</label>
        <input id={`${tipo}-site`} name="site" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs leading-relaxed ${escuro ? "text-white/70" : "text-cinza"}`}>
          Usamos estes dados só para responder você. Veja a{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>
          .
        </p>
        <button
          type="submit"
          disabled={estado === "enviando" || !contatoConfigurado}
          className="flex h-14 shrink-0 items-center justify-center gap-3 rounded-full bg-azul pl-6 pr-2 font-semibold text-tinta transition hover:-translate-y-0.5 disabled:opacity-60"
        >
          {estado === "enviando" ? "Enviando…" : tipo === "lojista" ? "Quero cadastrar minha loja" : "Enviar mensagem"}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-tinta">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </div>

      {estado !== "livre" && estado !== "enviando" ? (
        <p role="alert" className="text-sm font-semibold text-perigo sm:col-span-2">
          {MENSAGENS[estado]} Se preferir, escreva para{" "}
          <a href={`mailto:${email}`} className="underline">
            {email}
          </a>
          .
        </p>
      ) : null}
      {!contatoConfigurado ? (
        <p className={`text-sm sm:col-span-2 ${escuro ? "text-white/80" : "text-cinza"}`}>
          Escreva para{" "}
          <a href={`mailto:${email}`} className="font-semibold underline">
            {email}
          </a>
          .
        </p>
      ) : null}
    </form>
  );
}
