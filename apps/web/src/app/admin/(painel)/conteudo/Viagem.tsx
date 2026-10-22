"use client";

import { useCallback, useEffect, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Modo = "carro" | "aviao" | "ambos";
type Item = { id: string; modo: Modo; titulo: string; detalhe: string | null; automatico: string | null; ordem: number; ativo: boolean; revisado_em: string | null };
type Companhia = { id: string; nome: string; regras: string | null; link: string; revisado_em: string | null };

const MODOS: Record<Modo, string> = { ambos: "Carro e avião", carro: "Carro", aviao: "Avião" };
const dataBr = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/**
 * Viagem (BUSINESS.md 5.26): itens do checklist e regras das companhias com
 * data de revisão. As regras são só referência: o app sempre manda confirmar
 * com a companhia. Super e marketing editam.
 */
export function Viagem({ pode, onErro }: { pode: boolean; onErro: (m: string | null) => void }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [companhias, setCompanhias] = useState<Companhia[]>([]);
  const [item, setItem] = useState<Partial<Item> | null>(null);
  const [companhia, setCompanhia] = useState<Partial<Companhia> | null>(null);

  const carregar = useCallback(() => {
    rpcAdmin<{ itens: Item[]; companhias: Companhia[] }>("admin_viagem").then((d) => {
      setItens(d.itens);
      setCompanhias(d.companhias);
    }, (e: Error) => onErro(e.message));
  }, [onErro]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(acao: () => Promise<unknown>) {
    onErro(null);
    try {
      await acao();
      setItem(null);
      setCompanhia(null);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  }

  const campo = "h-10 w-full rounded-full bg-suave px-4 text-[13px] font-semibold outline-none";
  return (
    <div className="mt-4 space-y-6">
      <div>
        <h3 className="text-sm font-bold">Itens do checklist</h3>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Modo</th>
              <th className="py-2">Revisão</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((i) => (
              <tr key={i.id} onClick={() => pode && setItem(i)} className={`border-t border-[#EEF0F4] ${pode ? "cursor-pointer hover:bg-suave" : ""} ${i.ativo ? "" : "opacity-50"}`}>
                <td className="py-2.5">
                  <p className="font-semibold">{i.titulo}</p>
                  <p className="text-xs text-cinza">{i.automatico ? "Marca sozinho com a antirrábica em dia" : (i.detalhe ?? "")}</p>
                </td>
                <td className="py-2.5">{MODOS[i.modo]}</td>
                <td className="py-2.5 text-cinza">{dataBr(i.revisado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pode ? (
          item ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4 sm:grid-cols-2">
              <input aria-label="Item" value={item.titulo ?? ""} onChange={(e) => setItem({ ...item, titulo: e.target.value })} placeholder="Item" maxLength={80} className={campo} />
              <input aria-label="Detalhe" value={item.detalhe ?? ""} onChange={(e) => setItem({ ...item, detalhe: e.target.value })} placeholder="Detalhe (opcional)" maxLength={120} className={campo} />
              <select aria-label="Modo" value={item.modo ?? "ambos"} onChange={(e) => setItem({ ...item, modo: e.target.value as Modo })} className={campo}>
                {Object.entries(MODOS).map(([v, t]) => (
                  <option key={v} value={v}>{t}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" checked={item.ativo ?? true} onChange={(e) => setItem({ ...item, ativo: e.target.checked })} className="h-4 w-4 accent-tinta" />
                Aparece no app
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  onClick={() =>
                    agir(() =>
                      rpcAdmin("admin_viagem_item_salvar", {
                        p_id: item.id ?? null,
                        p_modo: item.modo ?? "ambos",
                        p_titulo: item.titulo ?? "",
                        p_detalhe: item.detalhe ?? "",
                        p_ordem: item.ordem ?? null,
                        p_ativo: item.ativo ?? true,
                      }),
                    )
                  }
                  className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white"
                >
                  Salvar
                </button>
                <button onClick={() => setItem(null)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setItem({ modo: "ambos", ativo: true })} className="mt-3 h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Novo item</button>
          )
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-bold">Companhias aéreas</h3>
        <ul className="mt-2 space-y-2">
          {companhias.map((c) => (
            <li key={c.id} onClick={() => pode && setCompanhia(c)} className={`rounded-2xl bg-suave px-4 py-3 text-[13px] ${pode ? "cursor-pointer hover:bg-azul-fundo" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">{c.nome}</p>
                {c.revisado_em ? (
                  <span className="rounded-full bg-verde-fundo px-2.5 py-1 text-[11px] font-bold text-verde-texto">Revisado {dataBr(c.revisado_em)}</span>
                ) : (
                  <span className="rounded-full bg-amarelo-fundo px-2.5 py-1 text-[11px] font-bold text-amarelo-texto">Sem resumo das regras</span>
                )}
              </div>
              <p className="mt-1 text-xs text-cinza">{c.regras ?? "O app mostra só o link oficial."}</p>
            </li>
          ))}
        </ul>
        {pode && companhia ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4">
            <input aria-label="Companhia" value={companhia.nome ?? ""} onChange={(e) => setCompanhia({ ...companhia, nome: e.target.value })} placeholder="Companhia" className={campo} />
            <input aria-label="Link oficial" value={companhia.link ?? ""} onChange={(e) => setCompanhia({ ...companhia, link: e.target.value })} placeholder="https://… (página oficial de pets)" className={campo} />
            <textarea
              aria-label="Resumo das regras"
              value={companhia.regras ?? ""}
              onChange={(e) => setCompanhia({ ...companhia, regras: e.target.value })}
              placeholder="Resumo das regras para pets (peso, caixa, cabine), copiado da página oficial"
              maxLength={600}
              rows={3}
              className="w-full rounded-2xl bg-suave p-3 text-[13px] outline-none"
            />
            <p className="text-[11px] text-cinza">Salvar marca a data de revisão de hoje.</p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  agir(() =>
                    rpcAdmin("admin_companhia_salvar", { p_id: companhia.id ?? null, p_nome: companhia.nome ?? "", p_regras: companhia.regras ?? "", p_link: companhia.link ?? "" }),
                  )
                }
                className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white"
              >
                Salvar revisão
              </button>
              <button onClick={() => setCompanhia(null)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
            </div>
          </div>
        ) : pode ? (
          <button onClick={() => setCompanhia({})} className="mt-3 h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Nova companhia</button>
        ) : null}
      </div>
    </div>
  );
}
