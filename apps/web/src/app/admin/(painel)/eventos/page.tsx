"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cabecalho, EstadoPainel, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";
import { EventoOficial } from "./EventoOficial";
import { Organizadores } from "./Organizadores";

type Status = "em_analise" | "publicado" | "ajuste_solicitado" | "recusado" | "cancelado" | "encerrado" | "oculto";
type Item = {
  id: string; titulo: string; tipo: string; descricao: string; inicio_em: string; fim_em: string;
  local_nome: string; place_id: string | null; lat: number | null; lng: number | null;
  gratuito: boolean; preco_centavos: number | null; ingresso_url: string | null; vagas: number | null;
  status: Status; motivo_status: string | null; criado_em: string; organizador: string;
  confirmados: number; denuncias: number;
};
type Resultado = { em_analise: number; ocultos: number; itens: Item[] };
type Acao = "publicado" | "ajuste_solicitado" | "recusado" | "revisado" | "oculto";
const ABAS: { status: Status; rotulo: string }[] = [
  { status: "em_analise", rotulo: "Para revisar" }, { status: "oculto", rotulo: "Denunciados" },
  { status: "publicado", rotulo: "Publicados" }, { status: "ajuste_solicitado", rotulo: "Ajustes" },
  { status: "recusado", rotulo: "Recusados" }, { status: "encerrado", rotulo: "Encerrados" },
  { status: "cancelado", rotulo: "Cancelados" },
];
const rotulos: Record<Status, string> = { em_analise: "Em análise", publicado: "Publicado", ajuste_solicitado: "Ajustes solicitados", recusado: "Recusado", cancelado: "Cancelado", encerrado: "Encerrado", oculto: "Oculto por denúncias" };

export default function EventosAdmin() {
  const admin = useAdmin();
  const pode = admin.papel === "super" || admin.papel === "moderacao";
  const [status, setStatus] = useState<Status>("em_analise");
  const [dados, setDados] = useState<Resultado | null>(null);
  const [selecionado, setSelecionado] = useState<Item | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const requisicao = useRef(0);
  const decisaoEmCurso = useRef(false);
  const invalidarRequisicao = useCallback(() => { requisicao.current++; }, []);
  const carregar = useCallback(async (filtro: Status) => {
    const numero = ++requisicao.current;
    setCarregando(true); setErro(null);
    try {
      const resultado = await rpcAdmin<Resultado>("admin_eventos", { p_status: filtro });
      if (numero !== requisicao.current) return;
      setDados(resultado);
      setSelecionado((atual) => atual ? resultado.itens.find((evento) => evento.id === atual.id) ?? null : resultado.itens[0] ?? null);
    } catch (e) { if (numero === requisicao.current) { setDados(null); setSelecionado(null); setErro((e as Error).message); } }
    finally { if (numero === requisicao.current) setCarregando(false); }
  }, []);
  useEffect(() => {
    const temporizador = setTimeout(() => { void carregar(status); }, 0);
    return () => { clearTimeout(temporizador); invalidarRequisicao(); };
  }, [carregar, status, invalidarRequisicao]);

  async function moderar(acao: Acao) {
    if (!selecionado || decisaoEmCurso.current || carregando || !pode) return;
    decisaoEmCurso.current = true;
    setSalvando(true); setErro(null);
    try {
      await rpcAdmin("evento_moderar", { p_event_id: selecionado.id, p_acao: acao, p_motivo: motivo.trim() || null });
      setMotivo(""); await carregar(status);
    } catch (e) { setErro((e as Error).message); }
    finally { decisaoEmCurso.current = false; setSalvando(false); }
  }

  const inicio = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(valor));
  const acoes: { acao: Acao; rotulo: string; motivo: boolean }[] = selecionado ? ({
    em_analise: [{ acao: "publicado", rotulo: "Aprovar e publicar", motivo: false }, { acao: "ajuste_solicitado", rotulo: "Pedir ajustes", motivo: true }, { acao: "recusado", rotulo: "Recusar", motivo: true }],
    publicado: [{ acao: "ajuste_solicitado", rotulo: "Pedir ajustes", motivo: true }, { acao: "oculto", rotulo: "Ocultar", motivo: true }],
    ajuste_solicitado: [{ acao: "publicado", rotulo: "Aprovar e publicar", motivo: false }, { acao: "recusado", rotulo: "Recusar", motivo: true }],
    oculto: [{ acao: "revisado", rotulo: "Revisar e republicar", motivo: false }],
    recusado: [], cancelado: [], encerrado: [],
  } satisfies Record<Status, { acao: Acao; rotulo: string; motivo: boolean }[]>)[selecionado.status] : [];
  return <>
    <Cabecalho titulo="Eventos" subtitulo="Revise eventos enviados, trate denúncias e mantenha o mapa seguro." />
    {pode ? <EventoOficial onPublicado={() => { requisicao.current++; setStatus("publicado"); void carregar("publicado"); }} /> : null}
    {erro ? <p role="alert" className="mb-4 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}
    <button disabled={salvando || carregando} onClick={() => void carregar(status)} className="mb-4 rounded-full bg-fundo px-4 py-2 text-sm disabled:opacity-50">Atualizar fila</button>
    <div className="mb-4 grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-fundo p-4"><p className="text-sm text-cinza">Para revisar</p><p className="text-2xl font-bold">{dados?.em_analise ?? "—"}</p></div>
      <div className="rounded-2xl bg-rosa-fundo p-4"><p className="text-sm text-rosa-texto">Ocultos por denúncias</p><p className="text-2xl font-bold">{dados?.ocultos ?? "—"}</p></div>
    </div>
    <div className="mb-4 flex flex-wrap gap-2">{ABAS.map((aba) => <button key={aba.status} disabled={salvando} aria-pressed={status === aba.status} onClick={() => { if (status === aba.status) return; requisicao.current++; setStatus(aba.status); setDados(null); setSelecionado(null); setMotivo(""); }} className={`rounded-full px-4 py-2 text-sm ${status === aba.status ? "bg-preto text-white" : "bg-fundo text-texto"}`}>{aba.rotulo}</button>)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
      <section className="max-h-[70vh] overflow-auto admin-surface border border-borda bg-fundo shadow-sm p-3">
        {carregando ? <p className="p-4 text-sm text-cinza">Carregando…</p> : !dados?.itens.length ? <p className="p-4 text-sm text-cinza">Nenhum evento nesta fila.</p> : dados.itens.map((evento) => <button key={evento.id} disabled={salvando} onClick={() => { setSelecionado(evento); setMotivo(evento.motivo_status ?? ""); }} className={`mb-2 block w-full rounded-2xl p-4 text-left ${selecionado?.id === evento.id ? "bg-white ring-2 ring-azul" : "bg-white/60"}`}>
          <span className="flex items-center justify-between gap-2"><strong className="text-sm">{evento.titulo}</strong><span className="rounded-full bg-amarelo-fundo px-2 py-1 text-xs">{evento.denuncias ? `${evento.denuncias} denúncias` : rotulos[evento.status]}</span></span>
          <span className="mt-2 block text-xs text-cinza">{evento.organizador} · {inicio(evento.inicio_em)}</span>
          <span className="mt-1 block text-xs text-cinza">{evento.local_nome} · {evento.confirmados} confirmados</span>
        </button>)}</section>
      <section className="admin-surface border border-borda bg-white p-5">
        {!selecionado ? <EstadoPainel titulo="Análise do evento">Selecione um evento para revisar.</EstadoPainel> : <>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs text-azul-escuro">{selecionado.tipo} · {rotulos[selecionado.status]}</p><h2 className="mt-1 text-xl font-bold">{selecionado.titulo}</h2></div><span className="rounded-full bg-rosa-fundo px-3 py-1 text-xs text-rosa-texto">{selecionado.denuncias} denúncias</span></div>
          <p className="mt-3 text-sm">{selecionado.descricao}</p><dl className="mt-4 grid gap-2 text-sm"><div><dt className="font-semibold">Organizador</dt><dd>{selecionado.organizador}</dd></div><div><dt className="font-semibold">Quando</dt><dd>{inicio(selecionado.inicio_em)} – {inicio(selecionado.fim_em)}</dd></div><div><dt className="font-semibold">Onde</dt><dd>{selecionado.local_nome}{selecionado.place_id ? ` · Google Place ID ${selecionado.place_id}` : ` · ${selecionado.lat}, ${selecionado.lng}`}</dd></div><div><dt className="font-semibold">Entrada</dt><dd>{selecionado.gratuito ? "Gratuita" : `R$ ${((selecionado.preco_centavos ?? 0) / 100).toFixed(2).replace(".", ",")} · ${selecionado.ingresso_url}`}</dd></div><div><dt className="font-semibold">Vagas</dt><dd>{selecionado.vagas ?? "Sem limite informado"}</dd></div></dl>
          <label className="mt-5 block text-sm font-semibold" htmlFor="motivo">Motivo ou instrução para o organizador</label><textarea id="motivo" disabled={salvando || carregando || !pode || !acoes.length} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} className="mt-2 min-h-24 w-full rounded-2xl border border-borda p-3 text-sm" placeholder="Descreva o motivo de ajuste, recusa ou decisão sobre denúncia." />
          {pode ? <div className="mt-4 flex flex-wrap gap-2" aria-busy={salvando}>
            {acoes.map((item) => <button key={item.acao} onClick={() => void moderar(item.acao)} disabled={salvando || carregando || (item.motivo && !motivo.trim())} className="rounded-full bg-fundo px-4 py-2 text-sm font-semibold disabled:opacity-50">{item.rotulo}</button>)}
            {salvando ? <p role="status" className="text-sm text-cinza">Salvando decisão…</p> : !acoes.length ? <p className="text-sm text-cinza">Este evento não permite novas decisões neste estado.</p> : null}
          </div> : <p className="mt-4 text-xs text-cinza">Sua função permite leitura; decisões ficam disponíveis para a equipe de moderação.</p>}

        </>}
      </section>
    </div>
    <Organizadores pode={pode} />
  </>;
}
