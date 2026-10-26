"use client";

import { useEffect, useState } from "react";
import { Cabecalho, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";

type Inventario = { consultado_em: string; componentes: Record<string, boolean> };
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
  useEffect(() => {
    let atual = true;
    void rpcAdmin<Inventario>("admin_integracoes").then(dados => {
      if (atual) setConsulta({ tentativa, dados });
    }).catch(() => { if (atual) setConsulta({ tentativa, erro: true }); });
    return () => { atual = false; };
  }, [tentativa]);
  const resultado = consulta?.tentativa === tentativa ? consulta : undefined;
  return <>
    <Cabecalho titulo="Integrações" subtitulo="Componentes do servidor e pendências de validação externa">
      <button type="button" className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white" onClick={() => setTentativa(t => t + 1)}>Atualizar inventário</button>
    </Cabecalho>
    <p className="mb-5 rounded-2xl bg-amarelo-fundo p-4 text-sm">Este inventário consulta somente a presença de componentes no banco. Não verifica credenciais, publicação nas lojas, cobrança ou entrega de mensagens. A venda de Premium continua indisponível.</p>
    <section aria-label="Componentes do banco" className="mb-7 rounded-[26px] bg-white p-6">
      <h2 className="mb-3 text-lg font-bold">Componentes instalados</h2>
      {!resultado ? <p role="status">Consultando o servidor…</p> : resultado.erro ? <p role="alert">Não foi possível consultar. Confira o acesso e a conexão e tente atualizar novamente.</p> : resultado.dados ? <>
        <p className="mb-4 text-xs text-cinza">Consultado em {new Date(resultado.dados.consultado_em).toLocaleString("pt-BR")}. Presença no banco não confirma operação.</p>
        <dl className="grid gap-3 sm:grid-cols-2">{COMPONENTES.map(([id, nome]) => <div key={id} className="rounded-2xl bg-fundo p-4"><dt className="text-sm font-bold">{nome}</dt><dd className="mt-1 text-sm">{resultado.dados!.componentes[id] === true ? "Instalado" : "Não encontrado"}</dd></div>)}</dl>
      </> : null}
    </section>
    <h2 className="mb-3 text-lg font-bold">Validações externas</h2>
    <p className="mb-4 text-sm text-cinza">Roteiro de conferência manual. O estado dessas contas não é consultado por esta tela.</p>
    <div className="grid gap-4 lg:grid-cols-2">{EXTERNOS.map(([nome, orientacao]) => <section key={nome} className="rounded-[26px] bg-white p-6"><h3 className="font-bold">{nome}</h3><p className="my-2 text-xs font-semibold text-cinza">Não verificado pelo painel</p><p className="text-sm">{orientacao}</p></section>)}</div>
  </>;
}
