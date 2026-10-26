'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Pet = { nome: string; especie: string; foto?: string | null; telefone?: string | null; alergias?: string | null };
type Resultado = { valido?: boolean; limite?: boolean; pet?: Pet };
type Envio = 'parado' | 'localizando' | 'enviando' | 'enviado' | 'negado' | 'erro' | 'limite';

/** Enviar a localização ao tutor: só depois do toque e da permissão do navegador (BUSINESS.md 5.6). */
function EnviarLocalizacao({ codigo, nome }: { codigo: string; nome: string }) {
  const [estado, setEstado] = useState<Envio>('parado');
  const [mensagem, setMensagem] = useState('');
  function enviar() {
    if (!('geolocation' in navigator)) { setEstado('erro'); return; }
    setEstado('localizando');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setEstado('enviando');
        try {
          const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          if (!url || !chave) throw new Error('Configuração indisponível');
          const r = await fetch(`${url}/rest/v1/rpc/qr_enviar_localizacao`, {
            method: 'POST',
            headers: { apikey: chave, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_codigo: codigo, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude,
              p_precisao: Math.round(pos.coords.accuracy), p_mensagem: mensagem.trim() || null }),
            cache: 'no-store',
          });
          if (!r.ok) throw new Error('Falha de conexão');
          const dados = await r.json() as { enviado?: boolean; limite?: boolean };
          setEstado(dados.limite ? 'limite' : dados.enviado ? 'enviado' : 'erro');
        } catch { setEstado('erro'); }
      },
      (e) => setEstado(e.code === e.PERMISSION_DENIED ? 'negado' : 'erro'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  }
  if (estado === 'enviado') return <p role="status" className="my-6 rounded-2xl bg-emerald-50 p-5 font-bold">Localização enviada. O tutor de {nome} foi avisado. Obrigado por ajudar!</p>;
  const ocupado = estado === 'localizando' || estado === 'enviando';
  return <section className="my-6 rounded-2xl bg-sky-50 p-5">
    <h2 className="font-bold">Enviar onde {nome} está</h2>
    <p className="my-2 text-sm">Seu navegador vai pedir permissão. Só a posição deste momento e o recado vão para o tutor; seu telefone e seu nome não.</p>
    <label className="mt-3 block text-sm font-semibold" htmlFor="recado">Recado (opcional)</label>
    <textarea id="recado" maxLength={200} rows={2} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: está comigo na portaria" className="mt-1 w-full rounded-xl bg-white p-3" />
    <button type="button" disabled={ocupado} onClick={enviar} className="mt-3 rounded-full bg-black px-6 py-3 text-white disabled:opacity-60">{estado === 'localizando' ? 'Pegando a localização…' : estado === 'enviando' ? 'Enviando…' : 'Enviar minha localização'}</button>
    {estado === 'negado' ? <p role="alert" className="mt-3 text-sm">A localização foi bloqueada no navegador. Libere nas configurações ou use os contatos acima.</p> : null}
    {estado === 'erro' ? <p role="alert" className="mt-3 text-sm">Não deu para enviar agora. Tente de novo.</p> : null}
    {estado === 'limite' ? <p role="alert" className="mt-3 text-sm">Muitos envios seguidos. Aguarde um pouco.</p> : null}
  </section>;
}

export default function PetEncontrado() {
  const { codigo } = useParams<{ codigo: string }>();
  const [resposta, setResposta] = useState<{ codigo: string; dados: Resultado | null; falha: boolean } | null>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function carregar() {
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !chave) throw new Error('Configuração indisponível');
        const r = await fetch(`${url}/rest/v1/rpc/qr_pet_publico`, { method: 'POST', headers: { apikey: chave, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: codigo }), signal: abort.signal, cache: 'no-store' });
        if (!r.ok) throw new Error('Falha de conexão');
        const dados = await r.json() as Resultado;
        if (typeof dados.valido !== 'boolean' && !dados.limite) throw new Error('Resposta inválida');
        if (!abort.signal.aborted) setResposta({ codigo, dados, falha: false });
      } catch { if (!abort.signal.aborted) setResposta({ codigo, dados: null, falha: true }); }
    }
    void carregar();
    return () => abort.abort();
  }, [codigo, tentativa]);
  const atual = resposta?.codigo === codigo ? resposta : null;
  const pet = atual?.dados?.valido ? atual.dados.pet : null;
  // Só caracteres numéricos entram nos links de telefone; nunca HTML do servidor.
  const telefone = pet?.telefone?.replace(/\D/g, '') ?? '';
  const whatsapp = telefone.length === 10 || telefone.length === 11 ? `55${telefone}` : telefone;
  return <main className="mx-auto min-h-screen max-w-lg px-6 py-12">
    <p className="mb-6 font-bold">PetLive · Pet encontrado</p>
    {!atual ? <p role="status">Abrindo o QR…</p> : atual.falha ? <div role="alert"><h1 className="text-2xl font-bold">Não foi possível abrir agora</h1><p className="my-4">Confira sua conexão e tente novamente.</p><button className="rounded-full bg-black px-6 py-3 text-white" onClick={() => setTentativa((n) => n + 1)}>Tentar novamente</button></div> : atual.dados?.limite ? <p>Muitos acessos. Aguarde um pouco e tente novamente.</p> : !pet ? <><h1 className="text-2xl font-bold">QR indisponível</h1><p className="mt-4">Este QR está desativado ou não existe.</p></> : <>
      {pet.foto && /^https:\/\//i.test(pet.foto) ? /* eslint-disable-next-line @next/next/no-img-element */
        <img src={pet.foto} alt={`Foto de ${pet.nome}`} referrerPolicy="no-referrer" className="mb-6 aspect-square w-full rounded-3xl object-cover" /> : null}
      <h1 className="text-3xl font-bold">{pet.nome}</h1><p className="my-3">{pet.especie === 'gato' ? 'Gato' : 'Cão'}</p>
      {pet.alergias ? <section className="my-6 rounded-2xl bg-rose-50 p-5"><h2 className="font-bold">Alergias e condições</h2><p className="whitespace-pre-wrap">{pet.alergias}</p></section> : null}
      {telefone ? <div className="my-6 flex flex-wrap gap-4"><a className="rounded-full bg-black px-6 py-3 text-white" href={`tel:+${whatsapp}`}>Ligar para o tutor</a><a className="rounded-full bg-black px-6 py-3 text-white" href={`https://wa.me/${whatsapp}`} rel="noreferrer">WhatsApp do tutor</a></div> : <p className="my-6">O tutor não disponibilizou telefone neste QR.</p>}
      <EnviarLocalizacao codigo={codigo} nome={pet.nome} />
      <p className="text-sm">Somente os dados autorizados pelo tutor aparecem aqui. Aproxime-se com cuidado e não persiga o pet.</p>
    </>}
  </main>;
}
