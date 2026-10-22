"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Chamado = {
  id: string;
  tipo: "contato" | "lojista";
  nome: string;
  email: string;
  telefone: string | null;
  mensagem: string | null;
  loja_nome: string | null;
  loja_tipo: string | null;
  cidade: string | null;
  status: "aberto" | "respondido" | "fechado";
  prioridade: "normal" | "alta";
  criado_em: string;
  meu: boolean;
  tem_conta: boolean;
};
type Suporte = {
  abertos: number;
  abertos_lojistas: number;
  sem_resposta_2h: number;
  tempo_medio_min: number | null;
  resolvidos_30d: number;
  chamados: Chamado[];
};
type Nota = { tipo: "nota" | "resposta"; texto: string; criado_em: string; autor: string };

type Aba = "abertos" | "meus" | "lojistas" | "fechados";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "abertos", rotulo: "Abertos" },
  { valor: "meus", rotulo: "Meus" },
  { valor: "lojistas", rotulo: "Lojistas" },
  { valor: "fechados", rotulo: "Respondidos e fechados" },
];

/** Respostas prontas (protótipo: atalhos acima do campo de resposta). */
const PRONTAS: { rotulo: string; texto: string }[] = [
  { rotulo: "Atualizar o app", texto: "Oi! Atualize o PetLive para a versão mais nova na loja de apps e tente de novo. Se continuar, me conte o modelo do celular." },
  { rotulo: "Pedir print da tela", texto: "Oi! Pode me mandar um print da tela onde aparece o problema? Assim consigo ver o que está acontecendo." },
  { rotulo: "Lojista: avisar", texto: "Oi! Obrigado pelo interesse. O cadastro de lojas abre em breve e você será avisado primeiro por este e-mail." },
];

const LOJA: Record<string, string> = {
  petshop: "Petshop",
  clinica: "Clínica",
  banho_tosa: "Banho e tosa",
  passeador: "Passeador",
  creche: "Creche",
  hotelzinho: "Hotelzinho",
  outro: "Outro",
};

function titulo(c: Chamado): string {
  if (c.tipo === "lojista") return `${c.loja_nome ?? "Loja"} · quer entrar no PetLive`;
  const primeira = (c.mensagem ?? "").split(/[.!?\n]/)[0].trim();
  return primeira.length > 60 ? `${primeira.slice(0, 57)}…` : primeira || "Mensagem pelo site";
}

/**
 * Suporte (protótipo AdminSuporte): as mensagens do formulário de contato e
 * de interesse de lojistas do site viram chamados. A resposta sai pelo e-mail
 * da equipe (ainda não há provedor de e-mail, BUSINESS.md 23) e fica registrada
 * no chamado, junto com as notas internas.
 */
export default function SuportePagina() {
  const admin = useAdmin();
  const [dados, setDados] = useState<Suporte | null>(null);
  const [aba, setAba] = useState<Aba>("abertos");
  const [selecionado, setSelecionado] = useState<Chamado | null>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const pode = admin.papel === "super" || admin.papel === "suporte";

  const carregar = useCallback(() => {
    rpcAdmin<Suporte>("admin_suporte").then(
      (d) => {
        setDados(d);
        setSelecionado((atual) => (atual ? (d.chamados.find((c) => c.id === atual.id) ?? null) : null));
      },
      (e: Error) => setErro(e.message),
    );
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrir(c: Chamado) {
    setSelecionado(c);
    setTexto("");
    rpcAdmin<Nota[]>("admin_suporte_notas", { p_contato: c.id }).then(setNotas, () => setNotas([]));
  }

  async function acao(nome: string, conteudo?: string) {
    if (!selecionado) return;
    setErro(null);
    try {
      await rpcAdmin("admin_suporte_acao", { p_contato: selecionado.id, p_acao: nome, p_texto: conteudo ?? null });
      carregar();
      abrir(selecionado);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function responder(e: FormEvent) {
    e.preventDefault();
    if (!selecionado || !texto.trim()) return;
    // Abre o e-mail da equipe já preenchido; o chamado registra a resposta.
    const assunto = encodeURIComponent(`Re: PetLive — ${titulo(selecionado)}`);
    window.open(`mailto:${selecionado.email}?subject=${assunto}&body=${encodeURIComponent(texto.trim())}`, "_blank");
    await acao("responder", texto.trim());
    setTexto("");
  }

  if (!dados) return <p className="text-sm text-cinza">{erro ?? "Carregando…"}</p>;

  const visiveis = dados.chamados.filter((c) =>
    aba === "abertos" ? c.status === "aberto" : aba === "meus" ? c.meu && c.status !== "fechado" : aba === "lojistas" ? c.tipo === "lojista" && c.status !== "fechado" : c.status !== "aberto",
  );

  return (
    <>
      <Cabecalho titulo="Suporte" subtitulo="Mensagens do site e interesse de lojistas, com respostas prontas" />
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Abertos" valor={numero(dados.abertos)} apoio={`${numero(dados.abertos_lojistas)} de lojistas`} fundo="bg-azul-fundo" cor="text-azul-escuro" />
        <CartaoNumero rotulo="Sem resposta há +2 h" valor={numero(dados.sem_resposta_2h)} apoio="Meta: 0" fundo="bg-rosa-fundo" cor="text-rosa-texto" />
        <CartaoNumero
          rotulo="Tempo médio de resposta"
          valor={dados.tempo_medio_min === null ? "—" : dados.tempo_medio_min < 120 ? `${dados.tempo_medio_min} min` : `${Math.round(dados.tempo_medio_min / 60)} h`}
          apoio="Últimos 30 dias"
          fundo="bg-verde-fundo"
          cor="text-verde-texto"
        />
        <CartaoNumero rotulo="Resolvidos (30d)" valor={numero(dados.resolvidos_30d)} apoio="Chamados fechados" fundo="bg-amarelo-fundo" cor="text-amarelo-texto" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <section className="min-w-0 rounded-[28px] bg-fundo p-5">
          <div className="flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button
                key={a.valor}
                onClick={() => setAba(a.valor)}
                className={`h-9 rounded-full px-4 text-[13px] font-bold ${aba === a.valor ? "bg-tinta text-white" : "border border-[#DDE1E8]"}`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <ul className="mt-4 space-y-2">
            {visiveis.length === 0 ? <li className="px-2 py-4 text-sm text-cinza">Nada aqui.</li> : null}
            {visiveis.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => abrir(c)}
                  className={`flex w-full items-center gap-3 rounded-[22px] p-3 text-left ${selecionado?.id === c.id ? "border-2 border-tinta" : "border-2 border-transparent hover:bg-suave"}`}
                >
                  <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-bold ${c.tipo === "lojista" ? "bg-amarelo-fundo" : "bg-azul-fundo"}`}>
                    {c.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold">
                      {c.nome} · {titulo(c)}
                    </span>
                    <span className="block truncate text-xs text-cinza">
                      {c.tipo === "lojista" ? `${LOJA[c.loja_tipo ?? "outro"] ?? "Loja"} · ${c.cidade ?? ""}` : c.email} · {haQuanto(c.criado_em)}
                    </span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${c.prioridade === "alta" ? "bg-rosa-fundo text-rosa-texto" : "bg-suave text-cinza"}`}>
                    {c.prioridade === "alta" ? "Alta" : "Normal"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex min-h-[420px] min-w-0 flex-col rounded-[28px] bg-fundo p-5">
          {!selecionado ? (
            <p className="text-sm text-cinza">Escolha um chamado para ver a conversa.</p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-bold">
                    {selecionado.nome} · {titulo(selecionado)}
                  </h2>
                  <p className="text-xs text-cinza">
                    {selecionado.email}
                    {selecionado.telefone ? ` · ${selecionado.telefone}` : ""} · {selecionado.tem_conta ? "tem conta no app" : "sem conta no app"} · {haQuanto(selecionado.criado_em)}
                  </p>
                </div>
                {pode ? (
                  <button
                    onClick={() => acao("prioridade", selecionado.prioridade === "alta" ? "normal" : "alta")}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${selecionado.prioridade === "alta" ? "bg-rosa-fundo text-rosa-texto" : "bg-suave text-cinza"}`}
                    title="Mudar a prioridade"
                  >
                    {selecionado.prioridade === "alta" ? "Alta" : "Normal"}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 flex-1 space-y-3 overflow-y-auto text-[13px]">
                <p className="max-w-[85%] rounded-[20px] bg-suave px-4 py-3 leading-relaxed">
                  {selecionado.tipo === "lojista"
                    ? `${selecionado.loja_nome} (${LOJA[selecionado.loja_tipo ?? "outro"] ?? "Loja"}, ${selecionado.cidade}) quer entrar no PetLive.${selecionado.mensagem ? ` ${selecionado.mensagem}` : ""}`
                    : selecionado.mensagem}
                </p>
                {notas.map((n, i) =>
                  n.tipo === "resposta" ? (
                    <p key={i} className="ml-auto max-w-[85%] rounded-[20px] bg-tinta px-4 py-3 leading-relaxed text-white">
                      {n.texto}
                      <span className="mt-1 block text-[11px] text-[#9AA3B2]">
                        {n.autor} · por e-mail · {haQuanto(n.criado_em)}
                      </span>
                    </p>
                  ) : (
                    <p key={i} className="mx-auto max-w-[85%] rounded-[16px] border border-dashed border-[#DDE1E8] px-4 py-2 text-xs text-cinza">
                      Nota interna de {n.autor}: {n.texto}
                    </p>
                  ),
                )}
              </div>

              {pode ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {PRONTAS.map((p) => (
                      <button key={p.rotulo} onClick={() => setTexto(p.texto)} className="rounded-full bg-azul-fundo px-3 py-1 text-[11px] font-bold text-azul-escuro">
                        {p.rotulo}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={responder} className="mt-2 flex gap-2">
                    <label className="sr-only" htmlFor="resposta">Resposta</label>
                    <textarea
                      id="resposta"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      rows={2}
                      placeholder="Escreva uma resposta…"
                      className="flex-1 resize-none rounded-[20px] bg-suave px-4 py-2.5 text-[13px] outline-none"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button type="submit" className="h-10 rounded-full bg-tinta px-5 text-[13px] font-bold text-white" title="Abre o seu e-mail e registra a resposta">
                        Responder
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (texto.trim()) acao("nota", texto.trim()).then(() => setTexto(""));
                        }}
                        className="h-8 rounded-full border border-[#DDE1E8] px-3 text-[11px] font-bold"
                      >
                        Nota interna
                      </button>
                    </div>
                  </form>
                  <div className="mt-2 flex gap-3 text-xs font-semibold">
                    {!selecionado.meu ? (
                      <button onClick={() => acao("assumir")} className="text-azul-escuro underline">
                        Assumir chamado
                      </button>
                    ) : null}
                    {selecionado.status === "fechado" ? (
                      <button onClick={() => acao("reabrir")} className="text-azul-escuro underline">
                        Reabrir
                      </button>
                    ) : (
                      <button onClick={() => acao("fechar")} className="text-cinza underline">
                        Fechar chamado
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </>
          )}
        </section>
      </div>
    </>
  );
}
