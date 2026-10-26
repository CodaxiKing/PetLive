"use client";

import { useEffect, useRef, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Raca = { id: string; especie: string; nome: string; ativo: boolean; versao: number };
type Lista = { total: number; itens: Raca[] };
const NOVA = { id: null as string | null, especie: "cao", nome: "", ativo: true, versao: 0 };

export function Racas({ pode }: { pode: boolean }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [revisao, setRevisao] = useState(0);
  const [consulta, setConsulta] = useState<{ chave: string; dados?: Lista; erro?: boolean }>();
  const [form, setForm] = useState<typeof NOVA>(NOVA);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const chave = JSON.stringify([busca, pagina, revisao]);
  useEffect(() => {
    let atual = true;
    const timer = setTimeout(() => {
      void rpcAdmin<Lista>("admin_racas", { p_busca: busca, p_pagina: pagina })
        .then(dados => { if (atual) setConsulta({ chave, dados }); })
        .catch(() => { if (atual) setConsulta({ chave, erro: true }); });
    }, 250);
    return () => { atual = false; clearTimeout(timer); };
  }, [busca, pagina, revisao, chave]);
  const resultado = consulta?.chave === chave ? consulta : undefined;
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (trava.current) return;
    trava.current = true; setSalvando(true); setErro(undefined); setAviso(undefined);
    try {
      await rpcAdmin("admin_raca_salvar", { p_id: form.id, p_versao: form.versao, p_especie: form.especie, p_nome: form.nome, p_ativo: form.ativo });
      setForm(NOVA); setRevisao(n => n + 1); setAviso("Catálogo atualizado. Pets já cadastrados mantêm a raça informada.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { trava.current = false; setSalvando(false); }
  }
  const campo = "w-full rounded-2xl border border-[#DDE1E8] px-4 py-3 text-sm";
  return <div className="mt-5 space-y-4">
    <h2 className="font-bold">Catálogo de raças</h2>
    <p className="text-sm text-cinza">Sugestões para cadastro e edição do pet. O tutor pode digitar outra raça. Desativar uma sugestão preserva os pets existentes.</p>
    <label className="block text-sm">Buscar raça<input className={campo} maxLength={80} value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} /></label>
    <button type="button" className="text-sm font-bold underline" onClick={() => setRevisao(n => n + 1)}>Atualizar lista</button>
    {!resultado ? <p role="status">Consultando…</p> : resultado.erro ? <p role="alert">Não foi possível carregar. Use Atualizar lista para tentar novamente.</p> : resultado.dados ? <>
      <p className="text-sm">{resultado.dados.total} raça(s)</p>
      <ul className="divide-y divide-[#DDE1E8]">{resultado.dados.itens.map(r => <li key={r.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{r.nome}</p><p className="text-xs text-cinza">{r.especie === "cao" ? "Cão" : "Gato"} · {r.ativo ? "Ativa" : "Desativada"}</p></div>{pode ? <button disabled={salvando} type="button" className="rounded-full bg-roxo-fundo px-4 py-2 text-sm font-bold" onClick={() => { setForm(r); setErro(undefined); setAviso(undefined); }}>Editar</button> : null}</li>)}</ul>
      {!resultado.dados.itens.length ? <p>Nenhuma raça encontrada.</p> : null}
      <nav aria-label="Páginas de raças" className="flex gap-4 text-sm"><button disabled={pagina === 0} onClick={() => setPagina(n => n - 1)}>Anterior</button><span>Página {pagina + 1}</span><button disabled={(pagina + 1) * 50 >= resultado.dados.total} onClick={() => setPagina(n => n + 1)}>Próxima</button></nav>
    </> : null}
    {pode ? <form onSubmit={salvar} className="space-y-3 rounded-2xl bg-suave p-4"><h3 className="font-bold">{form.id ? "Editar raça" : "Nova raça"}</h3>
      <fieldset disabled={salvando} className="space-y-3">
        <label className="block text-sm">Espécie<select className={campo} value={form.especie} onChange={e => setForm({ ...form, especie: e.target.value })}><option value="cao">Cão</option><option value="gato">Gato</option></select></label>
        <label className="block text-sm">Nome<input required minLength={2} maxLength={80} className={campo} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} />Sugerir no app</label>
        <div className="flex gap-3"><button className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white" type="submit">{salvando ? "Salvando…" : "Salvar"}</button><button type="button" onClick={() => { setForm(NOVA); setErro(undefined); }}>Cancelar edição</button></div>
      </fieldset>
    </form> : <p className="text-sm text-cinza">Somente super admin pode editar o catálogo.</p>}
    {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}{aviso ? <p role="status" className="text-sm">{aviso}</p> : null}
  </div>;
}
