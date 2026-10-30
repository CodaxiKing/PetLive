"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Cabecalho, useAdmin } from "@/components/admin/Painel";
import { rpcAdmin } from "@/lib/admin/supabase";
import { centavos, reais, inteiro, dataLocal } from "@/lib/admin/rascunhos";

type Plano = { ciclo: string; preco_centavos: number|null; dias_teste: number; versao: number };
type Cupom = { id: string; codigo: string; tipo: string; valor: number; inicio: string; fim: string; limite_usos: number; minimo_centavos: number; arquivado: boolean; versao: number };
type Dados = { venda_disponivel: false; planos: Plano[]; cupons: Cupom[]; total_cupons: number };
type Agir = (operacao: () => Promise<unknown>) => Promise<boolean>;
const campo = "rounded-2xl border border-[#DDE1E8] bg-white px-4 py-2 text-sm";
const botao = "rounded-full bg-tinta px-5 py-3 text-sm font-bold text-white disabled:opacity-50";
const TIPOS: Record<string,string> = { percentual: "Percentual", valor_fixo: "Valor em reais", dias_gratis: "Dias grátis" };

export default function Planos() {
  const admin = useAdmin();
  if (!["super", "financeiro", "leitura"].includes(admin.papel)) return <p role="alert">Sua função não permite consultar planos.</p>;
  return <PainelPlanos podeEditar={admin.papel !== "leitura"} />;
}
function PainelPlanos({ podeEditar }: { podeEditar: boolean }) {
  const [pagina, setPagina] = useState(0), [tentativa, setTentativa] = useState(0);
  const [resposta, setResposta] = useState<{ chave: string; dados?: Dados; erro?: boolean }|null>(null);
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [editar, setEditar] = useState<Cupom|null|undefined>(undefined);
  const trava = useRef(false), vivo = useRef(true);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const chave = `${pagina}:${tentativa}`;
  useEffect(() => {
    let ativo = true;
    void rpcAdmin<Dados>("admin_planos", { p_pagina: pagina }).then(dados => {
      if (dados.venda_disponivel !== false || !Array.isArray(dados.planos) || !Array.isArray(dados.cupons)) throw new Error('Resposta inválida');
      if (ativo) setResposta({ chave, dados });
    }).catch(() => { if (ativo) setResposta({ chave, erro: true }); });
    return () => { ativo = false; };
  }, [pagina, chave]);
  const agir: Agir = async operacao => {
    if (trava.current) return false;
    trava.current = true; setOcupado(true); setMensagem("");
    try {
      await operacao();
      if (!vivo.current) return false;
      setMensagem("Rascunho salvo. A venda do Premium continua indisponível."); setEditar(undefined); setTentativa(n => n + 1);
      return true;
    } catch (e) { if (vivo.current) setMensagem(e instanceof Error ? e.message : "Não foi possível salvar."); return false; }
    finally { trava.current = false; if (vivo.current) setOcupado(false); }
  };
  const consulta = resposta?.chave === chave ? resposta : null;
  const dados = consulta?.dados;
  return <>
    <Cabecalho titulo="Planos e cupons" subtitulo="Preparação das ofertas do Premium" />
    <p className="mb-4 rounded-2xl bg-amarelo-fundo p-4 text-sm">Somente rascunhos. Salvar preços, teste grátis ou cupons não ativa vendas, não altera assinaturas existentes nem concede Premium.</p>
    <button disabled={ocupado} className={`${campo} mb-4`} onClick={() => { setEditar(undefined); setTentativa(n => n + 1); }}>Atualizar</button>
    {mensagem ? <p role="status" className="mb-4 whitespace-pre-wrap rounded-2xl bg-azul-fundo p-4 text-sm">{mensagem}</p> : null}
    {!consulta ? <p role="status">Carregando rascunhos…</p> : consulta.erro ? <p role="alert">Não foi possível consultar. Confira o acesso e a conexão e use Atualizar para tentar novamente.</p> : dados ? <>
      <section aria-label="Preços do Premium" className="mb-6 grid gap-4 md:grid-cols-2">{dados.planos.map(p => <EditorPlano key={`${p.ciclo}:${p.versao}`} plano={p} bloqueado={ocupado || !podeEditar} agir={agir} />)}</section>
      <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-xl font-bold">Cupons do Premium</h2>{podeEditar ? <button className={botao} disabled={ocupado} onClick={() => setEditar(null)}>Novo rascunho</button> : null}</div>
      <p className="mb-3 text-sm text-cinza">Cupons exclusivos do Premium. Não são válidos para produtos, serviços ou entrega.</p>
      <div className="overflow-x-auto admin-surface bg-fundo"><table className="w-full text-left text-sm"><thead><tr>{["Código", "Benefício", "Validade", "Estado", "Editar"].map(t => <th key={t} className="p-4">{t}</th>)}</tr></thead><tbody>{dados.cupons.map(c => <tr key={c.id} className="border-t border-[#DDE1E8]"><td className="p-4 font-bold">{c.codigo}</td><td className="p-4">{c.tipo === 'percentual' ? `${c.valor}%` : c.tipo === 'dias_gratis' ? `${c.valor} dias` : `R$ ${reais(c.valor)}`}</td><td className="p-4">{new Date(c.inicio).toLocaleString('pt-BR')} a {new Date(c.fim).toLocaleString('pt-BR')}</td><td className="p-4">{c.arquivado ? 'Arquivado' : 'Rascunho'}</td><td className="p-4">{podeEditar ? <button className={campo} disabled={ocupado} aria-label={`Editar ${c.codigo}`} onClick={() => setEditar(c)}>Editar</button> : 'Somente leitura'}</td></tr>)}{!dados.cupons.length ? <tr><td colSpan={5} className="p-6">Nenhum cupom preparado.</td></tr> : null}</tbody></table></div>
      <nav aria-label="Páginas de cupons" className="my-4 flex items-center gap-3"><button className={campo} disabled={ocupado || pagina===0} onClick={() => { setEditar(undefined); setPagina(p => p-1); }}>Anterior</button><span>Página {pagina+1} de {Math.max(1,Math.ceil(dados.total_cupons/25))}</span><button className={campo} disabled={ocupado || (pagina+1)*25>=dados.total_cupons} onClick={() => { setEditar(undefined); setPagina(p => p+1); }}>Próxima</button></nav>
      {editar !== undefined && podeEditar ? <EditorCupom key={editar?.id ?? 'novo'} cupom={editar} bloqueado={ocupado} agir={agir} cancelar={() => setEditar(undefined)} /> : null}
    </> : null}
  </>;
}
function EditorPlano({ plano, bloqueado, agir }: { plano: Plano; bloqueado: boolean; agir: Agir }) {
  const [preco, setPreco] = useState(reais(plano.preco_centavos)), [dias, setDias] = useState(String(plano.dias_teste));
  async function salvar(e: FormEvent) {
    e.preventDefault();
    await agir(async () => rpcAdmin('admin_plano_salvar', { p_ciclo: plano.ciclo, p_versao: plano.versao, p_preco_centavos: centavos(preco), p_dias_teste: inteiro(dias,0,90) }));
  }
  return <form onSubmit={salvar} className="flex flex-col gap-3 rounded-[26px] bg-roxo-fundo p-6"><h2 className="text-xl font-bold">Premium {plano.ciclo}</h2><label className="flex flex-col gap-1 text-sm">Preço em reais<input required className={campo} inputMode="decimal" value={preco} onChange={e=>setPreco(e.target.value)} disabled={bloqueado} placeholder="Não definido" /></label><label className="flex flex-col gap-1 text-sm">Dias de teste grátis (0 a 90)<input required className={campo} inputMode="numeric" value={dias} onChange={e=>setDias(e.target.value)} disabled={bloqueado} /></label><button className={botao} disabled={bloqueado}>Salvar rascunho {plano.ciclo}</button></form>;
}
function EditorCupom({ cupom, bloqueado, agir, cancelar }: { cupom: Cupom|null; bloqueado: boolean; agir: Agir; cancelar: () => void }) {
  const [codigo,setCodigo]=useState(cupom?.codigo??''),[tipo,setTipo]=useState(cupom?.tipo??'percentual');
  const [valor,setValor]=useState(cupom ? cupom.tipo==='valor_fixo' ? reais(cupom.valor) : String(cupom.valor) : '');
  const [inicio,setInicio]=useState(cupom ? dataLocal(cupom.inicio) : ''),[fim,setFim]=useState(cupom ? dataLocal(cupom.fim) : '');
  const [limite,setLimite]=useState(cupom ? String(cupom.limite_usos) : ''),[minimo,setMinimo]=useState(reais(cupom?.minimo_centavos??0));
  const [arquivado,setArquivado]=useState(cupom?.arquivado??false);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    await agir(async () => {
      const de=new Date(inicio),ate=new Date(fim);
      if (!Number.isFinite(de.getTime()) || !Number.isFinite(ate.getTime()) || ate<=de) throw new Error('Informe início e fim válidos. O fim deve ser posterior ao início.');
      return rpcAdmin('admin_cupom_salvar',{p_id:cupom?.id??null,p_versao:cupom?.versao??0,p_codigo:codigo,p_tipo:tipo,p_valor:tipo==='valor_fixo'?centavos(valor):inteiro(valor,1,tipo==='percentual'?100:365),p_inicio:de.toISOString(),p_fim:ate.toISOString(),p_limite_usos:inteiro(limite),p_minimo_centavos:centavos(minimo,true),p_arquivado:arquivado});
    });
  }
  return <form onSubmit={salvar} className="flex max-w-2xl flex-col gap-3 admin-surface bg-fundo p-6"><h3 className="text-lg font-bold">{cupom?'Editar cupom':'Novo cupom'} · rascunho</h3>
    <label className="flex flex-col gap-1 text-sm">Código (4 a 30 caracteres)<input required maxLength={30} minLength={4} disabled={bloqueado} className={campo} value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())} /></label>
    <label className="flex flex-col gap-1 text-sm">Tipo<select disabled={bloqueado} className={campo} value={tipo} onChange={e=>{setTipo(e.target.value);setValor('');}}>{Object.entries(TIPOS).map(([v,r])=><option key={v} value={v}>{r}</option>)}</select></label>
    <label className="flex flex-col gap-1 text-sm">{tipo==='percentual'?'Percentual (1 a 100)':tipo==='dias_gratis'?'Dias grátis (1 a 365)':'Desconto em reais'}<input required disabled={bloqueado} className={campo} inputMode={tipo==='valor_fixo'?'decimal':'numeric'} value={valor} onChange={e=>setValor(e.target.value)} /></label>
    <label className="flex flex-col gap-1 text-sm">Início (horário local)<input required type="datetime-local" disabled={bloqueado} className={campo} value={inicio} onChange={e=>setInicio(e.target.value)} /></label>
    <label className="flex flex-col gap-1 text-sm">Fim (horário local)<input required type="datetime-local" disabled={bloqueado} className={campo} value={fim} onChange={e=>setFim(e.target.value)} /></label>
    <label className="flex flex-col gap-1 text-sm">Limite de usos<input required disabled={bloqueado} className={campo} inputMode="numeric" value={limite} onChange={e=>setLimite(e.target.value)} /></label>
    <label className="flex flex-col gap-1 text-sm">Valor mínimo em reais<input required disabled={bloqueado} className={campo} inputMode="decimal" value={minimo} onChange={e=>setMinimo(e.target.value)} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={arquivado} disabled={bloqueado} onChange={e=>setArquivado(e.target.checked)} />Arquivar este rascunho</label>
    <div className="flex gap-3"><button className={botao} disabled={bloqueado}>Salvar rascunho de cupom</button><button type="button" disabled={bloqueado} className={campo} onClick={cancelar}>Cancelar</button></div>
  </form>;
}
