"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";
import { PetsPerdidos } from "./PetsPerdidos";

type Item = {
  id: string;
  nome: string;
  categoria: "restaurante" | "hotel" | "praia" | "parque";
  aceita: "caes" | "gatos" | "caes_e_gatos";
  endereco: string | null;
  lat: number;
  lng: number;
  observacao: string | null;
  status: "em_analise" | "aprovada" | "recusada";
  motivo_recusa: string | null;
  criado_em: string;
  revisado_em: string | null;
  tutor: string;
  indicacoes_do_tutor: number;
  parecido: string | null;
};
type Moderacao = { em_analise: number; atrasadas: number; aprovadas_30d: number; recusadas_30d: number; horas_media: number | null; itens: Item[] };

type Aba = "em_analise" | "aprovada" | "recusada";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "em_analise", rotulo: "Para revisar" },
  { valor: "aprovada", rotulo: "Aprovadas" },
  { valor: "recusada", rotulo: "Recusadas" },
];
const CATEGORIA: Record<Item["categoria"], string> = { restaurante: "Restaurante", hotel: "Hotel", praia: "Praia", parque: "Parque" };
const ACEITA: Record<Item["aceita"], string> = { caes: "Aceita cães", gatos: "Aceita gatos", caes_e_gatos: "Aceita cães e gatos" };
const MOTIVOS = ["Não aceita pets", "Endereço errado ou não encontrado", "Lugar repetido no mapa", "Fechou", "Não é um lugar aberto ao público"];

/**
 * Moderação (protótipo AdminModeracao): indicações de lugares pet friendly
 * feitas pelos tutores, que só vão para o mapa depois de aprovadas (mesma
 * regra dos eventos, BUSINESS.md 5.16), e os alertas de pet perdido (5.29).
 * Denúncias de eventos ficam em Eventos; anúncios entram com a Fase 3.
 */
export default function ModeracaoPagina() {
  const admin = useAdmin();
  const [dados, setDados] = useState<Moderacao | null>(null);
  const [aba, setAba] = useState<Aba>("em_analise");
  const [selecionado, setSelecionado] = useState<Item | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const pode = admin.papel === "super" || admin.papel === "moderacao";

  const carregar = useCallback(() => {
    rpcAdmin<Moderacao>("admin_moderacao").then(
      (d) => {
        setDados(d);
        setSelecionado((atual) => (atual ? (d.itens.find((i) => i.id === atual.id) ?? null) : null));
      },
      (e: Error) => setErro(e.message),
    );
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(aprovar: boolean) {
    if (!selecionado) return;
    setErro(null);
    try {
      await rpcAdmin("admin_moderar_indicacao", { p_id: selecionado.id, p_aprovar: aprovar, p_motivo: aprovar ? null : motivo });
      setMotivo("");
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (!dados) return <p className="text-sm text-cinza">{erro ?? "Carregando…"}</p>;
  const itens = dados.itens.filter((i) => i.status === aba);

  return (
    <>
      <Cabecalho titulo="Moderação" subtitulo="Indicações de lugares pet friendly feitas pelos tutores" />
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Para revisar" valor={numero(dados.em_analise)} apoio={`${numero(dados.atrasadas)} há mais de 1 dia`} fundo="bg-rosa-fundo" cor="text-rosa-texto" />
        <CartaoNumero rotulo="Aprovadas (30d)" valor={numero(dados.aprovadas_30d)} apoio="Já no mapa" fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero rotulo="Recusadas (30d)" valor={numero(dados.recusadas_30d)} apoio="O tutor vê o motivo" fundo="bg-amarelo-fundo" cor="text-amarelo-texto" />
        <CartaoNumero
          rotulo="Tempo de revisão"
          valor={dados.horas_media === null ? "—" : `${String(dados.horas_media).replace(".", ",")} h`}
          apoio="Meta: até 1 dia útil"
          fundo="bg-azul-fundo"
          cor="text-azul-escuro"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-[28px] bg-fundo p-5">
          <div className="flex flex-wrap gap-2">
            {ABAS.map((a) => (
              <button
                key={a.valor}
                onClick={() => {
                  setAba(a.valor);
                  setSelecionado(null);
                }}
                className={`h-9 rounded-full px-4 text-[13px] font-bold ${aba === a.valor ? "bg-tinta text-white" : "border border-[#DDE1E8]"}`}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="py-2">Tipo</th>
                <th className="py-2">Lugar</th>
                <th className="py-2">Indicado por</th>
                <th className="py-2">Quando</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-cinza">Nada aqui.</td>
                </tr>
              ) : (
                itens.map((i) => (
                  <tr key={i.id} onClick={() => setSelecionado(i)} className={`cursor-pointer border-t border-[#EEF0F4] hover:bg-suave ${selecionado?.id === i.id ? "bg-azul-fundo" : ""}`}>
                    <td className="py-3">
                      <span className="rounded-full bg-roxo-fundo px-2.5 py-1 text-[11px] font-bold text-roxo-texto">{CATEGORIA[i.categoria]}</span>
                    </td>
                    <td className="py-3">
                      <p className="font-semibold">{i.nome}</p>
                      <p className="max-w-64 truncate text-xs text-cinza">{i.endereco ?? "Localização marcada no app"}</p>
                    </td>
                    <td className="py-3">{i.tutor}</td>
                    <td className="py-3 text-cinza">{haQuanto(i.criado_em)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="h-fit min-w-0 rounded-[28px] bg-fundo p-6">
          {!selecionado ? (
            <p className="text-sm text-cinza">Escolha uma indicação para revisar.</p>
          ) : (
            <>
              <h2 className="font-bold">Revisar indicação</h2>
              <p className="mt-3 rounded-2xl bg-roxo-fundo px-4 py-3 text-sm font-bold text-roxo-texto">
                {CATEGORIA[selecionado.categoria]} · {ACEITA[selecionado.aceita]}
              </p>
              <p className="mt-3 text-lg font-bold">{selecionado.nome}</p>
              <p className="text-sm text-cinza">{selecionado.endereco ?? "Sem endereço digitado: o tutor usou a localização do celular."}</p>
              {selecionado.observacao ? (
                <p className="mt-3 rounded-2xl bg-suave px-4 py-3 text-[13px] leading-relaxed">“{selecionado.observacao}”</p>
              ) : null}
              <p className="mt-3 text-xs text-cinza">
                Indicado por {selecionado.tutor} ({selecionado.indicacoes_do_tutor} {selecionado.indicacoes_do_tutor === 1 ? "indicação" : "indicações"}) · {haQuanto(selecionado.criado_em)}
              </p>
              {selecionado.parecido ? (
                <p className="mt-3 rounded-2xl bg-amarelo-fundo px-4 py-3 text-[13px] text-amarelo-texto">
                  Talvez já esteja no mapa: <strong>{selecionado.parecido}</strong>, a menos de 150 m.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
                <a href={`https://www.openstreetmap.org/?mlat=${selecionado.lat}&mlon=${selecionado.lng}#map=18/${selecionado.lat}/${selecionado.lng}`} target="_blank" rel="noreferrer" className="text-azul-escuro underline">
                  Ver no mapa
                </a>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(`${selecionado.nome} ${selecionado.endereco ?? ""} pet friendly`)}`} target="_blank" rel="noreferrer" className="text-azul-escuro underline">
                  Pesquisar o lugar
                </a>
              </div>

              {selecionado.status === "em_analise" && pode ? (
                <div className="mt-5 space-y-3">
                  <button onClick={() => decidir(true)} className="h-11 w-full rounded-full bg-tinta text-[13px] font-bold text-white">
                    Aprovar e pôr no mapa
                  </button>
                  <div className="rounded-2xl border border-[#DDE1E8] p-3">
                    <label htmlFor="motivo" className="text-xs font-bold">Recusar com motivo (o tutor vê no app)</label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {MOTIVOS.map((m) => (
                        <button key={m} onClick={() => setMotivo(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${motivo === m ? "bg-tinta text-white" : "bg-suave"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                    <input id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ou escreva o motivo" className="mt-2 h-9 w-full rounded-full bg-suave px-3 text-[13px] outline-none" />
                    <button onClick={() => decidir(false)} className="mt-2 h-9 w-full rounded-full border border-[#DDE1E8] text-[13px] font-bold text-perigo">
                      Recusar
                    </button>
                  </div>
                </div>
              ) : selecionado.status !== "em_analise" ? (
                <p className="mt-4 text-sm">
                  {selecionado.status === "aprovada" ? "Aprovada" : `Recusada: ${selecionado.motivo_recusa}`} · {haQuanto(selecionado.revisado_em)}
                </p>
              ) : null}
            </>
          )}
        </section>
      </div>

      <PetsPerdidos pode={pode} />
    </>
  );
}
