"use client";

import { useCallback, useEffect, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Tipo = "plano" | "seguro";
type Parceiro = {
  id: string;
  nome: string;
  tipo: Tipo;
  beneficios: string;
  preco_texto: string | null;
  url: string;
  ordem: number;
  ativo: boolean;
  cliques_30d: number;
};

const TIPOS: Record<Tipo, string> = { plano: "Plano de saúde", seguro: "Seguro" };

/**
 * Plano e seguro pet (BUSINESS.md 5.30): parceiros que aparecem no app. Cotar
 * leva ao site do parceiro; os cliques dos últimos 30 dias servem de base para
 * a comissão. Super e marketing editam.
 */
export function Parceiros({ pode, onErro }: { pode: boolean; onErro: (m: string | null) => void }) {
  const [lista, setLista] = useState<Parceiro[]>([]);
  const [form, setForm] = useState<Partial<Parceiro> | null>(null);

  const carregar = useCallback(() => {
    rpcAdmin<Parceiro[]>("admin_parceiros").then(setLista, (e: Error) => onErro(e.message));
  }, [onErro]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    if (!form) return;
    onErro(null);
    try {
      await rpcAdmin("admin_parceiro_salvar", {
        p_id: form.id ?? null,
        p_nome: form.nome ?? "",
        p_tipo: form.tipo ?? "plano",
        p_beneficios: form.beneficios ?? "",
        p_preco: form.preco_texto ?? "",
        p_url: form.url ?? "",
        p_ordem: form.ordem ?? null,
        p_ativo: form.ativo ?? true,
      });
      setForm(null);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  }

  const campo = "h-10 w-full rounded-full bg-suave px-4 text-[13px] font-semibold outline-none";
  return (
    <div className="mt-4">
      <p className="text-xs text-cinza">O app diz que a contratação é feita pelo parceiro e que o PetLive não vende nem garante o plano.</p>
      <table className="mt-3 w-full text-left text-[13px]">
        <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
          <tr>
            <th className="py-2">Parceiro</th>
            <th className="py-2">Tipo</th>
            <th className="py-2">Cliques (30 dias)</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id} onClick={() => pode && setForm(p)} className={`border-t border-[#EEF0F4] ${pode ? "cursor-pointer hover:bg-suave" : ""} ${p.ativo ? "" : "opacity-50"}`}>
              <td className="py-2.5">
                <p className="font-semibold">{p.nome}</p>
                <p className="text-xs text-cinza">{p.beneficios}</p>
              </td>
              <td className="py-2.5">{TIPOS[p.tipo]}</td>
              <td className="py-2.5 font-semibold">{p.cliques_30d}</td>
            </tr>
          ))}
          {lista.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-4 text-cinza">Nenhum parceiro ainda. Sem parceiros, o app mostra uma tela vazia.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      {pode ? (
        form ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4 sm:grid-cols-2">
            <input aria-label="Nome" value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do parceiro" maxLength={60} className={campo} />
            <select aria-label="Tipo" value={form.tipo ?? "plano"} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })} className={campo}>
              {Object.entries(TIPOS).map(([v, t]) => (
                <option key={v} value={v}>{t}</option>
              ))}
            </select>
            <input aria-label="Link para cotar" value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://… (página de cotação)" className={`${campo} sm:col-span-2`} />
            <textarea
              aria-label="Benefícios"
              value={form.beneficios ?? ""}
              onChange={(e) => setForm({ ...form, beneficios: e.target.value })}
              placeholder="Benefícios em uma frase"
              maxLength={240}
              rows={2}
              className="w-full rounded-2xl bg-suave p-3 text-[13px] outline-none sm:col-span-2"
            />
            <input aria-label="Preço de referência" value={form.preco_texto ?? ""} onChange={(e) => setForm({ ...form, preco_texto: e.target.value })} placeholder="a partir de R$ 39/mês" maxLength={60} className={campo} />
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input type="checkbox" checked={form.ativo ?? true} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4 accent-tinta" />
              Aparece no app
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button onClick={salvar} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">Salvar</button>
              <button onClick={() => setForm(null)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setForm({ tipo: "plano", ativo: true })} className="mt-3 h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Novo parceiro</button>
        )
      ) : null}
    </div>
  );
}
