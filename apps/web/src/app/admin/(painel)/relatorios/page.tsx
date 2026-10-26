"use client";

import { useEffect, useState } from "react";
import { Cabecalho, numero } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Relatorios = {
  funil: { contas: number; com_pet: number; com_vacina: number; com_lembrete: number; voltou_7d: number; premium_teste: number; premium_pago: number };
  cidades: { cidade: string; tutores: number; premium: number }[];
  sem_cidade: number;
  retencao: { mes: string; tutores: number; meses: (number | null)[] }[];
  dias_ate_vacina: number | null;
  pets_com_vacina_pct: number | null;
  especies: { cao: number; gato: number };
  racas: { raca: string; pets: number; pct: number }[];
  contas_por_dia: { dia: string; contas: number }[];
};

const PERIODOS = [
  { dias: 30, rotulo: "Últimos 30 dias" },
  { dias: 90, rotulo: "Últimos 90 dias" },
  { dias: 365, rotulo: "Último ano" },
];

function csv(d: Relatorios, periodo: string): string {
  const linhas = [
    ["Relatório", periodo],
    [],
    ["Funil", "Tutores"],
    ["Cadastrou a conta", d.funil.contas],
    ["Cadastrou um pet", d.funil.com_pet],
    ["Registrou a 1ª vacina", d.funil.com_vacina],
    ["Criou um lembrete", d.funil.com_lembrete],
    ["Voltou depois de 7 dias", d.funil.voltou_7d],
    ["Começou o teste do Premium", d.funil.premium_teste],
    ["Assinou o Premium", d.funil.premium_pago],
    [],
    ["Cidade", "Tutores", "Premium"],
    ...d.cidades.map((c) => [c.cidade, c.tutores, c.premium]),
    ["Sem cidade no perfil", d.sem_cidade, ""],
    [],
    ["Mês de entrada", "Tutores", ...d.retencao[0].meses.map((_, i) => `Mês ${i}`)],
    ...d.retencao.map((r) => [mesCurto(r.mes), r.tutores, ...r.meses.map((m) => (r.tutores && m !== null ? `${m}%` : ""))]),
    [],
    ["Dia", "Contas novas"],
    ...d.contas_por_dia.map((c) => [new Date(`${c.dia}T12:00:00`).toLocaleDateString("pt-BR"), c.contas]),
  ];
  return "﻿" + linhas.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
}

function mesCurto(iso: string): string {
  const texto = new Date(iso).toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Mais forte quanto maior a retenção (como no protótipo). */
function corRetencao(pct: number): string {
  if (pct >= 90) return "bg-azul";
  if (pct >= 50) return "bg-azul/60";
  if (pct >= 25) return "bg-azul/40";
  return "bg-azul/20";
}

/**
 * Relatórios (protótipo AdminRelatorios): como o tutor chega até usar o app
 * de verdade, até o Premium, quanto tempo ele fica e em que cidade está.
 * Tudo agregado, sem nomes; cidades com menos de 5 tutores ficam em "Outras".
 * Bairro não é coletado: a cidade do perfil é o recorte mais fino.
 */
export default function RelatoriosPagina() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Relatorios | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    rpcAdmin<Relatorios>("admin_relatorios", { p_dias: dias }).then(setDados, (e: Error) => setErro(e.message));
  }, [dias]);

  const periodo = PERIODOS.find((p) => p.dias === dias)!.rotulo;

  function exportar() {
    if (!dados) return;
    const url = URL.createObjectURL(new Blob([csv(dados, periodo)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `petlive-relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!dados) return <p className="text-sm text-cinza">{erro ?? "Carregando…"}</p>;
  const funil: [string, number, string][] = [
    ["Cadastrou a conta", dados.funil.contas, "bg-azul"],
    ["Cadastrou um pet", dados.funil.com_pet, "bg-azul"],
    ["Registrou a 1ª vacina", dados.funil.com_vacina, "bg-azul"],
    ["Criou um lembrete", dados.funil.com_lembrete, "bg-roxo-fundo"],
    ["Voltou depois de 7 dias", dados.funil.voltou_7d, "bg-tinta"],
    ["Começou o teste do Premium", dados.funil.premium_teste, "bg-amarelo-fundo"],
    ["Assinou o Premium", dados.funil.premium_pago, "bg-verde-texto"],
  ];
  const topo = Math.max(dados.funil.contas, 1);
  const colunas = Math.max(...dados.retencao.map((r) => r.meses.length));
  const totalPets = dados.especies.cao + dados.especies.gato;

  return (
    <>
      <Cabecalho titulo="Relatórios" subtitulo="Como o tutor chega a usar o app de verdade e quanto tempo ele fica">
        <button onClick={exportar} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-5 text-[13px] font-bold">
          Exportar CSV
        </button>
        <label className="sr-only" htmlFor="periodo">Período</label>
        <select id="periodo" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="h-10 rounded-full border border-[#DDE1E8] bg-fundo px-4 text-[13px] font-bold">
          {PERIODOS.map((p) => (
            <option key={p.dias} value={p.dias}>{p.rotulo}</option>
          ))}
        </select>
      </Cabecalho>
      {erro ? <p className="mb-3 rounded-2xl bg-perigo-fundo p-3 text-sm text-perigo">{erro}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <section className="min-w-0 rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold">Funil do tutor</h2>
            <span className="text-xs text-cinza">Contas criadas: {periodo.toLowerCase()}</span>
          </div>
          <ul className="mt-4 space-y-4">
            {funil.map(([rotulo, valor, cor]) => (
              <li key={rotulo}>
                <div className="flex justify-between text-[13px]">
                  <span>{rotulo}</span>
                  <span className="font-semibold">{numero(valor)}</span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-suave">
                  <div className={`h-3 rounded-full ${cor}`} style={{ width: `${Math.max((valor / topo) * 100, valor ? 3 : 0)}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-cinza">Assinou: pagou ao menos um período (teste grátis cancelado não conta).</p>
        </section>

        <section className="min-w-0 overflow-x-auto rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold">Retenção por mês de entrada</h2>
            <span className="text-xs text-cinza">Tutores que voltaram ao app</span>
          </div>
          <table className="mt-4 w-full border-separate border-spacing-1.5 text-center text-[13px]">
            <thead>
              <tr className="text-xs font-bold text-cinza">
                <th />
                <th className="font-bold">Tutores</th>
                {Array.from({ length: colunas }, (_, i) => (
                  <th key={i} className="font-bold">Mês {i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.retencao.map((r) => (
                <tr key={r.mes}>
                  <th className="pr-2 text-left text-xs font-bold text-cinza">{mesCurto(r.mes)}</th>
                  <td className="text-xs text-cinza">{numero(r.tutores)}</td>
                  {Array.from({ length: colunas }, (_, i) => {
                    const pct = r.meses[i];
                    if (pct === undefined) return <td key={i} />;
                    if (!r.tutores || pct === null) return <td key={i} className="rounded-xl bg-suave py-2.5 text-cinza">—</td>;
                    return (
                      <td key={i} className={`rounded-xl py-2.5 font-semibold ${corRetencao(pct)}`}>
                        {pct}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
        <section className="min-w-0 rounded-[28px] bg-fundo p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold">Raças mais comuns</h2>
            <span className="text-xs text-cinza">Top 5</span>
          </div>
          {dados.racas.length === 0 ? (
            <p className="mt-3 text-sm text-cinza">Nenhum pet cadastrado ainda.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {dados.racas.map((r) => (
                <li key={r.raca} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-[13px]">
                  <span className="truncate font-semibold">{r.raca}</span>
                  <span className="h-2 rounded-full bg-suave">
                    <span className="block h-2 rounded-full bg-azul" style={{ width: `${r.pct}%` }} />
                  </span>
                  <span className="text-right font-semibold">{r.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-[28px] bg-fundo p-6">
          <h2 className="font-bold">Tempo até a 1ª vacina</h2>
          <p className="mt-3 text-4xl font-medium tracking-tight">
            {dados.dias_ate_vacina === null ? "—" : `${String(dados.dias_ate_vacina).replace(".", ",")} dias`}
          </p>
          <p className="mt-1 text-xs text-cinza">Mediana depois do cadastro do pet</p>
          <p className="mt-3 text-xs text-cinza">
            {dados.pets_com_vacina_pct === null ? "Sem pets ainda" : `${dados.pets_com_vacina_pct}% dos pets têm alguma vacina registrada`}
          </p>
        </section>

        <section className="min-w-0 rounded-[28px] bg-fundo p-6">
          <h2 className="font-bold">Pets por espécie</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-suave">
            {totalPets ? (
              <>
                <span className="bg-azul" style={{ width: `${(dados.especies.cao / totalPets) * 100}%` }} />
                <span className="bg-roxo-fundo" style={{ width: `${(dados.especies.gato / totalPets) * 100}%` }} />
              </>
            ) : null}
          </div>
          <dl className="mt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between">
              <dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-azul" />Cães</dt>
              <dd className="font-semibold">{numero(dados.especies.cao)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-roxo-fundo" />Gatos</dt>
              <dd className="font-semibold">{numero(dados.especies.gato)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <section className="mt-4 rounded-[28px] bg-fundo p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Tutores por cidade</h2>
          <span className="text-xs text-cinza">Cidade do perfil · {numero(dados.sem_cidade)} sem cidade</span>
        </div>
        {dados.cidades.length === 0 ? (
          <p className="mt-3 text-sm text-cinza">Nenhum tutor informou a cidade ainda.</p>
        ) : (
          <table className="mt-3 w-full text-left text-[13px]">
            <thead className="text-[11px] font-bold uppercase tracking-wider text-[#6A7484]">
              <tr>
                <th className="py-2">Cidade</th>
                <th className="py-2">Tutores</th>
                <th className="py-2">Premium</th>
              </tr>
            </thead>
            <tbody>
              {dados.cidades.map((c) => (
                <tr key={c.cidade} className="border-t border-[#EEF0F4]">
                  <td className="py-2.5 font-semibold">{c.cidade}</td>
                  <td className="py-2.5">{numero(c.tutores)}</td>
                  <td className="py-2.5">{numero(c.premium)} <span className="text-cinza">({c.tutores ? Math.round((c.premium / c.tutores) * 100) : 0}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
