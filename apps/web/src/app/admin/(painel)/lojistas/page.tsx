"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, EstadoPainel, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin, supabaseAdmin } from "@/lib/admin/supabase";

type Status = "rascunho" | "em_analise" | "aprovada" | "correcao_pedida" | "recusada" | "suspensa";
type Loja = {
  id: string;
  name: string;
  kind: string;
  oferece: string;
  status: Status;
  documento: string | null;
  responsavel: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  motivo_status: string | null;
  enviada_em: string | null;
  criado_em: string;
  dono: string | null;
  documentos: { id: string; tipo: string; path: string; status: string }[];
  produtos: number;
  servicos: number;
  lugar: { claim_id: string; place_id: string; nome: string; endereco: string | null; telefone: string | null; status: string } | null;
};
type Dados = { contagem: Partial<Record<Status, number>>; lojas: Loja[] };
type Denuncia = { kind: "produto" | "avaliacao" | "loja"; target_id: string; loja: string; denuncias: number; motivos: string[]; ultima: string; resumo: string | null };

const ABAS: { valor: Status | "todas"; rotulo: string }[] = [
  { valor: "em_analise", rotulo: "Aguardando aprovação" },
  { valor: "correcao_pedida", rotulo: "Correção pedida" },
  { valor: "aprovada", rotulo: "Publicadas" },
  { valor: "suspensa", rotulo: "Suspensas" },
  { valor: "recusada", rotulo: "Recusadas" },
  { valor: "rascunho", rotulo: "Rascunhos" },
];
const DOC: Record<string, string> = { cnpj: "Cartão CNPJ", documento_responsavel: "Documento do responsável", comprovante_endereco: "Comprovante de endereço", alvara: "Alvará", crmv: "CRMV", outro: "Outro" };
const KIND: Record<Denuncia["kind"], string> = { produto: "Produto", avaliacao: "Avaliação", loja: "Loja" };

function formatarDocumento(d: string | null) {
  if (!d) return "—";
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
}

/**
 * Lojistas (BUSINESS.md 19.14 e 20.5): fila de aprovação com documentos e o
 * lugar do mapa que a loja pediu para assumir. Aprovar só liga o lugar se a
 * moderação conferir que quem cadastrou é o dono. Abaixo, denúncias de
 * produtos, avaliações e lojas.
 */
export default function LojistasPagina() {
  const admin = useAdmin();
  const pode = admin.papel === "super" || admin.papel === "moderacao";
  const [aba, setAba] = useState<Status | "todas">("em_analise");
  const [dados, setDados] = useState<Dados | null>(null);
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [sel, setSel] = useState<Loja | null>(null);
  const [motivo, setMotivo] = useState("");
  const [lugarOk, setLugarOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    rpcAdmin<Dados>("admin_lojas", { p_status: aba }).then(
      (d) => {
        setDados(d);
        setSel((atual) => (atual ? (d.lojas.find((l) => l.id === atual.id) ?? null) : null));
      },
      (e: Error) => setErro(e.message),
    );
    rpcAdmin<Denuncia[]>("admin_loja_denuncias").then(setDenuncias, () => undefined);
  }, [aba]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function abrirDocumento(path: string) {
    const { data, error } = await supabaseAdmin().storage.from("lojas-docs").createSignedUrl(path, 300);
    if (error || !data) return setErro("Não deu para abrir o documento.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function decidir(acao: "aprovar" | "correcao" | "recusar" | "suspender" | "reativar") {
    if (!sel) return;
    setErro(null);
    try {
      await rpcAdmin("admin_loja_decidir", { p_store: sel.id, p_acao: acao, p_motivo: motivo || null, p_lugar_ok: sel.lugar?.status === "pendente" ? lugarOk : null });
      setMotivo("");
      setLugarOk(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function decidirDenuncia(d: Denuncia, remover: boolean) {
    setErro(null);
    try {
      await rpcAdmin("admin_loja_denuncia_decidir", { p_kind: d.kind, p_target: d.target_id, p_remover: remover });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (!dados) return <><Cabecalho titulo="Lojistas" subtitulo="Acompanhe os dados e as atividades desta área" /><div className="admin-bloco" role={erro ? "alert" : "status"}><p className={erro ? "text-sm text-perigo" : "text-sm text-cinza"}>{erro ?? "Carregando dados…"}</p></div></>;

  return (
    <>
      <Cabecalho titulo="Lojistas" subtitulo="Aprovação de cadastro, documentos e denúncias" />
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Aguardando aprovação" valor={numero(dados.contagem.em_analise)} apoio="Meta: até 2 dias úteis" fundo="bg-rosa-fundo" cor="text-rosa-texto" />
        <CartaoNumero rotulo="Publicadas" valor={numero(dados.contagem.aprovada)} apoio="Aparecem para os tutores" fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero rotulo="Correção pedida" valor={numero(dados.contagem.correcao_pedida)} apoio="Esperando o lojista" fundo="bg-amarelo-fundo" cor="text-amarelo-texto" />
        <CartaoNumero rotulo="Denúncias abertas" valor={numero(denuncias.length)} apoio="Produtos, avaliações e lojas" fundo="bg-azul-fundo" cor="text-azul-escuro" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-5">
          <div className="flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button key={a.valor} onClick={() => { setAba(a.valor); setSel(null); }} className={`h-9 rounded-full px-4 text-[13px] font-bold ${aba === a.valor ? "bg-tinta text-white" : "border border-[#DDE1E8]"}`}>
                {a.rotulo}
              </button>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="py-2">Loja</th>
                <th className="py-2">Dono</th>
                <th className="py-2">Catálogo</th>
                <th className="py-2">Enviada</th>
              </tr>
            </thead>
            <tbody>
              {dados.lojas.length === 0 ? (
                <tr><td colSpan={4} className="py-6 text-cinza">Nada aqui.</td></tr>
              ) : (
                dados.lojas.map((l) => (
                  <tr key={l.id} onClick={() => { setSel(l); setLugarOk(false); setMotivo(""); }} className={`cursor-pointer border-t border-[#EEF0F4] hover:bg-suave ${sel?.id === l.id ? "bg-azul-fundo" : ""}`}>
                    <td className="py-3">
                      <p className="font-semibold">{l.name}</p>
                      <p className="text-xs text-cinza">{[l.city, l.kind].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="py-3">{l.dono ?? "—"}</td>
                    <td className="py-3">{l.produtos} produtos · {l.servicos} serviços</td>
                    <td className="py-3 text-cinza">{l.enviada_em ? haQuanto(l.enviada_em) : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="h-fit min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-6">
          {!sel ? (
            <EstadoPainel titulo="Análise da loja">Escolha uma loja para revisar.</EstadoPainel>
          ) : (
            <>
              <h2 className="text-lg font-bold">{sel.name}</h2>
              <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1.5 text-[13px]">
                <dt className="text-cinza">CNPJ/CPF</dt><dd className="font-semibold">{formatarDocumento(sel.documento)}</dd>
                <dt className="text-cinza">Responsável</dt><dd>{sel.responsavel ?? "—"}</dd>
                <dt className="text-cinza">Endereço</dt><dd>{[sel.address, sel.city].filter(Boolean).join(", ") || "—"}</dd>
                <dt className="text-cinza">Telefone</dt><dd>{sel.phone ?? "—"}</dd>
                <dt className="text-cinza">Oferece</dt><dd>{sel.oferece}</dd>
              </dl>
              {sel.lat !== null && sel.lng !== null ? (
                <a href={`https://www.openstreetmap.org/?mlat=${sel.lat}&mlon=${sel.lng}#map=18/${sel.lat}/${sel.lng}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-azul-escuro underline">Ver o endereço no mapa</a>
              ) : null}

              <h3 className="mt-4 text-sm font-bold">Documentos</h3>
              {sel.documentos.length === 0 ? <p className="text-xs text-cinza">Nenhum documento enviado.</p> : (
                <ul className="mt-1 space-y-1 text-[13px]">
                  {sel.documentos.map((d) => (
                    <li key={d.id}><button onClick={() => abrirDocumento(d.path)} className="font-semibold text-azul-escuro underline">{DOC[d.tipo] ?? d.tipo}</button></li>
                  ))}
                </ul>
              )}

              {sel.lugar ? (
                <div className="mt-4 rounded-2xl bg-suave p-3 text-[13px]">
                  <p className="font-bold">Quer assumir o lugar do mapa</p>
                  <p>{sel.lugar.nome}{sel.lugar.endereco ? ` · ${sel.lugar.endereco}` : ""}</p>
                  <p className="text-xs text-cinza">Telefone do lugar: {sel.lugar.telefone ?? "—"} · pedido {sel.lugar.status}</p>
                  {sel.lugar.status === "pendente" && pode ? (
                    <label className="mt-2 flex items-center gap-2 text-[13px] font-semibold">
                      <input type="checkbox" checked={lugarOk} onChange={(e) => setLugarOk(e.target.checked)} className="h-4 w-4 accent-tinta" />
                      Conferi que quem cadastrou é o dono deste lugar
                    </label>
                  ) : null}
                </div>
              ) : null}

              {sel.motivo_status ? <p className="mt-3 text-xs text-cinza">Último motivo: {sel.motivo_status}</p> : null}

              {pode ? (
                <div className="mt-4 space-y-2">
                  {sel.status === "em_analise" ? (
                    <button onClick={() => decidir("aprovar")} className="h-11 w-full rounded-full bg-tinta text-[13px] font-bold text-white">Aprovar e publicar</button>
                  ) : null}
                  {sel.status === "suspensa" ? (
                    <button onClick={() => decidir("reativar")} className="h-11 w-full rounded-full bg-tinta text-[13px] font-bold text-white">Reativar</button>
                  ) : null}
                  {["em_analise", "correcao_pedida", "aprovada"].includes(sel.status) ? (
                    <div className="rounded-2xl border border-[#DDE1E8] p-3">
                      <label htmlFor="motivo" className="text-xs font-bold">Motivo (o lojista vê)</label>
                      <input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: envie o comprovante de endereço" className="mt-2 h-9 w-full rounded-full bg-suave px-3 text-[13px] outline-none" />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {sel.status === "em_analise" ? <button onClick={() => decidir("correcao")} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Pedir correção</button> : null}
                        {sel.status !== "aprovada" ? <button onClick={() => decidir("recusar")} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold text-perigo">Recusar</button> : null}
                        {sel.status === "aprovada" ? <button onClick={() => decidir("suspender")} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold text-perigo">Suspender</button> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

      <section className="mt-4 admin-surface border border-borda bg-fundo shadow-sm p-5">
        <h2 className="font-bold">Denúncias de produtos, avaliações e lojas</h2>
        {denuncias.length === 0 ? <p className="mt-3 text-sm text-cinza">Nenhuma denúncia aberta.</p> : (
          <ul className="mt-3 space-y-2">
            {denuncias.map((d) => (
              <li key={`${d.kind}-${d.target_id}`} className="flex flex-wrap items-start gap-3 rounded-2xl bg-suave px-4 py-3 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{KIND[d.kind]} · {d.loja} <span className="ml-1 rounded-full bg-rosa-fundo px-2 py-0.5 text-[11px] font-bold text-rosa-texto">{d.denuncias}</span></p>
                  {d.resumo ? <p className="mt-1 truncate">{d.resumo}</p> : null}
                  <p className="mt-1 text-xs text-cinza">{d.motivos.join(" · ")} · {haQuanto(d.ultima)}</p>
                </div>
                {pode ? (
                  <div className="flex gap-2">
                    <button onClick={() => decidirDenuncia(d, true)} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">{d.kind === "loja" ? "Suspender" : "Remover"}</button>
                    <button onClick={() => decidirDenuncia(d, false)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Manter</button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
