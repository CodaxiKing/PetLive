"use client";

import { useCallback, useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, haQuanto, numero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Plataforma = "android" | "ios";
type Versao = { versao: string; android: number; ios: number; total: number; abaixo_da_minima: boolean };
type Recurso = { chave: string; nome: string; descricao: string; ligado: boolean; atualizado_em: string; por: string | null };
type Sistema = {
  versao_minima: Record<Plataforma, string>;
  versoes: Versao[];
  ativos_30d: number;
  avisos_7d: number;
  avisos_lidos_7d: number;
  celulares_com_push: number;
  push_android: number;
  push_ios: number;
  recursos: Recurso[];
};

function pct(parte: number, total: number): string {
  return total ? `${Math.round((parte / total) * 100)}%` : "—";
}

/**
 * Sistema (protótipo AdminSistema): versões do app em uso, versão mínima
 * (abaixo dela o app pede para atualizar) e recursos que a equipe liga e
 * desliga sem publicar app novo. Os erros ficam no Sentry.
 */
export default function SistemaPagina() {
  const admin = useAdmin();
  const [dados, setDados] = useState<Sistema | null>(null);
  const [minima, setMinima] = useState<{ plataforma: Plataforma; versao: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pode = admin.papel === "super";

  const carregar = useCallback(() => {
    rpcAdmin<Sistema>("admin_sistema").then(setDados, (e: Error) => setErro(e.message));
  }, []);
  useEffect(() => {
    carregar();
  }, [carregar]);

  async function agir(acao: () => Promise<unknown>) {
    setErro(null);
    try {
      await acao();
      carregar();
      return true;
    } catch (e) {
      setErro((e as Error).message);
      return false;
    }
  }

  function alternar(r: Recurso) {
    const aviso = r.ligado
      ? `Desligar "${r.nome}"? Some do app de todos os tutores na próxima vez que abrirem.`
      : `Ligar "${r.nome}" para todos os tutores?`;
    if (!window.confirm(aviso)) return;
    agir(() => rpcAdmin("admin_definir_recurso", { p_chave: r.chave, p_ligado: !r.ligado }));
  }

  async function salvarMinima() {
    if (!minima) return;
    const afetados = dados?.versoes.filter((v) => v.versao !== "anterior" && menor(v.versao, minima.versao)).reduce((s, v) => s + v[minima.plataforma], 0) ?? 0;
    if (
      !window.confirm(
        `Exigir ${minima.versao} no ${minima.plataforma === "android" ? "Android" : "iOS"}? ${afetados} tutor(es) com versão menor vão ver a tela "Atualize o PetLive" ao abrir o app.`,
      )
    )
      return;
    if (await agir(() => rpcAdmin("admin_definir_versao_minima", { p_plataforma: minima.plataforma, p_versao: minima.versao }))) setMinima(null);
  }

  if (!dados) return <><Cabecalho titulo="Sistema" subtitulo="Acompanhe os dados e as atividades desta área" /><div className="admin-bloco" role={erro ? "alert" : "status"}><p className={erro ? "text-sm text-perigo" : "text-sm text-cinza"}>{erro ?? "Carregando dados…"}</p></div></>;
  const atual = dados.versoes.find((v) => v.versao !== "anterior")?.versao;

  return (
    <>
      <Cabecalho titulo="Sistema" subtitulo="Versões do app, avisos e recursos ligados" />
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Tutores ativos (30d)" valor={numero(dados.ativos_30d)} apoio={atual ? `Versão mais nova: ${atual}` : "Sem aberturas com versão"} fundo="bg-verde-fundo" cor="text-verde-texto" />
        <CartaoNumero
          rotulo="Versão mínima"
          valor={dados.versao_minima.android === "0.0.0" ? "Livre" : dados.versao_minima.android}
          apoio={`No Android · no iOS: ${dados.versao_minima.ios === "0.0.0" ? "livre" : dados.versao_minima.ios}`}
          fundo="bg-azul-fundo"
          cor="text-azul-escuro"
        />
        <CartaoNumero rotulo="Avisos enviados (7d)" valor={numero(dados.avisos_7d)} apoio={`${pct(dados.avisos_lidos_7d, dados.avisos_7d)} abertos pelo tutor`} fundo="bg-rosa-fundo" cor="text-rosa-texto" />
        <CartaoNumero rotulo="Celulares com push" valor={numero(dados.celulares_com_push)} apoio={`Android ${dados.push_android} · iOS ${dados.push_ios}`} fundo="bg-roxo-fundo" cor="text-roxo-texto" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <section className="min-w-0 admin-surface border border-borda bg-fundo shadow-sm p-6">
          <h2 className="font-bold">Versões em uso</h2>
          <p className="text-xs text-cinza">Versão mais recente de cada tutor que abriu o app nos últimos 30 dias</p>
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="py-2">Versão</th>
                <th className="py-2">Android</th>
                <th className="py-2">iOS</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.versoes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-cinza">Ninguém abriu o app nos últimos 30 dias.</td>
                </tr>
              ) : (
                dados.versoes.map((v) => {
                  const status =
                    v.versao === "anterior"
                      ? { rotulo: "Sem versão", cor: "bg-suave text-cinza" }
                      : v.abaixo_da_minima
                        ? { rotulo: "Pede atualização", cor: "bg-amarelo-fundo text-amarelo-texto" }
                        : v.versao === atual
                          ? { rotulo: "Atual", cor: "bg-verde-fundo text-verde-texto" }
                          : { rotulo: "Suportada", cor: "bg-azul-fundo text-azul-escuro" };
                  return (
                    <tr key={v.versao} className="border-t border-[#EEF0F4]">
                      <td className="py-3 font-semibold">{v.versao === "anterior" ? "Builds antigos" : v.versao}</td>
                      <td className="py-3">{pct(v.android, dados.ativos_30d)}</td>
                      <td className="py-3">{pct(v.ios, dados.ativos_30d)}</td>
                      <td className="py-3">
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cor}`}>{status.rotulo}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {pode ? (
            minima ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[#DDE1E8] p-3">
                <label htmlFor="plataforma" className="sr-only">Plataforma</label>
                <select
                  id="plataforma"
                  value={minima.plataforma}
                  onChange={(e) => setMinima({ plataforma: e.target.value as Plataforma, versao: dados.versao_minima[e.target.value as Plataforma] })}
                  className="h-9 rounded-full bg-suave px-3 text-[13px] font-semibold"
                >
                  <option value="android">Android</option>
                  <option value="ios">iOS</option>
                </select>
                <label htmlFor="versao" className="sr-only">Versão mínima</label>
                <input
                  id="versao"
                  value={minima.versao}
                  onChange={(e) => setMinima({ ...minima, versao: e.target.value })}
                  placeholder="1.4.0"
                  className="h-9 w-28 rounded-full bg-suave px-3 text-[13px] font-semibold outline-none"
                />
                <button onClick={salvarMinima} className="h-9 rounded-full bg-tinta px-4 text-[13px] font-bold text-white">Salvar</button>
                <button onClick={() => setMinima(null)} className="h-9 rounded-full border border-[#DDE1E8] px-4 text-[13px] font-bold">Cancelar</button>
                <p className="w-full text-[11px] text-cinza">Use 0.0.0 para não exigir nenhuma versão.</p>
              </div>
            ) : (
              <button
                onClick={() => setMinima({ plataforma: "android", versao: dados.versao_minima.android })}
                className="mt-4 h-10 rounded-full border border-[#DDE1E8] px-5 text-[13px] font-bold"
              >
                Exigir versão mínima
              </button>
            )
          ) : null}
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="admin-surface border border-borda bg-fundo shadow-sm p-6">
            <h2 className="font-bold">Recursos ligados</h2>
            <p className="text-xs text-cinza">Desligar some com o recurso do app na próxima abertura, sem publicar versão nova.</p>
            <ul className="mt-3 space-y-2">
              {dados.recursos.map((r) => (
                <li key={r.chave} className="flex items-center gap-4 rounded-2xl bg-suave px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">{r.nome}</p>
                    <p className="text-xs text-cinza">{r.descricao}</p>
                    {r.por ? <p className="mt-0.5 text-[11px] text-cinza">Mudado por {r.por} {haQuanto(r.atualizado_em)}</p> : null}
                  </div>
                  <button
                    role="switch"
                    aria-checked={r.ligado}
                    aria-label={r.nome}
                    disabled={!pode}
                    onClick={() => alternar(r)}
                    className={`relative h-8 w-14 flex-none rounded-full transition-colors disabled:opacity-60 ${r.ligado ? "bg-tinta" : "bg-[#D5DAE2]"}`}
                  >
                    <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${r.ligado ? "left-7 bg-azul" : "left-1 bg-white"}`} />
                  </button>
                </li>
              ))}
            </ul>
            {!pode ? <p className="mt-2 text-[11px] text-cinza">Só o super admin liga e desliga recursos.</p> : null}
          </section>

          <section className="admin-surface border border-borda bg-fundo shadow-sm p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-bold">Erros do app</h2>
              <span className="text-xs text-cinza">Sentry</span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-cinza">
              Os erros do app chegam ao Sentry sem dados pessoais (LGPD). Lá ficam a tela, a versão e quantos tutores foram afetados.
            </p>
            <a href="https://sentry.io/issues/" target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 items-center rounded-full border border-[#DDE1E8] px-5 text-[13px] font-bold">
              Abrir o Sentry
            </a>
          </section>
        </div>
      </div>
    </>
  );
}

/** "1.4.10" < "1.10.0", número a número. */
function menor(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}
