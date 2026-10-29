"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Etapa = { id: string; titulo: string; texto: string; foto: string; alt: string; fragmento: ReactNode };

function Notificacao() {
  return (
    <div data-ui className="w-[min(340px,100%)] rounded-[var(--raio)] bg-[var(--papel)] p-4 shadow-[0_18px_40px_rgba(17,17,17,0.22)]">
      <div className="flex items-center gap-3">
        <Image src="/logo-petlive.png" alt="" width={36} height={36} />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold">Hora do remédio da Mia</p>
          <p className="t-pequeno text-[var(--apagado)]">Vermífugo · 1 comprimido</p>
        </div>
        <span className="t-pequeno text-[var(--apagado)]">08:00</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[16px] font-bold">
        <span className="flex min-h-11 items-center justify-center rounded-full bg-[var(--tinta)] text-[var(--papel)]">Feito</span>
        <span className="flex min-h-11 items-center justify-center rounded-full bg-[var(--tom)]">Adiar</span>
      </div>
    </div>
  );
}

function ResumoPasseio() {
  return (
    <div data-ui className="w-[min(340px,100%)] rounded-[var(--raio)] bg-[var(--papel)] p-4 shadow-[0_18px_40px_rgba(17,17,17,0.22)]">
      <p className="text-[16px] font-bold">Passeio do Rex</p>
      <p className="t-pequeno text-[var(--apagado)]">Hoje, 18:30</p>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[var(--raio-p)] bg-[var(--tom)] p-3">
          <dt className="t-pequeno text-[var(--apagado)]">Distância</dt>
          <dd className="text-[22px] font-bold tabular-nums">2,4 km</dd>
        </div>
        <div className="rounded-[var(--raio-p)] bg-[var(--tom)] p-3">
          <dt className="t-pequeno text-[var(--apagado)]">Tempo</dt>
          <dd className="text-[22px] font-bold tabular-nums">38 min</dd>
        </div>
      </dl>
    </div>
  );
}

function ListaHoje() {
  const itens = [
    { hora: "20:00", nome: "Antibiótico do Rex", feito: true },
    { hora: "21:00", nome: "Escovar os dentes", feito: false },
  ];
  return (
    <div data-ui className="w-[min(340px,100%)] rounded-[var(--raio)] bg-[var(--papel)] p-4 shadow-[0_18px_40px_rgba(17,17,17,0.22)]">
      <p className="text-[16px] font-bold">Hoje</p>
      <ul className="mt-2">
        {itens.map((i) => (
          <li key={i.hora} className={"flex min-h-12 items-center gap-3 border-t border-[#E6EAF0] text-[16px]" /* taste-skill-ignore: lista dentro do fragmento data-ui */}>
            <span className="w-12 tabular-nums text-[var(--apagado)]">{i.hora}</span>
            <span className="flex-1">{i.nome}</span>
            {i.feito ? (
              <span className="font-semibold text-[#1A5577]">Dado</span>
            ) : (
              <span className="rounded-full bg-[var(--tinta)] px-3 py-1.5 text-[14px] font-bold text-[var(--papel)]">Feito</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ETAPAS: Etapa[] = [
  {
    id: "manha",
    titulo: "De manhã, a primeira dose",
    texto: "O celular avisa a hora do remédio. Você marca Feito na própria notificação, sem abrir o app, e a dose fica registrada.",
    foto: "/fotos/gato-janela.jpg",
    alt: "Gatinho laranja sentado junto à janela, na luz da manhã",
    fragmento: <Notificacao />,
  },
  {
    id: "tarde",
    titulo: "À tarde, o passeio",
    texto: "Grave o passeio pelo app e veja depois o trajeto, a distância e o tempo. Clínicas e petshops do caminho estão no mapa.",
    foto: "/fotos/passeio.jpg",
    alt: "Dois cães de coleira parados numa calçada",
    fragmento: <ResumoPasseio />,
  },
  {
    id: "noite",
    titulo: "À noite, nada esquecido",
    texto: "O que ainda falta hoje aparece no Início, com Feito ao lado. A escova de dentes das 21:00 não passa batida.",
    foto: "/fotos/noite.jpg",
    alt: "Tutora deitada no sofá abraçada ao seu cão",
    fragmento: <ListaHoje />,
  },
];

/**
 * Um dia com o PetLive: a foto e o pedaço do app ficam presos à esquerda
 * enquanto as três etapas passam à direita (no celular, cada etapa traz
 * a sua foto).
 */
export function HistoriaDia() {
  const [ativa, setAtiva] = useState(0);
  const etapas = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) setAtiva(Number((e.target as HTMLElement).dataset.indice));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    etapas.current.forEach((el) => el && observador.observe(el));
    return () => observador.disconnect();
  }, []);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="relative hidden lg:block">
        <div className="sticky top-[88px] h-[calc(100svh-120px)] overflow-hidden rounded-[var(--raio-g)] bg-[var(--tom)]">
          {ETAPAS.map((e, i) => (
            <div
              key={e.id}
              className="absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none"
              style={{ opacity: ativa === i ? 1 : 0 }}
              aria-hidden={ativa !== i}
            >
              <Image src={e.foto} alt={e.alt} fill sizes="50vw" className="object-cover" />
              <div className="absolute bottom-6 left-6 right-6">{e.fragmento}</div>
            </div>
          ))}
        </div>
      </div>

      <ol className="list-none">
        {ETAPAS.map((e, i) => (
          <li
            key={e.id}
            ref={(el) => {
              etapas.current[i] = el;
            }}
            data-indice={i}
            className="flex flex-col justify-center gap-6 py-10 lg:min-h-[86svh] lg:py-0"
          >
            <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--raio-g)] bg-[var(--tom)] lg:hidden">
              <Image src={e.foto} alt={e.alt} fill sizes="100vw" className="object-cover" />
              <div className="absolute bottom-3 left-3 right-3">{e.fragmento}</div>
            </div>
            <h3 data-revelar className="t-titulo max-w-[14ch]">
              {e.titulo}
            </h3>
            <p data-revelar style={{ ["--ordem" as string]: 1 }} className="t-lead max-w-[36ch]">
              {e.texto}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
