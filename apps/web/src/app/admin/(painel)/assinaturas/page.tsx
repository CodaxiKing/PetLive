"use client";

import { useEffect, useState } from "react";
import { Cabecalho, CartaoNumero, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

const ESTADOS: Record<string, string> = { ativa: "Ativa", em_teste: "Em teste", pagamento_falhou: "Pagamento falhou", cancelando: "Cancelamento agendado", cancelada: "Cancelada", expirada: "Expirada" };
const PROVEDORES: Record<string, string> = { asaas: "Asaas", google_play: "Google Play", app_store: "App Store" };
type Contrato = { id: string; tutor_id: string; nome: string; email: string; plano: string; ciclo: string; provedor: string; status: string; status_registrado: string; periodo_inicio: string; periodo_fim: string; forma_pagamento: string | null; valor_centavos: number | null };
type Resposta = { total: number; pagina: number; por_pagina: number; resumo: { ativas: number; em_teste: number; pagamento_falhou: number; cancelando: number; canceladas: number; expiradas: number }; itens: Contrato[] };
const data = (v: string) => new Date(v).toLocaleDateString("pt-BR");

export default function Assinaturas() {
  const admin = useAdmin();
  return ["super", "financeiro", "leitura"].includes(admin.papel) ? <Lista /> : <p role="alert">Sua função não permite consultar assinaturas.</p>;
}

function Lista() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [ciclo, setCiclo] = useState("");
  const [provedor, setProvedor] = useState("");
  const [pagina, setPagina] = useState(0);
  const [repetir, setRepetir] = useState(0);
  const [consulta, setConsulta] = useState<{ chave: string; dados?: Resposta; erro?: boolean } | null>(null);
  const [detalhe, setDetalhe] = useState<Contrato | null>(null);
  const chave = JSON.stringify([busca.trim(), status, ciclo, provedor, pagina, repetir]);
  useEffect(() => {
    let ativo = true;
    const timer = setTimeout(() => {
      void rpcAdmin<Resposta>("admin_assinaturas", { p_busca: busca.trim() || null, p_status: status || null, p_ciclo: ciclo || null, p_provedor: provedor || null, p_pagina: pagina })
        .then(dados => { if (ativo) setConsulta({ chave, dados }); })
        .catch(() => { if (ativo) setConsulta({ chave, erro: true }); });
    }, 300);
    return () => { ativo = false; clearTimeout(timer); };
  }, [busca, status, ciclo, provedor, pagina, chave]);
  const resultado = consulta?.chave === chave ? consulta : null;
  const dados = resultado?.dados;
  const campo = "h-10 rounded-full border border-[#DDE1E8] bg-white px-4 text-sm";
  function mudar(acao: () => void) { acao(); setPagina(0); setDetalhe(null); }
  return <>
    <Cabecalho titulo="Assinaturas" subtitulo="Contratos Premium, falhas de pagamento e cancelamentos" />
    <p className="mb-4 text-sm text-cinza">Consulta dos contratos registrados. A integração de cobrança ainda está em implantação; esta tela não altera planos ou pagamentos.</p>
    <form onSubmit={e => e.preventDefault()} className="mb-4 flex flex-wrap gap-3" aria-label="Filtrar assinaturas">
      <label className="flex flex-col gap-1 text-xs">Tutor ou e-mail<input className={campo} value={busca} maxLength={120} onChange={e => mudar(() => setBusca(e.target.value))} placeholder="Buscar tutor" /></label>
      <label className="flex flex-col gap-1 text-xs">Status<select className={campo} value={status} onChange={e => mudar(() => setStatus(e.target.value))}><option value="">Todos</option>{Object.entries(ESTADOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
      <label className="flex flex-col gap-1 text-xs">Ciclo<select className={campo} value={ciclo} onChange={e => mudar(() => setCiclo(e.target.value))}><option value="">Todos</option><option value="mensal">Mensal</option><option value="anual">Anual</option></select></label>
      <label className="flex flex-col gap-1 text-xs">Provedor<select className={campo} value={provedor} onChange={e => mudar(() => setProvedor(e.target.value))}><option value="">Todos</option>{Object.entries(PROVEDORES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
      <button className={`${campo} self-end font-bold`} type="button" onClick={() => { setDetalhe(null); setRepetir(n => n + 1); }}>Atualizar</button>
    </form>
    {!resultado ? <p role="status">Consultando assinaturas…</p> : resultado.erro ? <p role="alert" className="rounded-2xl bg-perigo-fundo p-4 text-perigo">Não foi possível consultar. Confira seu acesso e conexão e use Atualizar para tentar novamente.</p> : dados ? <>
      <p className="mb-2 text-xs text-cinza">Resumo de todos os contratos registrados, independente dos filtros. Contratos com período encerrado contam como expirados.</p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CartaoNumero rotulo="Ativas" valor={String(dados.resumo.ativas)} fundo="bg-roxo-fundo" cor="text-tinta" />
        <CartaoNumero rotulo="Em teste" valor={String(dados.resumo.em_teste)} fundo="bg-amarelo-fundo" cor="text-tinta" />
        <CartaoNumero rotulo="Pagamento falhou" valor={String(dados.resumo.pagamento_falhou)} fundo="bg-rosa-fundo" cor="text-tinta" />
        <CartaoNumero rotulo="Cancelamento agendado" valor={String(dados.resumo.cancelando)} fundo="bg-azul-fundo" cor="text-tinta" apoio={`${dados.resumo.canceladas} canceladas · ${dados.resumo.expiradas} expiradas`} />
      </div>
      <div className="overflow-x-auto rounded-[26px] bg-fundo">
        <table className="w-full text-left text-sm"><caption className="p-4 text-left font-bold">{dados.total} contrato(s) encontrado(s)</caption><thead><tr>{["Tutor", "Plano contratado", "Período até", "Status", "Detalhes"].map(t => <th key={t} className="px-4 py-3">{t}</th>)}</tr></thead><tbody>
          {dados.itens.map(a => <tr key={a.id} className="border-t border-[#DDE1E8]"><td className="px-4 py-3"><p className="font-bold">{a.nome || "Tutor"}</p><p className="text-xs text-cinza">{a.email}</p></td><td className="px-4 py-3">Premium {a.ciclo}<p className="text-xs text-cinza">{PROVEDORES[a.provedor]}</p></td><td className="px-4 py-3">{data(a.periodo_fim)}</td><td className="px-4 py-3">{ESTADOS[a.status]}</td><td className="px-4 py-3"><button type="button" className="rounded-full bg-azul-fundo px-4 py-2 font-bold" aria-label={`Ver contrato de ${a.nome || a.email}`} onClick={() => setDetalhe(a)}>Ver contrato</button></td></tr>)}
          {!dados.itens.length ? <tr><td colSpan={5} className="p-6">Nenhuma assinatura encontrada para estes filtros.</td></tr> : null}
        </tbody></table>
      </div>
      <nav aria-label="Páginas de assinaturas" className="my-4 flex items-center gap-3"><button className={campo} disabled={pagina === 0} onClick={() => { setDetalhe(null); setPagina(p => p - 1); }}>Anterior</button><span>Página {pagina + 1} de {Math.max(1, Math.ceil(dados.total / 25))}</span><button className={campo} disabled={(pagina + 1) * 25 >= dados.total} onClick={() => { setDetalhe(null); setPagina(p => p + 1); }}>Próxima</button></nav>
      {detalhe ? <section aria-label="Detalhes do contrato" className="rounded-[26px] bg-fundo p-6"><div className="flex justify-between gap-4"><h2 className="text-lg font-bold">Contrato de {detalhe.nome || "Tutor"}</h2><button type="button" onClick={() => setDetalhe(null)} className="font-bold">Fechar</button></div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">{[
          ["Status", ESTADOS[detalhe.status]], ["Status recebido do provedor", ESTADOS[detalhe.status_registrado]],
          ["Período", `${data(detalhe.periodo_inicio)} a ${data(detalhe.periodo_fim)}`],
          ["Valor do contrato", detalhe.valor_centavos === null ? "Não informado" : (detalhe.valor_centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
          ["Pagamento", ({ pix: "Pix", cartao: "Cartão", loja_apps: "Loja de aplicativos" } as Record<string, string>)[detalhe.forma_pagamento ?? ""] ?? "Não informado"],
          ["Acesso atual do tutor", detalhe.plano === "premium" ? "Premium" : "Grátis"],
        ].map(([rotulo, valor]) => <div key={rotulo}><dt className="text-xs text-cinza">{rotulo}</dt><dd className="font-semibold">{valor}</dd></div>)}</dl>
        <p className="mt-4 text-sm text-cinza">Contrato e acesso atual são informações distintas. Cancelamento agendado preserva o período já pago; este painel não efetua cancelamentos ou novas tentativas de cobrança.</p>
      </section> : null}
    </> : null}
  </>;
}
