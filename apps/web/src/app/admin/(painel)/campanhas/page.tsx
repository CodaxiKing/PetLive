"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";
import { amanha9h, criarTravaCampanha, horarioEnvio, horarioLocal } from "@/lib/admin/campanhas";

type Publico = "todos" | "caes" | "gatos" | "sem_pet" | "vacina_vencendo" | "inativos";
type Link = "/inicio" | "/mapa" | "/lembretes" | "/ferramentas/calculadoras" | "/sos";
type Campanha = {
  id: string;
  revisao: number;
  titulo: string;
  mensagem: string;
  publico: Publico;
  link: Link | null;
  status: "rascunho" | "agendada" | "enviada" | "cancelada";
  agendada_para: string | null;
  enviada_em: string | null;
  destinatarios: number | null;
  abertas: number;
  criada_em: string;
  por: string | null;
};
type Dados = { enviadas_30d: number; abertas_30d: number; agendadas: number; proxima: string | null; com_aceite: number; campanhas: Campanha[] };

const PUBLICOS: Record<Publico, string> = {
  todos: "Todos os tutores",
  caes: "Tutores de cães",
  gatos: "Tutores de gatos",
  sem_pet: "Conta sem pet cadastrado",
  vacina_vencendo: "Vacina vencendo em 14 dias",
  inativos: "Sem abrir o app há 30 dias",
};
const LINKS: Record<Link, string> = {
  "/inicio": "Início",
  "/lembretes": "Lembretes",
  "/mapa": "Mapa",
  "/ferramentas/calculadoras": "Calculadoras",
  "/sos": "SOS",
};
const STATUS: Record<Campanha["status"], { rotulo: string; cor: string }> = {
  enviada: { rotulo: "Enviada", cor: "bg-verde-fundo text-verde-texto" },
  agendada: { rotulo: "Agendada", cor: "bg-amarelo-fundo text-amarelo-texto" },
  rascunho: { rotulo: "Rascunho", cor: "bg-suave text-cinza" },
  cancelada: { rotulo: "Cancelada", cor: "bg-suave text-cinza line-through" },
};

type Form = { id: string | null; revisao: number | null; titulo: string; mensagem: string; publico: Publico; link: Link; quando: string };
const VAZIO: Form = { id: null, revisao: null, titulo: "", mensagem: "", publico: "todos", link: "/inicio", quando: "" };

/** "amanhã 9h", "qui 18h", "12 out". */
function dataCurta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const hoje = new Date();
  const dias = Math.round((new Date(d.toDateString()).getTime() - new Date(hoje.toDateString()).getTime()) / 86_400_000);
  const hora = `${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`;
  if (dias === 0) return `hoje ${hora}`;
  if (dias === 1) return `amanhã ${hora}`;
  if (dias > 1 && dias < 7) return `${d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")} ${hora}`;
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
}

function pct(parte: number, total: number | null): string {
  return total ? `${Math.round((parte / total) * 100)}%` : "—";
}

/**
 * Campanhas (protótipo AdminCampanhas): avisos por push para um público,
 * agendados. Só recebe quem aceitou "Dicas e novidades" (LGPD), com os
 * avisos ligados, e no máximo uma campanha por dia. E-mail entra quando
 * houver o provedor.
 */
export default function CampanhasPagina() {
  const admin = useAdmin();
  const [dados, setDados] = useState<Dados | null>(null);
  const [form, setForm] = useState<Form>(VAZIO);
  const [estimativa, setEstimativa] = useState<{ publico: Publico; total: number | null } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [executar] = useState(criarTravaCampanha);
  const pode = admin.papel === "super" || admin.papel === "marketing";

  const carregar = useCallback(() => {
    rpcAdmin<Dados>("admin_campanhas_v2").then(setDados, (e: Error) => setErro(e.message));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    let atual = true;
    rpcAdmin<number>("admin_campanha_publico", { p_publico: form.publico }).then(
      (total) => { if (atual) setEstimativa({ publico: form.publico, total }); },
      () => { if (atual) setEstimativa({ publico: form.publico, total: null }); },
    );
    return () => { atual = false; };
  }, [form.publico]);

  async function agir(acao: () => Promise<unknown>, sucesso: string | (() => string), limpar = false) {
    if (!pode) return;
    await executar(async () => {
      setOcupado(true);
      setErro(null);
      setAviso(null);
      try {
        await acao();
        setAviso(typeof sucesso === "function" ? sucesso() : sucesso);
        if (limpar) setForm(VAZIO);
        carregar();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação. Tente novamente.");
        carregar();
      } finally {
        setOcupado(false);
      }
    });
  }

  async function salvar(agendar: boolean) {
    let quando: string | null = null;
    await agir(
      () => {
        quando = agendar ? horarioEnvio(form.quando || amanha9h()) : null;
        return rpcAdmin("admin_campanha_salvar_v2", {
          p_id: form.id,
          p_revisao: form.revisao,
          p_titulo: form.titulo,
          p_mensagem: form.mensagem,
          p_publico: form.publico,
          p_link: form.link,
          p_agendar_para: quando,
        });
      },
      () => agendar ? `Agendada para ${dataCurta(quando)}. Dá para cancelar até a hora do envio.` : "Rascunho salvo.",
      true,
    );
  }

  function testar() {
    agir(
      () => rpcAdmin<number>("admin_campanha_testar", { p_titulo: form.titulo, p_mensagem: form.mensagem, p_link: form.link }),
      "Enviada para o seu celular (com [Teste] no título). Não conta nas métricas.",
    );
  }

  function editar(c: Campanha) {
    if (ocupado) return;
    if (c.status !== "rascunho" && c.status !== "agendada") return;
    if (!Number.isSafeInteger(c.revisao) || c.revisao < 1) { setErro("Atualize o painel para editar esta campanha."); return; }
    const quando = c.agendada_para ? horarioLocal(new Date(c.agendada_para)) : "";
    setForm({ id: c.id, revisao: c.revisao, titulo: c.titulo, mensagem: c.mensagem, publico: c.publico, link: c.link ?? "/inicio", quando });
    setAviso(null);
  }

  function cancelar() {
    if (ocupado || !form.id || !window.confirm(`Cancelar "${form.titulo}"? Ela não será enviada.`)) return;
    agir(() => rpcAdmin("admin_campanha_cancelar_v2", { p_id: form.id, p_revisao: form.revisao }), "Campanha cancelada.", true);
  }

  if (!dados) return <><Cabecalho titulo="Campanhas e notificações" subtitulo="Acompanhe os dados e as atividades desta área" /><div className="admin-bloco" role={erro ? "alert" : "status"}><p className={erro ? "text-sm text-perigo" : "text-sm text-cinza"}>{erro ?? "Carregando dados…"}</p></div></>;
  const alcance = estimativa?.publico === form.publico ? estimativa : null;
  const valido = form.titulo.trim().length >= 3 && form.mensagem.trim().length >= 3;
  const campo = "w-full rounded-2xl bg-suave px-4 pb-2.5 pt-6 text-[13px] font-semibold outline-none disabled:text-cinza";
  const rotulo = "pointer-events-none absolute left-4 top-2 text-[11px] font-semibold text-cinza";

  return (
    <>
      <Cabecalho titulo="Campanhas e notificações" subtitulo="Avisos para os tutores, com público e horário">
        <button disabled={ocupado} onClick={carregar} className="h-10 rounded-full bg-suave px-5 text-[13px] font-bold disabled:opacity-40">Atualizar lista</button>
        {pode ? (
          <button disabled={ocupado} onClick={() => setForm({ ...VAZIO, quando: amanha9h() })} className="h-10 rounded-full bg-tinta px-5 text-[13px] font-bold text-white disabled:opacity-40">
            Nova campanha
          </button>
        ) : null}
      </Cabecalho>
      {erro ? <p role="alert" className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
      {aviso ? <p role="status" className="mb-3 rounded-2xl bg-verde-fundo p-3 text-sm text-verde-texto">{aviso}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Enviadas (30d)" valor={numero(dados.enviadas_30d)} apoio="Push no celular" fundo="bg-azul-fundo" cor="text-azul-escuro" />
        <CartaoNumero rotulo="Taxa de abertura" valor={pct(dados.abertas_30d, dados.enviadas_30d)} apoio="Tocaram na notificação ou leram na caixa" fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero rotulo="Podem receber" valor={numero(dados.com_aceite)} apoio="Com aceite, fora quem já recebeu hoje" fundo="bg-roxo-fundo" cor="text-roxo-texto" />
        <CartaoNumero
          rotulo="Agendadas"
          valor={numero(dados.agendadas)}
          apoio={dados.proxima ? `Próxima ${dataCurta(dados.proxima)}` : "Nenhuma na fila"}
          fundo="bg-amarelo-fundo"
          cor="text-amarelo-texto"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <section className="min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-5">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="whitespace-nowrap py-2 pr-3">Campanha</th>
                <th className="whitespace-nowrap py-2 pr-3">Público</th>
                <th className="whitespace-nowrap py-2 pr-3">Envio</th>
                <th className="whitespace-nowrap py-2 pr-3">Abertura</th>
                <th className="whitespace-nowrap py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.campanhas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-cinza">Nenhuma campanha ainda.</td>
                </tr>
              ) : (
                dados.campanhas.map((c) => {
                  const editavel = pode && !ocupado && (c.status === "rascunho" || c.status === "agendada");
                  return (
                    <tr
                      key={c.id}
                      onClick={() => editavel && editar(c)}
                      className={`border-t border-[#EEF0F4] ${editavel ? "cursor-pointer hover:bg-suave" : ""} ${form.id === c.id ? "bg-azul-fundo" : ""}`}
                    >
                      <td className="py-3">
                        <p className="font-semibold">{c.titulo}</p>
                        <p className="max-w-64 truncate text-xs text-cinza">{c.mensagem}</p>
                      </td>
                      <td className="py-3">{PUBLICOS[c.publico]}</td>
                      <td className="whitespace-nowrap py-3 pr-3">{dataCurta(c.enviada_em ?? c.agendada_para)}</td>
                      <td className="py-3">
                        {c.status === "enviada" ? (
                          <span title={`${c.abertas} de ${c.destinatarios ?? 0}`}>{pct(c.abertas, c.destinatarios)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[c.status].cor}`}>{STATUS[c.status].rotulo}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        <section aria-busy={ocupado} className="h-fit min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">{form.id ? "Editar campanha" : "Nova campanha"}</h2>
            {form.id ? (
              <button disabled={ocupado} onClick={() => setForm(VAZIO)} className="text-xs font-bold text-azul-escuro underline disabled:opacity-40">
                Nova campanha
              </button>
            ) : null}
          </div>
          <fieldset disabled={!pode || ocupado} className="mt-3 space-y-2.5">
            <div className="relative">
              <label htmlFor="c-publico" className={rotulo}>Público</label>
              <select id="c-publico" value={form.publico} onChange={(e) => setForm({ ...form, publico: e.target.value as Publico })} className={campo}>
                {Object.entries(PUBLICOS).map(([valor, texto]) => (
                  <option key={valor} value={valor}>{texto}</option>
                ))}
              </select>
            </div>
            <p className="px-1 text-[11px] text-cinza">
              {!alcance ? "Calculando o alcance…" : alcance.total === null ? "Não foi possível calcular o alcance. Ele será conferido novamente na hora do envio." : `${numero(alcance.total)} ${alcance.total === 1 ? "tutor recebe" : "tutores recebem"} hoje (com aceite e sem campanha nas últimas 20 h).`}
            </p>
            <div className="relative">
              <label htmlFor="c-titulo" className={rotulo}>Título ({form.titulo.length}/65)</label>
              <input id="c-titulo" maxLength={65} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={campo} />
            </div>
            <div className="relative">
              <label htmlFor="c-mensagem" className={rotulo}>Mensagem ({form.mensagem.length}/180)</label>
              <textarea id="c-mensagem" maxLength={180} rows={3} value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className={`${campo} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="relative">
                <label htmlFor="c-link" className={rotulo}>Ao tocar, abre</label>
                <select id="c-link" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value as Link })} className={campo}>
                  {Object.entries(LINKS).map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <label htmlFor="c-quando" className={rotulo}>Envio</label>
                <input id="c-quando" type="datetime-local" value={form.quando || amanha9h()} onChange={(e) => setForm({ ...form, quando: e.target.value })} className={campo} />
              </div>
            </div>
            <div className="relative">
              <p className={rotulo}>Canal</p>
              <p className={`${campo} text-cinza`}>Push no celular (e-mail quando houver o provedor)</p>
            </div>
          </fieldset>

          {pode ? (
            <>
              <div className="mt-4 flex flex-wrap gap-2">
                <button disabled={!valido || ocupado} onClick={() => salvar(true)} className="h-11 rounded-full bg-tinta px-5 text-[13px] font-bold text-white disabled:opacity-40">
                  Agendar envio
                </button>
                <button disabled={!valido || ocupado} onClick={testar} className="h-11 rounded-full border border-[#DDE1E8] px-5 text-[13px] font-bold disabled:opacity-40">
                  Testar no meu celular
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-bold">
                <button disabled={!valido || ocupado} onClick={() => salvar(false)} className="text-azul-escuro underline disabled:opacity-40">
                  Salvar rascunho
                </button>
                {form.id ? (
                  <button disabled={ocupado} onClick={cancelar} className="text-perigo underline disabled:opacity-40">
                    Cancelar campanha
                  </button>
                ) : null}
              </div>
              {ocupado ? <p role="status" className="mt-3 text-xs text-cinza">Processando…</p> : null}
            </>
          ) : (
            <p className="mt-3 text-[11px] text-cinza">Só marketing e super admin enviam campanhas.</p>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-cinza">
            Só recebe quem aceitou &quot;Dicas e novidades&quot; e está com os avisos ligados. Cada tutor recebe no máximo uma campanha por dia, e ela também
            fica na caixa de avisos do app.
          </p>
          {dados.campanhas.length > 0 && dados.campanhas[0].por ? (
            <p className="mt-2 text-[11px] text-cinza">Última criada por {dados.campanhas[0].por} {haQuanto(dados.campanhas[0].criada_em)}.</p>
          ) : null}
        </section>
      </div>
    </>
  );
}
