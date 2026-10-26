import React from "react";
import { interpolate } from "remotion";
import { cor, Icone, NomeIcone } from "./app";
import { CLAMP, rampa, SAI_RAPIDO, SUAVE } from "./movimento";
import { Pose } from "./palco";

/*
 * Efeitos de acabamento: rastro de movimento, luz no vidro, bokeh, grão,
 * resposta dos toques e etiquetas dos destaques. Tudo derivado do quadro,
 * sem partículas soltas nem confete.
 */

/** Borrão proporcional à velocidade do celular entre dois quadros. */
export const borraoMovimento = (agora: Pose, antes: Pose) => {
  const v = Math.hypot(agora.cx - antes.cx, agora.cy - antes.cy) + Math.abs(agora.s - antes.s) * 900 + Math.abs(agora.ry - antes.ry) * 1.6;
  return Math.min(2.5, Math.max(0, (v - 10) * 0.14));
};

/**
 * Faixa de luz que atravessa o vidro (0→1). Usada a cada troca de tela,
 * para dar brilho de produto sem tirar a leitura.
 */
export const VarreduraLuz: React.FC<{ t: number }> = ({ t }) => {
  if (t <= 0 || t >= 1) return null;
  const x = interpolate(t, [0, 1], [-60, 160], { ...CLAMP, easing: SUAVE });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 75,
        pointerEvents: "none",
        background: `linear-gradient(105deg, rgba(255,255,255,0) ${x - 18}%, rgba(255,255,255,0.38) ${x}%, rgba(255,255,255,0) ${x + 14}%)`,
        mixBlendMode: "screen",
      }}
    />
  );
};

/** Momentos da varredura (quadros em que uma tela nova aparece). */
export const varreduraEm = (f: number, momentos: number[], dur = 22) => {
  for (const m of momentos) if (f >= m && f < m + dur) return (f - m) / dur;
  return 0;
};

/** Círculos de luz desfocados, com paralaxe oposta ao celular. */
export const Bokeh: React.FC<{ f: number; p: Pose }> = ({ f, p }) => {
  const giro = ((((p.ry + 180) % 360) + 360) % 360) - 180;
  const dx = -(p.cx - 540) * 0.25 - Math.max(-20, Math.min(20, giro)) * 4;
  const dy = -(p.cy - 1195) * 0.12;
  const bolas = [
    { x: 120, y: 520, r: 120, c: "rgba(154,214,248,0.35)", v: 0.6 },
    { x: 930, y: 760, r: 90, c: "rgba(234,220,251,0.55)", v: 1 },
    { x: 860, y: 1560, r: 150, c: "rgba(154,214,248,0.28)", v: 0.4 },
    { x: 180, y: 1700, r: 80, c: "rgba(253,224,230,0.6)", v: 0.8 },
    { x: 980, y: 300, r: 60, c: "rgba(255,255,255,0.8)", v: 1.2 },
  ];
  return (
    <>
      {bolas.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x - b.r + dx * b.v + Math.sin(f * 0.02 + i) * 14,
            top: b.y - b.r + dy * b.v + Math.cos(f * 0.017 + i * 2) * 18,
            width: b.r * 2,
            height: b.r * 2,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, ${b.c}, rgba(255,255,255,0))`,
          }}
        />
      ))}
    </>
  );
};

/** Feixe de luz diagonal e lento, atrás de tudo. */
export const Feixe: React.FC<{ f: number }> = ({ f }) => (
  <div
    style={{
      position: "absolute",
      left: -400 + Math.sin(f * 0.01) * 80,
      top: -200,
      width: 900,
      height: 2600,
      transform: "rotate(28deg)",
      background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))",
      opacity: 0.6,
    }}
  />
);

/** Grão fino de filme, estático, para tirar o aspecto "digital chapado". */
export const Grao: React.FC = () => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 0.05, mixBlendMode: "multiply", pointerEvents: "none" }}>
    <filter id="grao">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grao)" />
  </svg>
);

/**
 * Confirmação de toque: anel azul que abre e traços curtos que se afastam
 * do ponto (coordenadas lógicas da tela).
 */
export const Confirmacao: React.FC<{ f: number; em: number; x: number; y: number; c?: string }> = ({ f, em, x, y, c = cor.azul }) => {
  const t = f - em;
  if (t < 0 || t > 26) return null;
  const a = interpolate(t, [0, 22], [0, 1], { ...CLAMP, easing: SAI_RAPIDO });
  const some = interpolate(t, [10, 26], [1, 0], CLAMP);
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 82, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -40, top: -40, width: 80, height: 80, borderRadius: 80, border: `3px solid ${c}`, boxSizing: "border-box", opacity: some, transform: `scale(${0.6 + a * 1.5})` }} />
      <svg width={200} height={200} viewBox="-100 -100 200 200" style={{ position: "absolute", left: -100, top: -100, opacity: some }}>
        {Array.from({ length: 8 }).map((_, i) => {
          const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const r1 = 34 + a * 30;
          const r2 = r1 + 14 * (1 - a * 0.6);
          return <line key={i} x1={Math.cos(ang) * r1} y1={Math.sin(ang) * r1} x2={Math.cos(ang) * r2} y2={Math.sin(ang) * r2} stroke={i % 2 ? c : cor.texto} strokeWidth={3} strokeLinecap="round" />;
        })}
      </svg>
    </div>
  );
};

/** Halo que pulsa em volta do pin selecionado (coordenadas lógicas). */
export const Halo: React.FC<{ f: number; de: number; x: number; y: number; intensidade: number }> = ({ f, de, x, y, intensidade }) => {
  if (f < de || intensidade <= 0) return null;
  return (
    <>
      {[0, 22].map((d) => {
        const t = ((f - de + d) % 44) / 44;
        return (
          <div key={d} style={{ position: "absolute", left: x - 44, top: y - 44, width: 88, height: 88, borderRadius: 88, border: `2.5px solid ${cor.azul}`, boxSizing: "border-box", opacity: (1 - t) * intensidade, transform: `scale(${0.7 + t * 1.1})`, zIndex: 4 }} />
        );
      })}
    </>
  );
};

/** Etiqueta acima do card ampliado, como uma legenda do benefício. */
export const EtiquetaDestaque: React.FC<{ p: number; y: number; texto: string; icone: NomeIcone; fundo: string; c: string }> = ({ p, y, texto, icone, fundo, c }) => {
  if (p <= 0.02) return null;
  const e = rampa(p, 0.45, 1, SAI_RAPIDO);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: e, transform: `translateY(${(1 - e) * 24}px) scale(${0.9 + 0.1 * e})` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, height: 66, padding: "0 30px 0 12px", borderRadius: 999, background: fundo, boxShadow: "0 18px 36px -16px rgba(26,60,90,0.35)", border: `2px solid ${cor.branco}` }}>
        <div style={{ width: 46, height: 46, borderRadius: 23, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n={icone} t={24} c={c} e={2.4} />
        </div>
        <span style={{ fontSize: 30, fontWeight: 700, color: c, letterSpacing: -0.3 }}>{texto}</span>
      </div>
    </div>
  );
};

/** Brilho que passa por cima de um texto (background-clip). */
export const BrilhoTexto: React.FC<{ t: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ t, children, style }) => {
  const x = interpolate(t, [0, 1], [-40, 140], CLAMP);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      {children}
      {t > 0 && t < 1 ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            color: "transparent",
            backgroundImage: `linear-gradient(105deg, rgba(255,255,255,0) ${x - 14}%, rgba(255,255,255,0.95) ${x}%, rgba(255,255,255,0) ${x + 14}%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
          }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
};
