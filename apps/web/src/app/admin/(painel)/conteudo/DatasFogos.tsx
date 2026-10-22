"use client";

import { useCallback, useEffect, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Data = { id: string; nome: string; data: string; regiao: string; dica: string | null; revisado_em: string | null };
type Form = { id: string | null; nome: string; data: string; regiao: string; dica: string; revisado: boolean };
const VAZIO: Form = { id: null, nome: "", data: "", regiao: "Rio de Janeiro", dica: "", revisado: false };

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/**
 * Datas com fogos (BUSINESS.md 5.33): o app avisa os tutores 3 dias antes e
 * no dia. Super e marketing editam; as dicas passam por revisão veterinária.
 */
export function DatasFogos({ pode, onErro }: { pode: boolean; onErro: (m: string | null) => void }) {
  const [datas, setDatas] = useState<Data[]>([]);
  const [form, setForm] = useState<Form>(VAZIO);

  const carregar = useCallback(() => {
    rpcAdmin<Data[]>("admin_fogos").then(setDatas, (e: Error) => onErro(e.message));
  }, [onErro]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    onErro(null);
    try {
      await rpcAdmin("admin_fogos_salvar", {
        p_id: form.id,
        p_nome: form.nome,
        p_data: form.data || null,
        p_regiao: form.regiao,
        p_dica: form.dica,
        p_revisado: form.revisado,
      });
      setForm(VAZIO);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  }

  async function remover() {
    if (!form.id || !window.confirm(`Remover ${form.nome} (${dataBr(form.data)})? Os tutores deixam de ser avisados.`)) return;
    try {
      await rpcAdmin("admin_fogos_remover", { p_id: form.id });
      setForm(VAZIO);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  }

  const campo = "h-10 w-full rounded-full bg-suave px-4 text-[13px] font-semibold outline-none";
  return (
    <div className="mt-4">
      <table className="w-full text-left text-[13px]">
        <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
          <tr>
            <th className="py-2">Data</th>
            <th className="py-2">Nome</th>
            <th className="py-2">Região</th>
            <th className="py-2">Revisão</th>
          </tr>
        </thead>
        <tbody>
          {datas.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-cinza">Nenhuma data cadastrada.</td>
            </tr>
          ) : (
            datas.map((d) => (
              <tr
                key={d.id}
                onClick={() => pode && setForm({ id: d.id, nome: d.nome, data: d.data, regiao: d.regiao, dica: d.dica ?? "", revisado: false })}
                className={`border-t border-[#EEF0F4] ${pode ? "cursor-pointer hover:bg-suave" : ""} ${form.id === d.id ? "bg-azul-fundo" : ""}`}
              >
                <td className="py-3 font-semibold">{dataBr(d.data)}</td>
                <td className="py-3">{d.nome}</td>
                <td className="py-3">{d.regiao}</td>
                <td className="py-3">
                  {d.revisado_em ? (
                    <span className="rounded-full bg-verde-fundo px-2.5 py-1 text-[11px] font-bold text-verde-texto">Revisado {dataBr(d.revisado_em)}</span>
                  ) : (
                    <span className="rounded-full bg-amarelo-fundo px-2.5 py-1 text-[11px] font-bold text-amarelo-texto">Sem revisão</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {pode ? (
        <div className="mt-4 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4 sm:grid-cols-2">
          <p className="text-xs font-bold sm:col-span-2">{form.id ? "Editar data" : "Nova data com fogos"}</p>
          <label className="sr-only" htmlFor="f-nome">Nome</label>
          <input id="f-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Réveillon" maxLength={60} className={campo} />
          <label className="sr-only" htmlFor="f-data">Data</label>
          <input id="f-data" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className={campo} />
          <label className="sr-only" htmlFor="f-regiao">Região</label>
          <input id="f-regiao" value={form.regiao} onChange={(e) => setForm({ ...form, regiao: e.target.value })} placeholder="Região" className={campo} />
          <label className="sr-only" htmlFor="f-dica">Dica</label>
          <input id="f-dica" value={form.dica} onChange={(e) => setForm({ ...form, dica: e.target.value })} placeholder="Dica curta (sem remédio)" maxLength={200} className={campo} />
          <label className="flex items-center gap-2 text-[13px] font-semibold sm:col-span-2">
            <input type="checkbox" checked={form.revisado} onChange={(e) => setForm({ ...form, revisado: e.target.checked })} className="h-4 w-4 accent-tinta" />
            Texto revisado por veterinário hoje
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button onClick={salvar} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">
              {form.id ? "Salvar" : "Cadastrar"}
            </button>
            {form.id ? (
              <>
                <button onClick={() => setForm(VAZIO)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
                <button onClick={remover} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold text-perigo">Remover</button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-relaxed text-cinza">
        O app avisa 3 dias antes e no dia, à tarde, e à noite lembra de manter o pet em casa. As dicas não recomendam remédio.
      </p>
    </div>
  );
}
