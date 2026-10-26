"use client";

import { useEffect, useRef, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Categoria = { codigo: string; nome: string; plural: string; versao: number };
export function Categorias({ pode }: { pode: boolean }) {
  const [revisao, setRevisao] = useState(0);
  const [consulta, setConsulta] = useState<{ revisao: number; itens?: Categoria[]; erro?: boolean }>();
  const [form, setForm] = useState<Categoria>();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const trava = useRef(false);
  useEffect(() => {
    let atual = true;
    void rpcAdmin<Categoria[]>("admin_categorias_mapa").then(itens => { if (atual) setConsulta({ revisao, itens }); })
      .catch(() => { if (atual) setConsulta({ revisao, erro: true }); });
    return () => { atual = false; };
  }, [revisao]);
  const resultado = consulta?.revisao === revisao ? consulta : undefined;
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!form || trava.current) return;
    trava.current = true; setSalvando(true); setErro(undefined); setAviso(undefined);
    try {
      await rpcAdmin("admin_categoria_mapa_salvar", { p_codigo: form.codigo, p_versao: form.versao, p_nome: form.nome, p_plural: form.plural });
      setForm(undefined); setRevisao(n => n + 1); setAviso("Nomes atualizados. O app consulta novamente ao abrir o mapa ou a ficha do lugar.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { trava.current = false; setSalvando(false); }
  }
  return <div className="mt-5 space-y-4">
    <h2 className="font-bold">Categorias do mapa</h2>
    <p className="text-sm text-cinza">Ajuste os nomes exibidos no app. Os nove tipos disponíveis seguem as fontes do mapa; editar um nome preserva os lugares, filtros e ícones. Sem rede, o app usa os nomes originais.</p>
    <button type="button" className="text-sm font-bold underline" onClick={() => setRevisao(n => n + 1)}>Atualizar lista</button>
    {!resultado ? <p role="status">Consultando…</p> : resultado.erro ? <p role="alert">Não foi possível carregar. Tente atualizar a lista.</p> : <ul className="divide-y divide-[#DDE1E8]">{resultado.itens?.map(c => <li key={c.codigo} className="flex items-center justify-between gap-3 py-3"><div><p className="font-semibold">{c.nome}</p><p className="text-xs text-cinza">Plural: {c.plural}</p></div>{pode ? <button type="button" disabled={salvando} className="rounded-full bg-roxo-fundo px-4 py-2 text-sm font-bold" onClick={() => { setForm(c); setErro(undefined); setAviso(undefined); }}>Editar</button> : null}</li>)}</ul>}
    {pode && form ? <form onSubmit={salvar} className="rounded-2xl bg-suave p-4"><fieldset disabled={salvando} className="space-y-3"><h3 className="font-bold">Editar categoria</h3>
      <label className="block text-sm">Nome no singular<input required minLength={2} maxLength={32} className="mt-1 w-full rounded-2xl border border-[#DDE1E8] px-4 py-3" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></label>
      <label className="block text-sm">Nome no plural<input required minLength={2} maxLength={40} className="mt-1 w-full rounded-2xl border border-[#DDE1E8] px-4 py-3" value={form.plural} onChange={e => setForm({ ...form, plural: e.target.value })} /></label>
      <div className="flex gap-4"><button type="submit" className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white">{salvando ? "Salvando…" : "Salvar"}</button><button type="button" onClick={() => setForm(undefined)}>Cancelar</button></div>
    </fieldset></form> : null}
    {!pode ? <p className="text-sm text-cinza">Somente super admin pode editar as categorias.</p> : null}
    {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}{aviso ? <p role="status" className="text-sm">{aviso}</p> : null}
  </div>;
}
