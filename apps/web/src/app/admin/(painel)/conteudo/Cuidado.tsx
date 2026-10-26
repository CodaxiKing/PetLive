"use client";

import { useCallback, useEffect, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";

type Luto = { id: string; tipo: "texto" | "contato"; titulo: string; texto: string; link: string | null; ordem: number; ativo: boolean; revisado_por: string | null; revisado_em: string | null };
type Idade = { id: number; especie: "cao" | "gato"; peso_min: number; peso_max: number | null; anos: number; descricao: string; revisado_por: string | null; revisado_em: string | null };
type Item = { chave: string; rotulo: string; pergunta: string; ordem: number; revisado_por: string | null; revisado_em: string | null };
type Dados = { luto: Luto[]; idade_senior: Idade[]; escala: Item[] };

const dataBr = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null);

function Revisao({ por, em }: { por: string | null; em: string | null }) {
  return por ? (
    <span className="rounded-full bg-verde-fundo px-2.5 py-1 text-[11px] font-bold text-verde-texto">Revisado por {por} · {dataBr(em)}</span>
  ) : (
    <span className="rounded-full bg-amarelo-fundo px-2.5 py-1 text-[11px] font-bold text-amarelo-texto">Sem revisão</span>
  );
}

/**
 * Conteúdo de cuidado (BUSINESS.md 5.39 e 5.40): apoio ao luto (super e
 * marketing, revisado por profissional), idade sênior e escala de qualidade
 * de vida (só o super, revisadas por veterinário). Salvar sempre pede quem
 * revisou e marca a data de hoje.
 */
export function Cuidado({ podeLuto, podeSaude, onErro }: { podeLuto: boolean; podeSaude: boolean; onErro: (m: string | null) => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [luto, setLuto] = useState<Partial<Luto> | null>(null);
  const [idade, setIdade] = useState<Idade | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [revisor, setRevisor] = useState("");

  const carregar = useCallback(() => {
    rpcAdmin<Dados>("admin_conteudo_cuidado").then(setDados, (e: Error) => onErro(e.message));
  }, [onErro]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(acao: () => Promise<unknown>) {
    onErro(null);
    try {
      await acao();
      setLuto(null);
      setIdade(null);
      setItem(null);
      carregar();
    } catch (e) {
      onErro((e as Error).message);
    }
  }

  if (!dados) return <p className="mt-4 text-sm text-cinza">Carregando…</p>;
  const campo = "h-10 w-full rounded-full bg-suave px-4 text-[13px] font-semibold outline-none";
  const area = "w-full rounded-2xl bg-suave p-3 text-[13px] outline-none";
  const revisorCampo = (rotulo: string) => (
    <input aria-label={rotulo} value={revisor} onChange={(e) => setRevisor(e.target.value)} placeholder={rotulo} maxLength={120} className={campo} />
  );
  const botoes = (salvar: () => void, cancelar: () => void) => (
    <div className="flex gap-2">
      <button onClick={salvar} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">Salvar revisão</button>
      <button onClick={cancelar} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
    </div>
  );

  return (
    <div className="mt-4 space-y-6">
      <div>
        <h3 className="text-sm font-bold">Apoio ao luto</h3>
        <ul className="mt-2 space-y-2">
          {dados.luto.map((l) => (
            <li key={l.id} onClick={() => podeLuto && setLuto(l)} className={`rounded-2xl bg-suave px-4 py-3 text-[13px] ${podeLuto ? "cursor-pointer hover:bg-azul-fundo" : ""} ${l.ativo ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{l.tipo === "contato" ? "Contato · " : ""}{l.titulo}</p>
                <Revisao por={l.revisado_por} em={l.revisado_em} />
              </div>
              <p className="mt-1 text-xs text-cinza">{l.texto}</p>
            </li>
          ))}
        </ul>
        {podeLuto ? (
          luto ? (
            <div className="mt-3 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4 sm:grid-cols-2">
              <select aria-label="Tipo" value={luto.tipo ?? "texto"} onChange={(e) => setLuto({ ...luto, tipo: e.target.value as Luto["tipo"] })} className={campo}>
                <option value="texto">Texto</option>
                <option value="contato">Contato (telefone ou link)</option>
              </select>
              <input aria-label="Título" value={luto.titulo ?? ""} onChange={(e) => setLuto({ ...luto, titulo: e.target.value })} placeholder="Título" maxLength={80} className={campo} />
              <textarea aria-label="Texto" value={luto.texto ?? ""} onChange={(e) => setLuto({ ...luto, texto: e.target.value })} placeholder="Texto curto, sem conselho médico" maxLength={500} rows={3} className={`${area} sm:col-span-2`} />
              {luto.tipo === "contato" ? (
                <input aria-label="Link" value={luto.link ?? ""} onChange={(e) => setLuto({ ...luto, link: e.target.value })} placeholder="tel:188 ou https://…" className={campo} />
              ) : null}
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" checked={luto.ativo ?? true} onChange={(e) => setLuto({ ...luto, ativo: e.target.checked })} className="h-4 w-4 accent-tinta" />
                Aparece no app
              </label>
              <div className="sm:col-span-2">{revisorCampo("Revisado por (nome e registro do profissional)")}</div>
              <div className="sm:col-span-2">
                {botoes(
                  () =>
                    agir(() =>
                      rpcAdmin("admin_luto_salvar", {
                        p_id: luto.id ?? null,
                        p_tipo: luto.tipo ?? "texto",
                        p_titulo: luto.titulo ?? "",
                        p_texto: luto.texto ?? "",
                        p_link: luto.link ?? "",
                        p_ordem: luto.ordem ?? null,
                        p_ativo: luto.ativo ?? true,
                        p_revisado_por: revisor,
                      }),
                    ),
                  () => setLuto(null),
                )}
              </div>
            </div>
          ) : (
            <button onClick={() => setLuto({ tipo: "texto", ativo: true })} className="mt-3 h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Novo texto ou contato</button>
          )
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-bold">Idade sênior</h3>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
            <tr>
              <th className="py-2">Faixa</th>
              <th className="py-2">Sênior a partir de</th>
              <th className="py-2">Revisão</th>
            </tr>
          </thead>
          <tbody>
            {dados.idade_senior.map((i) => (
              <tr key={i.id} onClick={() => podeSaude && setIdade(i)} className={`border-t border-[#EEF0F4] ${podeSaude ? "cursor-pointer hover:bg-suave" : ""}`}>
                <td className="py-2.5 font-semibold">{i.descricao}</td>
                <td className="py-2.5">{i.anos} anos</td>
                <td className="py-2.5"><Revisao por={i.revisado_por} em={i.revisado_em} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {podeSaude && idade ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4 sm:grid-cols-2">
            <input aria-label="Descrição" value={idade.descricao} onChange={(e) => setIdade({ ...idade, descricao: e.target.value })} className={campo} />
            <input aria-label="Anos" type="number" min={3} max={20} value={idade.anos} onChange={(e) => setIdade({ ...idade, anos: Number(e.target.value) })} className={campo} />
            <div className="sm:col-span-2">{revisorCampo("Veterinário que revisou (nome e CRMV)")}</div>
            <div className="sm:col-span-2">
              {botoes(() => agir(() => rpcAdmin("admin_idade_senior_salvar", { p_id: idade.id, p_anos: idade.anos, p_descricao: idade.descricao, p_revisado_por: revisor })), () => setIdade(null))}
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <h3 className="text-sm font-bold">Escala de qualidade de vida</h3>
        <p className="mt-1 text-xs text-cinza">Os 7 itens são fixos (as respostas já salvas dependem deles). Mude o nome e a explicação de 0 a 10.</p>
        <ul className="mt-2 space-y-2">
          {dados.escala.map((e) => (
            <li key={e.chave} onClick={() => podeSaude && setItem(e)} className={`rounded-2xl bg-suave px-4 py-3 text-[13px] ${podeSaude ? "cursor-pointer hover:bg-azul-fundo" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{e.rotulo}</p>
                <Revisao por={e.revisado_por} em={e.revisado_em} />
              </div>
              <p className="mt-1 text-xs text-cinza">{e.pergunta}</p>
            </li>
          ))}
        </ul>
        {podeSaude && item ? (
          <div className="mt-3 grid gap-2 rounded-2xl border border-[#DDE1E8] p-4">
            <input aria-label="Nome do item" value={item.rotulo} onChange={(e) => setItem({ ...item, rotulo: e.target.value })} maxLength={40} className={campo} />
            <textarea aria-label="Explicação de 0 a 10" value={item.pergunta} onChange={(e) => setItem({ ...item, pergunta: e.target.value })} maxLength={160} rows={2} className={area} />
            {revisorCampo("Veterinário que revisou (nome e CRMV)")}
            {botoes(() => agir(() => rpcAdmin("admin_escala_item_salvar", { p_chave: item.chave, p_rotulo: item.rotulo, p_pergunta: item.pergunta, p_revisado_por: revisor })), () => setItem(null))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
