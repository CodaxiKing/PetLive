"use client";
import { useRef, useState } from "react";
import { rpcAdmin } from "@/lib/admin/supabase";
import { centavos, inteiro } from "@/lib/admin/rascunhos";

const VAZIO = { titulo: "", tipo: "encontro", descricao: "", inicio: "", fim: "", local: "", lat: "", lng: "", gratuito: true, preco: "", ingresso: "", vagas: "" };
const TIPOS = { adocao: "Adoção", vacinacao: "Vacinação", passeio: "Passeio", encontro: "Encontro", palestra: "Palestra", outro: "Outro" };
function coordenada(v: string, limite: number) {
  if (!/^-?\d{1,3}([,.]\d{1,8})?$/.test(v.trim())) throw new Error("Informe latitude e longitude decimais válidas.");
  const n = Number(v.trim().replace(",", "."));
  if (Math.abs(n) > limite) throw new Error("Coordenada fora do intervalo permitido.");
  return n;
}

export function EventoOficial({ onPublicado }: { onPublicado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [confirmado, setConfirmado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const trava = useRef(false);
  const pedido = useRef<{ assinatura: string; chave: string } | null>(null);
  async function publicar(e: React.FormEvent) {
    e.preventDefault(); if (trava.current || !confirmado) return;
    trava.current = true; setSalvando(true); setErro(undefined); setAviso(undefined);
    try {
      const inicio = new Date(form.inicio), fim = new Date(form.fim);
      if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || inicio <= new Date() || fim <= inicio || fim.getTime() - inicio.getTime() > 7 * 86400000) throw new Error("Informe datas futuras, com término após o início e duração de até 7 dias.");
      const evento = { titulo: form.titulo.trim(), tipo: form.tipo, descricao: form.descricao.trim(),
        inicio_em: inicio.toISOString(), fim_em: fim.toISOString(), local_nome: form.local.trim(),
        lat: coordenada(form.lat, 90), lng: coordenada(form.lng, 180), gratuito: form.gratuito,
        preco_centavos: form.gratuito ? null : centavos(form.preco), ingresso_url: form.gratuito ? null : form.ingresso.trim(),
        vagas: form.vagas.trim() ? inteiro(form.vagas.trim(), 1, 100000) : null };
      const assinatura = JSON.stringify(evento);
      if (pedido.current?.assinatura !== assinatura) pedido.current = { assinatura, chave: await rpcAdmin<string>("admin_evento_chave") };
      await rpcAdmin<string>("admin_evento_oficial_criar", { p_chave: pedido.current.chave, p_evento: evento, p_confirmar: confirmado });
      pedido.current = null; setForm(VAZIO); setConfirmado(false); setAberto(false);
      setAviso("Evento oficial publicado. Ele pode ser encontrado no mapa pela região e data informadas."); onPublicado();
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível publicar. Tente novamente com os mesmos dados."); }
    finally { trava.current = false; setSalvando(false); }
  }
  const campo = "mt-1 w-full rounded-2xl border border-borda bg-white px-4 py-3 text-sm";
  return <section aria-label="Cadastrar evento oficial" className="mb-5 space-y-3 rounded-[28px] bg-white p-5">
    <button type="button" disabled={salvando} className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white" onClick={() => setAberto(v => !v)}>{aberto ? "Fechar cadastro" : "Novo evento do PetLive"}</button>
    {aberto ? <form onSubmit={publicar}><fieldset disabled={salvando} className="space-y-3">
      <h2 className="text-lg font-bold">Evento oficial</h2><p className="text-sm text-cinza">Será publicado diretamente. Cobrança de ingressos ocorre apenas no site externo informado. Datas usam o fuso deste navegador: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
      <label className="block text-sm">Título<input required minLength={3} maxLength={100} className={campo} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></label>
      <label className="block text-sm">Tipo<select className={campo} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>{Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
      <label className="block text-sm">Descrição<textarea required minLength={10} maxLength={3000} className={`${campo} min-h-28`} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Início<input required type="datetime-local" className={campo} value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></label><label className="block text-sm">Término<input required type="datetime-local" className={campo} value={form.fim} onChange={e => setForm({ ...form, fim: e.target.value })} /></label></div>
      <label className="block text-sm">Nome e endereço do local<input required minLength={2} maxLength={160} className={campo} value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} /></label>
      <p className="text-xs text-cinza">Informe as coordenadas do local para o evento aparecer na região correta do mapa.</p>
      <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Latitude<input required inputMode="decimal" placeholder="Ex.: -22,759" className={campo} value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></label><label className="block text-sm">Longitude<input required inputMode="decimal" placeholder="Ex.: -43,451" className={campo} value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></label></div>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.gratuito} onChange={e => setForm({ ...form, gratuito: e.target.checked })} />Entrada gratuita</label>
      {!form.gratuito ? <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm">Preço em reais<input required inputMode="decimal" className={campo} value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} /></label><label className="block text-sm">Link HTTPS dos ingressos<input required type="url" pattern="https://.*" className={campo} value={form.ingresso} onChange={e => setForm({ ...form, ingresso: e.target.value })} /></label></div> : null}
      <label className="block text-sm">Vagas (opcional)<input type="number" min={1} max={100000} step={1} className={campo} value={form.vagas} onChange={e => setForm({ ...form, vagas: e.target.value })} /></label>
      <label className="flex gap-2 text-sm"><input required type="checkbox" checked={confirmado} onChange={e => setConfirmado(e.target.checked)} />Revisei as informações e confirmo a publicação como evento oficial do PetLive.</label>
      <button disabled={!confirmado} type="submit" className="rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white">{salvando ? "Publicando…" : "Publicar evento do PetLive"}</button>
    </fieldset></form> : null}
    {erro ? <p role="alert" className="text-sm text-perigo">{erro}</p> : null}{aviso ? <p role="status" className="text-sm">{aviso}</p> : null}
  </section>;
}
