import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { q, rampa, sp } from "./base";
import { FRASES } from "./roteiro";
import { C, CLAMP, EASE_IN_OUT, SEGURO } from "./theme";

/* ── Ícones (traço, estilo do app) ───────────────────────────────────────── */

const ICONES = {
  voltar: "M15 18l-6-6 6-6",
  seta: "M9 18l6-6-6-6",
  busca: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  telefone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  rota: "M3 11l18-8-8 18-2-8-8-2z",
  pino: "M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  relogio: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  escudo: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4",
  bandeira: "M5 21V4h12l-2 4 2 4H5",
  globo: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  sino: "M6 9a6 6 0 1 1 12 0c0 6 3 7 3 7H3s3-1 3-7M10 20a2 2 0 0 0 4 0",
  grafico: "M5 20V10M12 20V4M19 20v-7",
  coracao: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  compartilhar: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  chat: "M4 5h16v11H9l-5 4V5z",
  mais: "M12 5v14M5 12h14",
  check: "M5 12.5l4.5 4.5L19 7",
  imagem: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2",
  casa: "M4 11l8-7 8 7v9H4z",
  pessoa: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  calendario: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5",
  passeio: "M13 4a2 2 0 1 0 0 .1M10 21l2-6 3 3v3M9 12l2-4 4 1 2 4M7 21l3-6",
  diamante: "M12 4l7 8-7 8-7-8z",
} as const;

export type NomeIcone = keyof typeof ICONES;

export const Icone: React.FC<{ n: NomeIcone; t?: number; cor?: string; e?: number }> = ({ n, t = 20, cor = C.texto, e = 2 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={e} strokeLinecap="round" strokeLinejoin="round">
    <path d={ICONES[n]} />
  </svg>
);

/** A pata da marca (app/assets/icon.png), redesenhada em vetor. */
export const Pata: React.FC<{ t: number; cor?: string }> = ({ t, cor = C.branco }) => (
  <svg width={t} height={t} viewBox="0 0 100 100">
    <g fill={cor}>
      <ellipse cx="22" cy="44" rx="9" ry="11" />
      <ellipse cx="40" cy="26" rx="9.5" ry="11.5" />
      <ellipse cx="60" cy="26" rx="9.5" ry="11.5" />
      <ellipse cx="78" cy="44" rx="9" ry="11" />
      <path d="M50 46c13 0 26 15 26 26 0 9-7 13-14 12-5-.7-8-3-12-3s-7 2.3-12 3c-7 1-14-3-14-12 0-11 13-26 26-26z" />
    </g>
  </svg>
);

export const SeloMarca: React.FC<{ t: number; fundo?: string; cor?: string }> = ({ t, fundo = C.preto, cor = C.branco }) => (
  <div style={{ width: t, height: t, borderRadius: t, background: fundo, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Pata t={t * 0.56} cor={cor} />
  </div>
);

/** Logo pequena no canto, presente nas cenas de recurso. */
export const Topo: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = sp(f, fps, 4);
  return (
    <div style={{ position: "absolute", left: 64, top: SEGURO.topo - 60, display: "flex", alignItems: "center", gap: 16, opacity: e }}>
      <SeloMarca t={64} />
      <span style={{ fontSize: 40, fontWeight: 800, color: C.preto, letterSpacing: -1 }}>PetLive</span>
    </div>
  );
};

/** Pílula flutuante que entra com mola e balança de leve. */
export const Pilula: React.FC<{ x: number; y: number; em: number; fundo: string; cor: string; tam?: number; seed?: number; children: React.ReactNode }> = ({ x, y, em, fundo, cor, tam = 46, seed = 0, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = sp(f, fps, em, { damping: 11, stiffness: 170 });
  const bal = Math.sin((f + seed * 30) * 0.06) * 6;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(-50%, -50%) translateY(${bal}px) scale(${e}) rotate(${(1 - e) * -25 + Math.sin((f + seed * 20) * 0.05) * 2}deg)`,
        opacity: Math.min(1, e * 1.6),
        background: fundo,
        color: cor,
        fontSize: tam,
        fontWeight: 800,
        letterSpacing: -1,
        padding: `${tam * 0.36}px ${tam * 0.7}px`,
        borderRadius: 999,
        whiteSpace: "nowrap",
        boxShadow: "0 18px 40px rgba(42,33,28,0.18)",
        display: "flex",
        alignItems: "center",
        gap: tam * 0.3,
      }}
    >
      {children}
    </div>
  );
};

/* ── Celular ─────────────────────────────────────────────────────────────── */

/** Tela lógica de 390×844 (iPhone), escalada para a largura pedida. */
export const LARGURA_TELA = 390;
export const ALTURA_TELA = 844;

/** `semMoldura`: só a tela, como um cartão flutuante (sem o corpo preto). */
export const Celular: React.FC<{ largura: number; semMoldura?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ largura, semMoldura = false, children, style }) => {
  const borda = semMoldura ? 0 : largura * 0.032;
  const interna = largura - borda * 2;
  const s = interna / LARGURA_TELA;
  return (
    <div
      style={{
        position: "absolute",
        width: largura,
        height: ALTURA_TELA * s + borda * 2,
        borderRadius: semMoldura ? largura * 0.08 : largura * 0.15,
        background: C.preto,
        overflow: semMoldura ? "hidden" : undefined,
        padding: borda,
        boxShadow: "0 60px 120px rgba(42,33,28,0.28), 0 10px 30px rgba(42,33,28,0.18)",
        ...style,
      }}
    >
      <div style={{ width: interna, height: ALTURA_TELA * s, borderRadius: semMoldura ? 0 : largura * 0.12, overflow: "hidden", position: "relative", background: C.branco }}>
        <div style={{ width: LARGURA_TELA, height: ALTURA_TELA, transform: `scale(${s})`, transformOrigin: "0 0", position: "relative" }}>{children}</div>
      </div>
    </div>
  );
};

/** Toque de dedo: círculo que encolhe e solta uma onda (coordenadas da tela lógica). */
export const Toque: React.FC<{ x: number; y: number; em: number }> = ({ x, y, em }) => {
  const f = useCurrentFrame() - em;
  if (f < -8 || f > 22) return null;
  const chega = interpolate(f, [-8, 0], [0, 1], CLAMP);
  const onda = interpolate(f, [0, 18], [0, 1], CLAMP);
  return (
    <>
      <div style={{ position: "absolute", left: x - 26, top: y - 26, width: 52, height: 52, borderRadius: 52, background: "rgba(17,17,17,0.35)", opacity: chega * (1 - onda), transform: `scale(${1 - 0.2 * Math.min(1, Math.max(0, f) / 4)})` }} />
      <div style={{ position: "absolute", left: x - 26, top: y - 26, width: 52, height: 52, borderRadius: 52, border: "3px solid rgba(17,17,17,0.5)", opacity: (1 - onda) * (f >= 0 ? 1 : 0), transform: `scale(${1 + onda * 1.6})` }} />
    </>
  );
};

/* ── Câmera simples ──────────────────────────────────────────────────────── */

export type Quadro = { f: number; s: number; x: number; y: number };

/** Zoom e pan entre quadros-chave. Origem no centro do vídeo. */
export const Camera: React.FC<{ quadros: Quadro[]; children: React.ReactNode }> = ({ quadros, children }) => {
  const f = useCurrentFrame();
  const fs = quadros.map((k) => k.f);
  const v = (k: "s" | "x" | "y") => (quadros.length === 1 ? quadros[0][k] : interpolate(f, fs, quadros.map((p) => p[k]), { ...CLAMP, easing: EASE_IN_OUT }));
  return <AbsoluteFill style={{ transform: `translate(${v("x")}px, ${v("y")}px) scale(${v("s")})` }}>{children}</AbsoluteFill>;
};

/* ── Cena ────────────────────────────────────────────────────────────────── */

export type Entrada = "corte" | "zoom" | "lado" | "sobe" | "circulo";
export const TRANSICAO = 14;

/**
 * Entrada da cena. A cena seguinte entra por cima desta. "circulo" abre a
 * partir de (cx, cy), como uma íris; "lado" vem com desfoque de movimento.
 */
export const Cena: React.FC<{ entrada?: Entrada; cx?: number; cy?: number; children: React.ReactNode }> = ({ entrada = "corte", cx = 540, cy = 960, children }) => {
  const f = useCurrentFrame();
  const p = rampa(f, 0, TRANSICAO);
  const pico = Math.sin(p * Math.PI);
  let style: React.CSSProperties = {};
  if (entrada === "zoom") style = { opacity: Math.min(1, p * 1.8), transform: `scale(${1.35 - 0.35 * p}) rotate(${(1 - p) * -4}deg)`, filter: `blur(${(1 - p) * 20}px)` };
  if (entrada === "lado") style = { transform: `translateX(${(1 - p) * 100}%) skewX(${-pico * 10}deg)`, filter: `blur(${pico * 14}px)` };
  if (entrada === "sobe") style = { transform: `translateY(${(1 - p) * 100}%) scale(${0.9 + 0.1 * p})`, borderRadius: (1 - p) * 120 };
  if (entrada === "circulo") style = { clipPath: `circle(${p * 2300}px at ${cx}px ${cy}px)` };
  return <AbsoluteFill style={{ overflow: "hidden", ...style }}>{children}</AbsoluteFill>;
};

/* ── Tipografia cinética ─────────────────────────────────────────────────── */

/** Palavra que salta do chão, gira um pouco e assenta com mola. */
const Palavra: React.FC<{ em: number; cor: string; children: React.ReactNode; marca?: string }> = ({ em, cor, children, marca }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = sp(f, fps, em, { damping: 9, stiffness: 190, mass: 0.7 });
  const risco = sp(f, fps, em + 8, { damping: 20, stiffness: 90 });
  return (
    <span style={{ display: "inline-block", position: "relative", color: cor, transform: `translateY(${(1 - e) * 90}px) scale(${0.4 + 0.6 * e}) rotate(${(1 - e) * -14}deg)`, opacity: Math.min(1, e * 2), margin: "0 0.15em" }}>
      {marca ? <span style={{ position: "absolute", left: "-4%", right: `${104 - risco * 108}%`, bottom: "8%", height: "34%", background: marca, borderRadius: 12, zIndex: -1 }} /> : null}
      {children}
    </span>
  );
};

/** Título em uma ou duas linhas, palavra por palavra. A 2ª linha ganha marca-texto. */
export const Titulo: React.FC<{ l1: string; l2?: string; cor: string; marca?: string; top?: number; tam?: number; em?: number }> = ({ l1, l2, cor, marca, top = 200, tam = 104, em = 0 }) => {
  const f = useCurrentFrame();
  const flutua = Math.sin(f * 0.06) * 6;
  const p1 = l1.split(" ");
  const p2 = l2 ? l2.split(" ") : [];
  return (
    <div style={{ position: "absolute", left: 30, right: 30, top: top + flutua, textAlign: "center", fontSize: tam, fontWeight: 800, letterSpacing: -tam * 0.04, lineHeight: 1.06, isolation: "isolate" }}>
      <div>
        {p1.map((p, i) => (
          <Palavra key={i} em={em + i * 3} cor={C.preto}>{p}</Palavra>
        ))}
      </div>
      {p2.length ? (
        <div>
          {p2.map((p, i) => (
            <Palavra key={i} em={em + (p1.length + i) * 3 + 2} cor={cor} marca={marca}>{p}</Palavra>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Frases de apoio (roteiro.ts › FRASES): cada palavra entra com mola, as de
 * destaque ganham cor e um pulo extra. Fica acima da zona do rodapé do Reels.
 */
export const Frases: React.FC<{ corDestaque: (s: number) => string }> = ({ corDestaque }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const atual = FRASES.find((l) => t >= l.de && t < l.ate);
  if (!atual) return null;
  const ini = q(atual.de);
  const fim = q(atual.ate);
  const caixa = sp(f, fps, ini, { damping: 12, stiffness: 200 });
  const sai = rampa(f, fim - 6, fim);
  const palavras = atual.texto.split(" ");
  const cor = corDestaque(t);
  return (
    <div style={{ position: "absolute", left: 50, right: 1080 - SEGURO.direita + 10, top: 1390, display: "flex", justifyContent: "center", transform: `translateY(${sai * 60}px) scale(${1 - sai * 0.2})`, opacity: 1 - sai }}>
      <div
        style={{
          background: C.preto,
          color: C.branco,
          fontSize: 62,
          fontWeight: 800,
          letterSpacing: -1.4,
          lineHeight: 1.18,
          textAlign: "center",
          padding: "24px 40px 28px",
          borderRadius: 40,
          transform: `scale(${caixa}) rotate(${(1 - caixa) * 4 + Math.sin(f * 0.08) * 0.8}deg)`,
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        {palavras.map((p, i) => {
          const em = ini + i * 3;
          const e = sp(f, fps, em, { damping: 8, stiffness: 220, mass: 0.6 });
          const destaque = atual.destaque?.includes(p);
          const pulo = destaque ? Math.max(0, Math.sin((f - em - 10) * 0.25)) * 8 * interpolate(f, [em + 10, em + 22], [1, 0], CLAMP) : 0;
          return (
            <span key={i} style={{ display: "inline-block", color: destaque ? cor : C.branco, transform: `translateY(${(1 - e) * 40 - pulo}px) scale(${e})`, opacity: Math.min(1, e * 2), margin: "0 0.2em" }}>
              {p}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ── Celular em 3D ───────────────────────────────────────────────────────── */

/**
 * Celular que gira em 3D e flutua. A entrada vem de baixo girando;
 * `giro` dá o balanço contínuo em graus.
 */
export const Celular3D: React.FC<{ largura: number; left: number; top: number; em?: number; giro?: number; semMoldura?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ largura, left, top, em = 2, giro = 8, semMoldura, children, style }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = sp(f, fps, em, { damping: 13, stiffness: 90 });
  const ry = (1 - e) * -50 + Math.sin(f * 0.04) * giro;
  const rx = (1 - e) * 30 + Math.cos(f * 0.05) * giro * 0.4;
  const bob = Math.sin(f * 0.07) * 12;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2400 }}>
      <Celular
        largura={largura}
        semMoldura={semMoldura}
        style={{ left, top, transform: `translateY(${(1 - e) * 900 + bob}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${(1 - e) * 12}deg)`, ...style }}
      >
        {children}
      </Celular>
    </div>
  );
};
