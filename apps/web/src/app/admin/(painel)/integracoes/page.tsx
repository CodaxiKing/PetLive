"use client";

import { useEffect, useState } from "react";
import { Cabecalho, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin, supabaseAdmin } from "@/lib/admin/supabase";

type Inventario = { consultado_em: string; componentes: Record<string, boolean> };
type Diagnostico = {
  operacao: { consultado_em: string; jobs: { nome: string; instalado: boolean; ativo: boolean; ultimo_estado: string | null; ultima_execucao: string | null }[];
    push: { pendentes: number; falhas_24h: number; pendente_mais_antigo: string | null } | null; exclusao: { habilitado: boolean; aceita_pedidos: boolean; ultima_execucao: string | null } | null };
  gateway_push: { estado: "respondendo" | "falha_http" | "indisponivel"; http: number | null; latencia_ms: number };
  configuracao: { google_places: boolean; leitura_fotos: boolean };
};
const COMPONENTES = [
  ["assinaturas", "Contratos de assinatura"], ["planos", "Rascunhos de planos"],
  ["cupons", "Rascunhos de cupons"], ["push_fila", "Fila de notificações"],
  ["push_processador", "Processador de notificações"], ["mapa", "Consulta de lugares próximos"],
];
const EXTERNOS = [
  ["Google Play Console", "Conferir publicação, produtos e notificações de compras no Play Console."],
  ["App Store Connect", "Conferir publicação, produtos e notificações de compras no App Store Connect."],
  ["Asaas e Pix", "Validar conta, checkout e recebimento de webhooks antes de habilitar vendas."],
  ["Firebase e Expo Push", "Configurar FCM v1 no EAS e validar entrega em um aparelho Android."],
  ["Google Places", "Conferir a chave no servidor, as restrições e a resposta das funções de lugares."],
  ["E-mail", "Conferir o SMTP no Supabase e validar recebimento e confirmação de e-mail."],
];

export default function Integracoes() {
  const admin = useAdmin();
  return ["super", "leitura"].includes(admin.papel) ? <Inventario /> : <p role="alert">Sua função não permite consultar integrações.</p>;
}

function Inventario() {
  const [tentativa, setTentativa] = useState(0);
  const [consulta, setConsulta] = useState<{ tentativa: number; dados?: Inventario; erro?: boolean }>();
  const [diagnostico, setDiagnostico] = useState<{ tentativa: number; dados?: Diagnostico; erro?: boolean }>();
  useEffect(() => {
    let atual = true;
    void rpcAdmin<Inventario>("admin_integracoes").then(dados => {
      if (atual) setConsulta({ tentativa, dados });
    }).catch(() => { if (atual) setConsulta({ tentativa, erro: true }); });
    void supabaseAdmin().functions.invoke("integracoes-verificar", { body: {} }).then(({ data, error }) => {
      if (!atual) return;
      if (error || !data?.operacao || !Array.isArray(data.operacao.jobs) || !data.gateway_push || !data.configuracao) setDiagnostico({ tentativa, erro: true });
      else setDiagnostico({ tentativa, dados: data as Diagnostico });
    }).catch(() => { if (atual) setDiagnostico({ tentativa, erro: true }); });
    return () => { atual = false; };
  }, [tentativa]);
  const resultado = consulta?.tentativa === tentativa ? consulta : undefined;
  const verificacao = diagnostico?.tentativa === tentativa ? diagnostico : undefined;
  const saude = verificacao?.dados;
  return <>
    <Cabecalho titulo="Integrações" subtitulo="Componentes, filas e verificação dos serviços">
      <button type="button" className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white" onClick={() => setTentativa(t => t + 1)}>Atualizar inventário</button>
    </Cabecalho>
    <p className="mb-5 rounded-2xl bg-amarelo-fundo p-4 text-sm">O diagnóstico confere os jobs, a fila e a resposta do gateway. Credenciais das lojas, FCM/APNs e entrega no aparelho exigem homologação. A integração de cobrança está adiada.</p>
    <section aria-label="Componentes do banco" className="mb-7 admin-surface bg-white p-6">
      <h2 className="mb-3 text-lg font-bold">Componentes instalados</h2>
      {!resultado ? <p role="status">Consultando o servidor…</p> : resultado.erro ? <p role="alert">Não foi possível consultar. Confira o acesso e a conexão e tente atualizar novamente.</p> : resultado.dados ? <>
        <p className="mb-4 text-xs text-cinza">Consultado em {new Date(resultado.dados.consultado_em).toLocaleString("pt-BR")}. Presença no banco não confirma operação.</p>
        <dl className="grid gap-3 sm:grid-cols-2">{COMPONENTES.map(([id, nome]) => <div key={id} className="rounded-2xl bg-fundo p-4"><dt className="text-sm font-bold">{nome}</dt><dd className="mt-1 text-sm">{resultado.dados!.componentes[id] === true ? "Instalado" : "Não encontrado"}</dd></div>)}</dl>
      </> : null}
    </section>
    <section aria-label="Diagnóstico operacional" className="mb-7 admin-surface bg-white p-6">
      <h2 className="mb-3 text-lg font-bold">Operação dos serviços</h2>
      {!verificacao ? <p role="status">Verificando…</p> : verificacao.erro ? <p role="alert">Diagnóstico indisponível. Confira a implantação de integracoes-verificar e da RPC de diagnóstico, sua sessão com 2FA e tente atualizar.</p> : saude ? <>
        <p className="mb-4 text-xs text-cinza">Verificado em {new Date(saude.operacao.consultado_em).toLocaleString("pt-BR")}. Resposta HTTP não comprova entrega de notificações.</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-fundo p-4"><dt className="font-bold">Gateway Expo Push</dt><dd>{saude.gateway_push.estado === "respondendo" ? `Respondendo · ${saude.gateway_push.latencia_ms} ms` : saude.gateway_push.estado === "falha_http" ? `Falha HTTP ${saude.gateway_push.http}` : "Não respondeu à verificação"}</dd></div>
          <div className="rounded-2xl bg-fundo p-4"><dt className="font-bold">Fila de push</dt><dd>{saude.operacao.push ? `${saude.operacao.push.pendentes} pendentes · ${saude.operacao.push.falhas_24h} falhas nas últimas 24 h` : "Fila não instalada"}</dd></div>
          <div className="rounded-2xl bg-fundo p-4"><dt className="font-bold">Exclusão de conta</dt><dd>{!saude.operacao.exclusao?.habilitado ? "Processamento desabilitado" : saude.operacao.exclusao.aceita_pedidos ? "Habilitado · execução recente confirmada" : "Sem execução recente · novos pedidos bloqueados"}</dd></div>
          <div className="rounded-2xl bg-fundo p-4"><dt className="font-bold">Configuração do servidor</dt><dd>Places: {saude.configuracao.google_places ? "chave presente" : "sem chave"}<br />Leitura de fotos: {saude.configuracao.leitura_fotos ? "chave presente" : "sem chave"}</dd></div>
        </dl>
        <h3 className="mb-2 mt-5 font-bold">Tarefas agendadas</h3>
        <ul className="space-y-2 text-sm">{saude.operacao.jobs.map(job => <li key={job.nome} className="rounded-xl bg-fundo p-3"><strong>{job.nome}</strong><br />{!job.instalado ? "Não instalado" : job.ativo ? "Ativo" : "Pausado"} · {job.ultimo_estado ?? "Sem execução registrada"}{job.ultima_execucao ? ` · ${new Date(job.ultima_execucao).toLocaleString("pt-BR")}` : ""}</li>)}</ul>
      </> : null}
    </section>
    <h2 className="mb-3 text-lg font-bold">Validações externas</h2>
    <p className="mb-4 text-sm text-cinza">Roteiro de conferência manual. O estado dessas contas não é consultado por esta tela.</p>
    <div className="grid gap-4 lg:grid-cols-2">{EXTERNOS.map(([nome, orientacao]) => <section key={nome} className="admin-surface bg-white p-6"><h3 className="font-bold">{nome}</h3><p className="my-2 text-xs font-semibold text-cinza">Não verificado pelo painel</p><p className="text-sm">{orientacao}</p></section>)}</div>
  </>;
}
