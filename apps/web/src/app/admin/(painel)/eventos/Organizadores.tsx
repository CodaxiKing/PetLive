"use client";
import { useEffect, useRef, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Organizador = { id: string; nome: string; verificado: boolean; versao: number; eventos: number; verificado_em: string | null };
type Lista = { total: number; itens: Organizador[] };
export function Organizadores({ pode }: { pode: boolean }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [revisao, setRevisao] = useState(0);
  const [consulta, setConsulta] = useState<{ chave: string; dados?: Lista; erro?: boolean }>();
  const [selecionado, setSelecionado] = useState<Organizador>();
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const trava = useRef(false);
  const chave = JSON.stringify([busca, pagina, revisao]);
  useEffect(() => {
    let atual = true;
    const timer = setTimeout(() => {
      void rpcAdmin<Lista>("admin_organizadores", { p_busca: busca, p_pagina: pagina })
        .then(dados => { if (atual) setConsulta({ chave, dados }); })
        .catch(() => { if (atual) setConsulta({ chave, erro: true }); });
    }, 250);
    return () => { atual = false; clearTimeout(timer); };
  }, [busca, pagina, revisao, chave]);
  const resultado = consulta?.chave === chave ? consulta : undefined;
  async function decidir(e: React.FormEvent) {
    e.preventDefault(); if (!selecionado || trava.current || !confirmado) return;
    trava.current = true; setSalvando(true); setErro(undefined); setAviso(undefined);
    try {
      await rpcAdmin("admin_organizador_verificar", { p_usuario: selecionado.id, p_versao: selecionado.versao, p_verificado: !selecionado.verificado, p_motivo: motivo, p_confirmar: confirmado });
      setAviso(selecionado.verificado ? "Verificação revogada. Novos eventos passam por análise." : "Organizador verificado. Novos eventos podem publicar direto.");
      setSelecionado(undefined); setRevisao(n => n + 1);
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { trava.current = false; setSalvando(false); }
  }
  return <section aria-label="Organizadores de eventos" className="mt-5 space-y-4 admin-surface bg-white p-5">
    <h2 className="text-lg font-bold">Organizadores</h2>
    <p className="text-sm text-cinza">Contas com eventos enviados ou perfil de organizador. Verificar permite publicação direta de novos eventos. Revogar não oculta eventos já publicados; use a moderação para tratar cada evento.</p>
    <label className="block text-sm">Buscar pelo nome<input disabled={salvando} maxLength={100} className="mt-1 w-full rounded-2xl border border-borda px-4 py-3" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} /></label>
    <button type="button" disabled={salvando} className="text-sm font-bold underline" onClick={() => setRevisao(n => n + 1)}>Atualizar organizadores</button>
    {!resultado ? <p role="status">Consultando…</p> : resultado.erro ? <p role="alert">Não foi possível consultar. Tente atualizar a lista.</p> : resultado.dados ? <>
      <p className="text-sm">{resultado.dados.total} organizador(es)</p>
      <ul className="divide-y divide-borda">{resultado.dados.itens.map(o => <li key={o.id} className="flex items-center justify-between gap-4 py-3"><div><p className="font-bold">{o.nome}</p><p className="text-xs text-cinza">{o.verificado ? "Verificado" : "Não verificado"} · {o.eventos} evento(s){o.verificado_em ? ` · desde ${new Date(o.verificado_em).toLocaleDateString("pt-BR")}` : ""}</p></div>{pode ? <button type="button" disabled={salvando} className="rounded-full bg-azul-fundo px-4 py-2 text-sm font-bold" onClick={() => { setSelecionado(o); setMotivo(""); setConfirmado(false); setErro(undefined); setAviso(undefined); }}>{o.verificado ? "Revogar" : "Verificar"}</button> : null}</li>)}</ul>
      {!resultado.dados.itens.length ? <p>Nenhum organizador encontrado.</p> : null}
      <nav className="flex gap-4 text-sm" aria-label="Páginas de organizadores"><button disabled={pagina === 0 || salvando} onClick={() => setPagina(n => n - 1)}>Anterior</button><span>Página {pagina + 1}</span><button disabled={salvando || (pagina + 1) * 25 >= resultado.dados.total} onClick={() => setPagina(n => n + 1)}>Próxima</button></nav>
    </> : null}
    {pode && selecionado ? <form onSubmit={decidir} className="rounded-2xl bg-fundo p-4"><fieldset disabled={salvando} className="space-y-3"><h3 className="font-bold">{selecionado.verificado ? "Revogar verificação" : "Verificar organizador"}: {selecionado.nome}</h3>
      <label className="block text-sm">Motivo da decisão<textarea required minLength={5} maxLength={500} className="mt-1 min-h-24 w-full rounded-2xl border border-borda p-3" value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
      <label className="flex gap-2 text-sm"><input required type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />{selecionado.verificado ? "Confirmo a revogação para novos eventos." : "Revisei a identidade e confirmo a publicação direta de novos eventos desta conta."}</label>
      <div className="flex gap-4"><button disabled={!confirmado} className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white">{salvando ? "Salvando…" : "Confirmar decisão"}</button><button type="button" onClick={() => setSelecionado(undefined)}>Cancelar</button></div>
    </fieldset></form> : null}
    {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}{aviso ? <p role="status" className="text-sm">{aviso}</p> : null}
  </section>;
}
