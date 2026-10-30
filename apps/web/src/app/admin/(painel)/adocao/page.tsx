"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Cabecalho, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin, supabaseAdmin } from "@/lib/admin/supabase";

type Ong = { id: string; nome: string; cidade: string; bairro: string; status: string; revisao: number; motivo_decisao: string | null; cnpj: string | null; responsavel_nome: string | null; email: string | null; telefone: string | null; documentos: string[]; correcao_motivo?: string|null };
type Pet = { id: string; nome: string; especie: string; descricao: string; fotos: string[]; status: string; versao: number; ong_nome: string; ong_status: string; confirmado_em?: string; moderacao_motivo?: string|null; moderacao_em?: string|null };
const ROTULOS: Record<string, string> = { pendente: "Em análise", aprovada: "Aprovada", recusada: "Recusada", suspensa: "Suspensa", publicado: "Publicado", oculto: "Oculto", correcao: "Pedir correções" };
const DOCUMENTOS: Record<string, string> = { estatuto: "Estatuto", comprovante: "Comprovante da ONG", responsavel: "Documento do responsável" };
const campo = "rounded-2xl border border-[#DDE1E8] bg-white px-4 py-2 text-sm";

function fotoDoStorage(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin
      && url.pathname.startsWith("/storage/v1/object/public/pets/");
  } catch { return false; }
}

export default function Adocao() {
  const admin = useAdmin();
  if (!["super", "moderacao", "leitura"].includes(admin.papel)) return <p role="alert">Sua função não permite consultar adoção e ONGs.</p>;
  return <PainelAdocao podeDecidir={admin.papel !== "leitura"} />;
}

function PainelAdocao({ podeDecidir }: { podeDecidir: boolean }) {
  const [aba, setAba] = useState<"ongs" | "pets">("ongs");
  const [status, setStatus] = useState("pendente");
  const [pagina, setPagina] = useState(0);
  const [tentativa, setTentativa] = useState(0);
  const [resposta, setResposta] = useState<{ chave: string; dados?: { total: number; itens: (Ong | Pet)[] }; erro?: boolean } | null>(null);
  const [ong, setOng] = useState<Ong | null>(null);
  const [pet, setPet] = useState<Pet | null>(null);
  const [decisao, setDecisao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [documento, setDocumento] = useState<{ id: string; tipo: string; url: string } | null>(null);
  const trava = useRef(false);
  const vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const chave = JSON.stringify([aba, status, pagina, tentativa]);
  useEffect(() => {
    let ativo = true;
    void rpcAdmin<{ total: number; itens: (Ong | Pet)[] }>(aba === "ongs" ? "admin_ongs" : "admin_adocao_pets", { p_status: status, p_pagina: pagina })
      .then(dados => { if (ativo) setResposta({ chave, dados }); })
      .catch(() => { if (ativo) setResposta({ chave, erro: true }); });
    return () => { ativo = false; };
  }, [aba, status, pagina, chave]);
  const consulta = resposta?.chave === chave ? resposta : null;
  function limpar() { setOng(null); setPet(null); setDocumento(null); setDecisao(""); setMotivo(""); setConfirmo(false); setMensagem(""); }
  function filtrar(valor: string) { limpar(); setStatus(valor); setPagina(0); }
  async function verDocumento(tipo: string) {
    if (!ong || trava.current) return;
    trava.current = true; setOcupado(true); setMensagem(""); setDocumento(null);
    try {
      const path = await rpcAdmin<string>("admin_ong_documento", { p_id: ong.id, p_tipo: tipo });
      if (!vivo.current) return;
      const { data, error } = await supabaseAdmin().storage.from("ong-documentos").createSignedUrl(path, 60);
      if (error || !data?.signedUrl) throw new Error("Não foi possível abrir o documento. Tente novamente.");
      if (vivo.current) setDocumento({ id: ong.id, tipo, url: data.signedUrl });
    } catch (e) { if (vivo.current) setMensagem(e instanceof Error ? e.message : "Falha ao consultar documento."); }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  }
  async function aplicar() {
    if (trava.current || !confirmo || motivo.trim().length < 5) return;
    trava.current = true; setOcupado(true); setMensagem("");
    try {
      if (ong) await rpcAdmin(decisao === "correcao" ? "admin_ong_pedir_correcao" : "admin_ong_decidir", { p_id: ong.id, p_revisao: ong.revisao, ...(decisao === "correcao" ? {} : { p_status: decisao }), p_motivo: motivo.trim() });
      else if (pet) await rpcAdmin(pet.status === "oculto" ? "admin_adocao_pet_republicar" : "admin_adocao_pet_ocultar", { p_id: pet.id, p_versao: pet.versao, p_motivo: motivo.trim() });
      else return;
      if (vivo.current) { limpar(); setMensagem("Decisão registrada com sucesso."); setTentativa(n => n + 1); }
    } catch (e) { if (vivo.current) setMensagem(e instanceof Error ? e.message : "Não foi possível registrar a decisão."); }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  }
  const estados = aba === "ongs" ? ["pendente", "aprovada", "suspensa", "recusada"] : ["publicado", "oculto"];
  const acoes = ong?.correcao_motivo ? [] : ong?.status === "pendente" ? ["aprovada", "correcao", "recusada"] : ong?.status === "aprovada" ? ["suspensa"] : ong?.status === "suspensa" ? ["aprovada"] : ong?.status === "recusada" ? ["correcao"] : [];
  const dados = consulta?.dados;
  return <>
    <Cabecalho titulo="Adoção e ONGs" subtitulo="Análise de cadastros, documentos privados e anúncios de adoção" />
    <div className="mb-4 flex flex-wrap items-center gap-3">
      {(["ongs", "pets"] as const).map(a => <button key={a} disabled={ocupado} aria-pressed={aba === a} className={`${campo} ${aba === a ? "bg-roxo-fundo font-bold" : ""}`} onClick={() => { limpar(); setAba(a); setStatus(a === "ongs" ? "pendente" : "publicado"); setPagina(0); }}>{a === "ongs" ? "ONGs" : "Pets para adoção"}</button>)}
      <label className="flex items-center gap-2 text-sm">Status<select disabled={ocupado} className={campo} value={status} onChange={e => filtrar(e.target.value)}>{estados.map(s => <option key={s} value={s}>{ROTULOS[s]}</option>)}</select></label>
      <button disabled={ocupado} className={campo} onClick={() => { limpar(); setTentativa(n => n + 1); }}>Atualizar</button>
    </div>
    {mensagem ? <p role="status" className="mb-4 rounded-2xl bg-amarelo-fundo p-4 text-sm">{mensagem}</p> : null}
    {!consulta ? <p role="status">Carregando…</p> : consulta.erro ? <p role="alert">Não foi possível consultar. Confira a conexão e seu acesso e use Atualizar para tentar novamente.</p> : dados ? <>
      <div className="overflow-x-auto admin-surface bg-fundo"><table className="w-full text-left text-sm"><caption className="p-4 text-left font-bold">{dados.total} registro(s)</caption><thead><tr><th className="p-4">{aba === "ongs" ? "ONG" : "Pet"}</th><th className="p-4">{aba === "ongs" ? "Localização" : "ONG responsável"}</th><th className="p-4">Status</th><th className="p-4">Análise</th></tr></thead><tbody>
        {dados.itens.map(l => <tr key={l.id} className="border-t border-[#DDE1E8]"><td className="p-4 font-bold">{l.nome}</td><td className="p-4">{"cidade" in l ? `${l.cidade} · ${l.bairro}` : `${l.ong_nome} (${ROTULOS[l.ong_status]})`}</td><td className="p-4">{ROTULOS[l.status]}</td><td className="p-4"><button disabled={ocupado} className="rounded-full bg-azul-fundo px-4 py-2 font-bold" aria-label={`Analisar ${l.nome}`} onClick={() => { limpar(); if ("cidade" in l) setOng(l); else setPet(l); }}>Ver detalhes</button></td></tr>)}
        {!dados.itens.length ? <tr><td colSpan={4} className="p-6">Nenhum registro neste status.</td></tr> : null}
      </tbody></table></div>
      <nav aria-label="Paginação de adoção" className="my-4 flex items-center gap-3"><button disabled={ocupado || pagina === 0} className={campo} onClick={() => { limpar(); setPagina(p => p - 1); }}>Anterior</button><span>Página {pagina + 1} de {Math.max(1, Math.ceil(dados.total / 20))}</span><button disabled={ocupado || (pagina + 1) * 20 >= dados.total} className={campo} onClick={() => { limpar(); setPagina(p => p + 1); }}>Próxima</button></nav>
    </> : null}
    {ong || pet ? <section className="admin-surface bg-fundo p-6" aria-label="Análise do registro"><h2 className="mb-4 text-xl font-bold">{ong?.nome ?? pet?.nome}</h2>
      {ong ? <><dl className="grid gap-3 text-sm sm:grid-cols-2">{[["CNPJ", ong.cnpj], ["Responsável", ong.responsavel_nome], ["E-mail", ong.email], ["Telefone", ong.telefone], ["Última decisão", ong.motivo_decisao]].map(([r, v]) => <div key={r}><dt className="text-xs text-cinza">{r}</dt><dd className="whitespace-pre-wrap break-words">{v || "Não informado"}</dd></div>)}</dl>
        <h3 className="mb-2 mt-4 font-bold">Documentos privados</h3>{podeDecidir ? <div className="flex flex-wrap gap-2">{ong.documentos.map(tipo => <button key={tipo} disabled={ocupado} className={campo} onClick={() => verDocumento(tipo)}>{DOCUMENTOS[tipo] ?? tipo}</button>)}{!ong.documentos.length ? <p className="text-sm">Não há documentos enviados para análise.</p> : null}</div> : <p className="text-sm">Documentos e decisões exigem o papel de Moderação ou Super admin.</p>}
        {documento?.id === ong.id ? <p className="mt-3 text-sm"><a className="font-bold underline" target="_blank" rel="noopener noreferrer" href={documento.url}>Abrir {DOCUMENTOS[documento.tipo] ?? "documento"}</a> · Link válido por 60 segundos.</p> : null}
        {ong.correcao_motivo ? <p className="mt-3 rounded-2xl bg-amarelo-fundo p-3 text-sm">Aguardando correções do responsável: {ong.correcao_motivo}</p> : null}
      </> : <><p className="whitespace-pre-wrap text-sm">{pet?.descricao}</p>
        {pet?.moderacao_motivo ? <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-amarelo-fundo p-3 text-sm">Última moderação: {pet.moderacao_motivo}{pet.moderacao_em ? ` · ${new Date(pet.moderacao_em).toLocaleString("pt-BR")}` : ""}</p> : null}
        {pet?.confirmado_em ? <p className="mt-3 text-sm text-cinza">Disponibilidade confirmada pela ONG em {new Date(pet.confirmado_em).toLocaleDateString("pt-BR")}. Sem confirmação há 60 dias, o anúncio fica fora do catálogo mesmo se estiver publicado.</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">{pet?.fotos.filter(fotoDoStorage).map((url, i) => <Image key={url} unoptimized src={url} width={180} height={180} alt={`Foto ${i + 1} de ${pet.nome}`} referrerPolicy="no-referrer" className="h-44 w-44 rounded-2xl object-cover" />)}</div>
        {!pet?.fotos.some(fotoDoStorage) ? <p className="mt-2 text-sm text-cinza">Nenhuma foto do armazenamento disponível neste registro.</p> : null}
      </>}
      {podeDecidir && (acoes.length > 0 || pet?.status === "publicado" || (pet?.status === "oculto" && pet.ong_status === "aprovada")) ? <form className="mt-5 flex max-w-xl flex-col gap-3" onSubmit={e => { e.preventDefault(); void aplicar(); }}>
        {ong ? <label className="flex flex-col gap-1 text-sm">Decisão<select required disabled={ocupado} className={campo} value={decisao} onChange={e => { setDecisao(e.target.value); setConfirmo(false); }}><option value="">Selecione</option>{acoes.map(s => <option key={s} value={s}>{ROTULOS[s]}</option>)}</select></label> : <p className="font-bold">{pet?.status === "oculto" ? "Republicar anúncio após revisão" : "Ocultar anúncio de adoção"}</p>}
        <label className="flex flex-col gap-1 text-sm">Motivo da decisão{pet ? " (visível ao responsável)" : ""}<textarea required minLength={5} maxLength={500} disabled={ocupado} className={campo} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmo} disabled={ocupado} onChange={e => setConfirmo(e.target.checked)} />Conferi os dados{ong ? " e documentos" : " do anúncio"} e confirmo esta decisão. Ela ficará registrada na auditoria.</label>
        <button className="rounded-full bg-tinta px-5 py-3 font-bold text-white disabled:opacity-50" disabled={ocupado || !confirmo || motivo.trim().length < 5 || (!!ong && !decisao)}>{ocupado ? "Registrando…" : "Registrar decisão"}</button>
        {decisao === "suspensa" ? <p className="text-sm text-cinza">A suspensão tira os pets desta ONG do catálogo público.</p> : null}
        {decisao === "correcao" ? <p className="text-sm text-cinza">O motivo será exibido ao responsável no app. O cadastro volta a ser editável e precisará ser reenviado para análise; a ONG continua sem aprovação.</p> : null}
        {pet?.status === "oculto" ? <p className="text-sm text-cinza">Republicar não renova a confirmação de disponibilidade. Anúncios antigos continuam fora do catálogo até a ONG confirmar novamente.</p> : null}
      </form> : null}
    </section> : null}
  </>;
}
