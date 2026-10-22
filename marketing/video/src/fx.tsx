import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { C, CLAMP } from "./theme";
import { Pata } from "./ui";

const CORES_FESTA = [C.azul, "#FFD66B", C.coral, "#8FE0B0", "#C9A8F5", C.laranja];

/** Explosão de confete a partir de (x, y), com gravidade e giro. */
export const Confete: React.FC<{ x: number; y: number; em: number; n?: number; forca?: number; seed?: string }> = ({ x, y, em, n = 70, forca = 1, seed = "c" }) => {
  const t = useCurrentFrame() - em;
  if (t < 0 || t > 90) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }).map((_, i) => {
        const ang = random(`${seed}a${i}`) * Math.PI * 2;
        const vel = (18 + random(`${seed}v${i}`) * 26) * forca;
        const vx = Math.cos(ang) * vel;
        const vy = Math.sin(ang) * vel - 14 * forca;
        const px = x + vx * t * 0.9;
        const py = y + vy * t * 0.9 + 0.9 * t * t;
        const giro = t * (8 + random(`${seed}g${i}`) * 16);
        const larg = 14 + random(`${seed}l${i}`) * 14;
        const op = interpolate(t, [60, 90], [1, 0], CLAMP);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: larg,
              height: larg * (random(`${seed}r${i}`) > 0.5 ? 0.45 : 1),
              borderRadius: random(`${seed}f${i}`) > 0.7 ? larg : 3,
              background: CORES_FESTA[i % CORES_FESTA.length],
              transform: `rotate(${giro}deg) rotateX(${giro * 1.3}deg)`,
              opacity: op,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Corações subindo e balançando a partir de (x, y). */
export const Coracoes: React.FC<{ x: number; y: number; em: number; n?: number; dur?: number; cor?: string; subida?: number }> = ({ x, y, em, n = 8, dur = 60, cor = C.coral, subida = 420 }) => {
  const f = useCurrentFrame() - em;
  if (f < 0) return null;
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const t = f - i * 5;
        if (t < 0 || t > dur) return null;
        const p = t / dur;
        const dx = (random(`h${i}`) - 0.5) * 260 + Math.sin(t * 0.15 + i) * 24;
        const s = interpolate(t, [0, 8], [0, 1], CLAMP) * (0.7 + random(`hs${i}`) * 0.8);
        return (
          <svg key={i} width={70} height={70} viewBox="0 0 24 24" style={{ position: "absolute", left: x + dx - 35, top: y - p * subida - 35, transform: `scale(${s}) rotate(${dx * 0.08}deg)`, opacity: 1 - p }}>
            <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill={cor} />
          </svg>
        );
      })}
    </>
  );
};

/** Estrelinha de quatro pontas que pisca. */
export const Brilho: React.FC<{ x: number; y: number; tam?: number; em?: number; cor?: string; seed?: number }> = ({ x, y, tam = 50, em = 0, cor = C.branco, seed = 0 }) => {
  const f = useCurrentFrame() - em;
  if (f < 0) return null;
  const s = Math.max(0, Math.sin(f * 0.12 + seed * 1.7)) * interpolate(f, [0, 10], [0, 1], CLAMP);
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" style={{ position: "absolute", left: x - tam / 2, top: y - tam / 2, transform: `scale(${s}) rotate(${f * 2}deg)` }}>
      <path d="M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0z" fill={cor} />
    </svg>
  );
};

/** Patinhas e bolhas flutuando devagar no fundo. */
export const FundoVivo: React.FC<{ cor: string; tom: string; patas?: string }> = ({ cor, tom, patas = "rgba(255,255,255,0.55)" }) => {
  const f = useCurrentFrame();
  const bolha = (i: number, x: number, y: number, r: number) => (
    <div
      key={`b${i}`}
      style={{
        position: "absolute",
        left: x + Math.sin(f * 0.02 + i) * 80 - r,
        top: y + Math.cos(f * 0.017 + i * 2) * 70 - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r * 2,
        background: tom,
        filter: "blur(40px)",
        opacity: 0.8,
      }}
    />
  );
  return (
    <AbsoluteFill style={{ background: cor, overflow: "hidden" }}>
      {bolha(0, 150, 300, 300)}
      {bolha(1, 950, 900, 360)}
      {bolha(2, 300, 1600, 320)}
      {Array.from({ length: 10 }).map((_, i) => {
        const vel = 0.8 + random(`p${i}`) * 1.4;
        const y = ((random(`py${i}`) * 2200 - f * vel * 2) % 2200 + 2200) % 2200 - 140;
        const x = random(`px${i}`) * 1080 + Math.sin(f * 0.03 + i) * 30;
        const t = 50 + random(`pt${i}`) * 70;
        return (
          <div key={i} style={{ position: "absolute", left: x, top: y, transform: `rotate(${Math.sin(f * 0.02 + i) * 25 + i * 30}deg)`, opacity: 0.5 }}>
            <Pata t={t} cor={patas} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** Linha de batimento cardíaco que corre na horizontal. */
export const Ecg: React.FC<{ y: number; cor: string; em?: number }> = ({ y, cor, em = 0 }) => {
  const f = useCurrentFrame() - em;
  const desenho = interpolate(f, [0, 30], [0, 1], CLAMP);
  const pulso = "M0 60 H260 l20 -10 l20 10 H360 l18 -55 l24 110 l18 -75 l12 20 H560 l20 -12 l20 12 H1080";
  const desloca = (f * 6) % 1080;
  return (
    <svg width={1080} height={120} style={{ position: "absolute", left: 0, top: y, overflow: "hidden" }}>
      <g transform={`translate(${-desloca} 0)`}>
        {[0, 1].map((k) => (
          <path key={k} d={pulso} transform={`translate(${k * 1080} 0)`} stroke={cor} strokeWidth="7" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={2400} strokeDashoffset={2400 * (1 - desenho)} opacity={0.85} />
        ))}
      </g>
    </svg>
  );
};

/** Ondas de radar saindo de um ponto. */
export const Radar: React.FC<{ x: number; y: number; cor: string; em?: number; tam?: number }> = ({ x, y, cor, em = 0, tam = 260 }) => {
  const f = useCurrentFrame() - em;
  if (f < 0) return null;
  return (
    <>
      {[0, 1, 2].map((k) => {
        const p = ((f + k * 20) % 60) / 60;
        return <div key={k} style={{ position: "absolute", left: x - tam / 2, top: y - tam / 2, width: tam, height: tam, borderRadius: tam, border: `5px solid ${cor}`, transform: `scale(${p})`, opacity: 1 - p }} />;
      })}
    </>
  );
};

/** Faixa de luz que atravessa um elemento (use dentro de um pai com overflow hidden). */
export const Reflexo: React.FC<{ em: number; a_cada?: number }> = ({ em, a_cada = 60 }) => {
  const f = useCurrentFrame() - em;
  if (f < 0) return null;
  const p = (f % a_cada) / 24;
  if (p > 1) return null;
  return <div style={{ position: "absolute", top: -20, bottom: -20, width: 120, left: `${-30 + p * 160}%`, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)", transform: "skewX(-20deg)" }} />;
};
