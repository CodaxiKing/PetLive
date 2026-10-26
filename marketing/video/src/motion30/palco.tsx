import React from "react";
import { AbsoluteFill, interpolate, interpolateColors } from "remotion";
import { cor, MarcaPata, SeloMarca } from "./app";
import { chaves, CLAMP, lerp, SAI_RAPIDO, SUAVE } from "./movimento";
import { BATIDAS, CENAS } from "./roteiro";

/* ── Câmera: onde o celular está em cada quadro ──────────────────────────── */

/** Largura do celular na escala 1 e as medidas que dependem dela. */
export const LARGURA = 600;
export const BORDA = LARGURA * 0.028;
export const K = (LARGURA - BORDA * 2) / 390;
export const ALTURA = 844 * K + BORDA * 2;

export type Pose = { cx: number; cy: number; s: number; ry: number; rx: number; rz: number };

type Chave = { f: number; e?: "volta" } & Omit<Pose, "rz"> & { rz?: number };

/**
 * Quadros-chave do celular (centro, escala e giro em graus). Chega girando,
 * fica quase frontal nos momentos de leitura e dá uma volta lenta de 360°
 * no fechamento, mostrando o verso.
 */
const POSES: Chave[] = [
  // Chegada: sobe do rodapé girando forte e assenta passando um pouco do ponto.
  { f: 0, cx: 540, cy: 1520, s: 0.8, ry: -52, rx: 26, rz: -12 },
  { f: 32, cx: 540, cy: 1205, s: 1, ry: -4, rx: 4, rz: 0, e: "volta" },
  { f: 66, cx: 540, cy: 1195, s: 1, ry: 7, rx: 2 },
  { f: 92, cx: 540, cy: 1195, s: 1, ry: -4, rx: 2 },
  // Marca: inclina e mergulha no herói do Início (nome e foto do pet).
  { f: 104, cx: 555, cy: 1215, s: 1.04, ry: 12, rx: 2, rz: 2 },
  { f: 128, cx: 540, cy: 1340, s: 1.32, ry: 0, rx: 0, e: "volta" },
  { f: 176, cx: 540, cy: 1330, s: 1.32, ry: 0, rx: 0 },
  // Saúde: recua com um giro rápido e volta para o toque.
  { f: 186, cx: 520, cy: 1240, s: 1.06, ry: -20, rx: 3, rz: -3 },
  { f: 200, cx: 540, cy: 1195, s: 1, ry: 0, rx: 1, e: "volta" },
  { f: BATIDAS.vacinasSai, cx: 540, cy: 1195, s: 1, ry: 0, rx: 0 },
  { f: BATIDAS.vacinasSai + 14, cx: 540, cy: 1230, s: 0.94, ry: 0, rx: 0, e: "volta" },
  { f: BATIDAS.vacinasVolta, cx: 540, cy: 1230, s: 0.94, ry: 0, rx: 0 },
  { f: BATIDAS.vacinasVolta + 14, cx: 540, cy: 1195, s: 1, ry: 5, rx: 1, e: "volta" },
  // Passagem rápida para a rotina (com rastro de movimento).
  { f: CENAS.rotina - 2, cx: 540, cy: 1195, s: 1, ry: 5, rx: 1 },
  { f: CENAS.rotina + 8, cx: 495, cy: 1225, s: 0.92, ry: -26, rx: 4, rz: -4 },
  // Rotina: aproxima no aviso do topo, volta para o toque na dose.
  { f: BATIDAS.avisoEntra, cx: 540, cy: 1300, s: 1.18, ry: 0, rx: 0, e: "volta" },
  { f: BATIDAS.avisoSai, cx: 540, cy: 1300, s: 1.18, ry: 0, rx: 0 },
  { f: BATIDAS.toqueDose - 6, cx: 540, cy: 1195, s: 1, ry: 0, rx: 0, e: "volta" },
  { f: BATIDAS.doseSai, cx: 540, cy: 1195, s: 1, ry: 0, rx: 0 },
  { f: BATIDAS.doseSai + 14, cx: 540, cy: 1230, s: 0.94, ry: 0, rx: 0, e: "volta" },
  { f: BATIDAS.doseVolta, cx: 540, cy: 1230, s: 0.94, ry: 0, rx: 0 },
  { f: BATIDAS.doseVolta + 14, cx: 540, cy: 1195, s: 1, ry: -5, rx: 1, e: "volta" },
  // Lugares: giro rápido para o outro lado.
  { f: BATIDAS.abreMapa + 4, cx: 585, cy: 1225, s: 0.92, ry: 26, rx: 4, rz: 4 },
  { f: BATIDAS.abreMapa + 18, cx: 540, cy: 1195, s: 1, ry: 0, rx: 1, e: "volta" },
  { f: BATIDAS.toquePino - 6, cx: 540, cy: 1195, s: 1, ry: 0, rx: 0 },
  { f: BATIDAS.cardSai, cx: 540, cy: 1195, s: 1, ry: 0, rx: 0 },
  { f: BATIDAS.cardSai + 14, cx: 540, cy: 1230, s: 0.94, ry: 0, rx: 0, e: "volta" },
  { f: BATIDAS.cardVolta, cx: 540, cy: 1230, s: 0.94, ry: 0, rx: 0 },
  // Fechamento: recua e dá uma volta de 360° mostrando o verso, com um
  // pequeno passar do ponto antes de assentar.
  { f: CENAS.fechamento - 2, cx: 540, cy: 1270, s: 0.84, ry: -6, rx: 3 },
  { f: CENAS.fechamento + 50, cx: 540, cy: 1345, s: 0.74, ry: 366, rx: 6 },
  { f: CENAS.fechamento + 68, cx: 540, cy: 1340, s: 0.74, ry: 354, rx: 4, e: "volta" },
  { f: 900, cx: 540, cy: 1335, s: 0.74, ry: 358, rx: 3 },
];

export const pose = (f: number): Pose => {
  const v = (k: keyof Pose) => chaves(f, POSES.map((p) => ({ f: p.f, v: p[k] ?? 0, e: p.e })));
  // Balanço lento e contínuo; some nos momentos de leitura (destaques).
  const calma = 1 - Math.max(...DESTAQUES.map((d) => (f >= d.de - 6 && f <= d.ate + 22 ? 1 : 0)));
  return {
    cx: v("cx"),
    cy: v("cy") + Math.sin(f * 0.06) * 9 * calma,
    s: v("s"),
    ry: v("ry") + Math.sin(f * 0.05) * 4.5 * calma,
    rx: v("rx") + Math.cos(f * 0.04) * 1.8 * calma,
    rz: v("rz") + Math.sin(f * 0.035 + 1) * 0.9 * calma,
  };
};

/** Janelas em que um card sai do celular (para acalmar a flutuação). */
const DESTAQUES = [
  { de: 124, ate: 166 },
  { de: BATIDAS.vacinasSai, ate: BATIDAS.vacinasVolta },
  { de: BATIDAS.doseSai, ate: BATIDAS.doseVolta },
  { de: BATIDAS.cardSai, ate: BATIDAS.cardVolta },
];

/** Ponto da tela lógica (390×844) → ponto do vídeo, na pose atual (sem giro). */
export const naTela = (p: Pose, x: number, y: number) => ({
  x: p.cx + p.s * (-LARGURA / 2 + BORDA + x * K),
  y: p.cy + p.s * (-ALTURA / 2 + BORDA + y * K),
  escala: p.s * K,
});

/** Ângulo em -180..180, para luz e sombra. */
const angulo = (g: number) => ((((g + 180) % 360) + 360) % 360) - 180;

/* ── Celular ─────────────────────────────────────────────────────────────── */

/** Espessura do aparelho (px na escala 1), feita de fatias em profundidade. */
const ESPESSURA = 24;
const FATIAS = 12;

/**
 * Smartphone 3D: frente com aro metálico, ilha e reflexo; laterais sólidas
 * e verso azul céu com a marca. A luz do aro, do vidro e do verso
 * acompanha o giro.
 */
export const Celular: React.FC<{ p: Pose; children: React.ReactNode }> = ({ p, children }) => {
  const raio = LARGURA * 0.155;
  const ang = angulo(p.ry);
  const brilho = interpolate(ang, [-40, 40], [-45, 45], CLAMP);
  const lado = Math.abs(Math.sin((ang * Math.PI) / 180));
  const verso = Math.abs(ang) > 90;
  const botao = (l: "esq" | "dir", top: number, h: number): React.CSSProperties => ({
    position: "absolute",
    [l === "esq" ? "left" : "right"]: -5,
    top,
    width: 8,
    height: h,
    borderRadius: 4,
    background: "linear-gradient(90deg, #3A3D42, #9AA0A7 50%, #3A3D42)",
    transform: `translateZ(${-ESPESSURA / 2}px)`,
  });
  const face: React.CSSProperties = { position: "absolute", inset: 0, borderRadius: raio, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" };
  return (
    <div
      style={{
        position: "absolute",
        left: p.cx - LARGURA / 2,
        top: p.cy - ALTURA / 2,
        width: LARGURA,
        height: ALTURA,
        transform: `perspective(2300px) scale(${p.s}) rotateZ(${p.rz}deg) rotateX(${p.rx}deg) rotateY(${p.ry}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* Laterais: fatias do aro em profundidade, com luz que muda com o giro */}
      {Array.from({ length: FATIAS }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: raio,
            transform: `translateZ(${-((i + 0.5) * ESPESSURA) / FATIAS}px)`,
            background: `linear-gradient(${90 + ang * 0.8}deg, #8D9299, #3B3E43 ${30 + lado * 20}%, #676B71 60%, #2B2E32 85%, #A2A7AE)`,
          }}
        />
      ))}
      <div style={botao("esq", ALTURA * 0.17, 46)} />
      <div style={botao("esq", ALTURA * 0.24, 86)} />
      <div style={botao("esq", ALTURA * 0.32, 86)} />
      <div style={botao("dir", ALTURA * 0.26, 130)} />

      {/* Verso */}
      <div style={{ ...face, transform: `translateZ(${-ESPESSURA}px) rotateY(180deg)`, overflow: "hidden", background: "linear-gradient(160deg, #BFE6FB 0%, #9AD6F8 45%, #7FC4EE 100%)", border: "3px solid #8E949B", boxSizing: "border-box" }}>
        {/* Módulo de câmera */}
        <div style={{ position: "absolute", left: 34, top: 34, width: 210, height: 210, borderRadius: 60, background: "rgba(255,255,255,0.35)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.6), 0 10px 20px rgba(26,85,119,0.25)" }}>
          {[
            [22, 22],
            [22, 116],
            [116, 70],
          ].map(([x, y]) => (
            <div key={`${x}-${y}`} style={{ position: "absolute", left: x, top: y, width: 74, height: 74, borderRadius: 74, background: "radial-gradient(circle at 40% 35%, #4A5A6A, #0E1216 60%)", boxShadow: "0 0 0 6px #2C3238" }} />
          ))}
          <div style={{ position: "absolute", left: 150, top: 26, width: 26, height: 26, borderRadius: 26, background: "#FFF6DA" }} />
        </div>
        {/* Marca */}
        <div style={{ position: "absolute", left: 0, right: 0, top: ALTURA * 0.46, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <SeloMarca t={170} />
          <span style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2.4, color: cor.texto }}>PetLive</span>
        </div>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${120 - ang * 0.6}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.45) 48%, rgba(255,255,255,0) 62%)` }} />
      </div>

      {/* Frente */}
      <div
        style={{
          ...face,
          padding: 3,
          boxSizing: "border-box",
          background: `linear-gradient(${145 + ang}deg, #B4B9C0 0%, #3F4247 22%, #7A7E84 50%, #2E3135 78%, #B8BDC4 100%)`,
          boxShadow: verso ? undefined : "0 60px 110px -30px rgba(26,85,119,0.45), 0 30px 50px -28px rgba(17,17,17,0.55)",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: raio - 3, background: "#0B0B0C", padding: BORDA - 3, boxSizing: "border-box" }}>
          <div style={{ position: "relative", width: 390 * K, height: 844 * K, borderRadius: raio - BORDA, overflow: "hidden", background: cor.branco }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: 844, transform: `scale(${K})`, transformOrigin: "0 0" }}>
              {children}
              {/* Ilha */}
              <div style={{ position: "absolute", left: 135, top: 11, width: 120, height: 35, borderRadius: 18, background: "#050505", zIndex: 60 }} />
            </div>
            {/* Reflexo do vidro, que corre com o giro */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(115deg, rgba(255,255,255,0) ${38 + brilho}%, rgba(255,255,255,${0.13 + lado * 0.25}) ${46 + brilho}%, rgba(255,255,255,0) ${58 + brilho}%)`,
                pointerEvents: "none",
                zIndex: 70,
              }}
            />
            {/* O vidro escurece de leve quando o aparelho vira de lado */}
            {lado > 0.05 ? <div style={{ position: "absolute", inset: 0, background: `rgba(10,20,30,${lado * 0.28})`, zIndex: 71 }} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Sombra de contato no "chão"; estreita quando o aparelho fica de lado. */
export const SombraChao: React.FC<{ p: Pose }> = ({ p }) => {
  const base = p.cy + (ALTURA / 2) * p.s;
  const largura = 0.35 + 0.65 * Math.abs(Math.cos((p.ry * Math.PI) / 180));
  const w = LARGURA * p.s * 1.05 * largura;
  return (
    <div
      style={{
        position: "absolute",
        left: p.cx - w / 2 + angulo(p.ry) * 2,
        top: base - 30,
        width: w,
        height: 90,
        borderRadius: "50%",
        background: "radial-gradient(closest-side, rgba(26,60,90,0.28), rgba(26,60,90,0))",
      }}
    />
  );
};

/* ── Fundo ───────────────────────────────────────────────────────────────── */

/** Cor de destaque do fundo por cena (famílias de cor do app). */
const TONS: { f: number; a: string; b: string }[] = [
  { f: 0, a: "#BFE6FB", b: "#E7DDFB" },
  { f: CENAS.saude - 10, a: "#BFE6FB", b: "#E7DDFB" },
  { f: CENAS.saude + 20, a: "#F9CFDA", b: "#CFE9FA" },
  { f: CENAS.rotina - 10, a: "#F9CFDA", b: "#CFE9FA" },
  { f: CENAS.rotina + 20, a: "#E3D3FA", b: "#FFE9B8" },
  { f: CENAS.lugares - 10, a: "#E3D3FA", b: "#FFE9B8" },
  { f: CENAS.lugares + 20, a: "#BFE6FB", b: "#CDEFD9" },
  { f: CENAS.fechamento - 10, a: "#BFE6FB", b: "#CDEFD9" },
  { f: CENAS.fechamento + 30, a: "#A9DDF8", b: "#E7DDFB" },
];

export const Fundo: React.FC<{ f: number }> = ({ f }) => {
  const fs = TONS.map((t) => t.f);
  const a = interpolateColors(f, fs, TONS.map((t) => t.a));
  const b = interpolateColors(f, fs, TONS.map((t) => t.b));
  const deriva = Math.sin(f * 0.012);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #F2F8FC 0%, #FAFBFD 55%, #F3F6F9 100%)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 420 + deriva * 40, top: -380, width: 1100, height: 1100, borderRadius: "50%", background: `radial-gradient(closest-side, ${a}, rgba(255,255,255,0))` }} />
      <div style={{ position: "absolute", left: -520 - deriva * 30, top: 820, width: 1200, height: 1200, borderRadius: "50%", background: `radial-gradient(closest-side, ${b}, rgba(255,255,255,0))` }} />
      <MarcaPata t={640} c="rgba(255,255,255,0.85)" e={0.55} style={{ position: "absolute", left: 560, top: 1240, transform: `rotate(${-14 + deriva * 4}deg)` }} />
    </AbsoluteFill>
  );
};

/* ── Destaque: um card sai do celular, cresce e volta ────────────────────── */

/**
 * `p` 0→1 leva o card da posição na tela (`x`, `y` lógicos) até o alvo no
 * vídeo (`alvoY`, centralizado, escala `alvoS`). Em 0 ele coincide com o
 * original (que fica escondido enquanto o card está fora).
 */
export const Destaque: React.FC<{ pose: Pose; p: number; x: number; y: number; w: number; alvoY: number; alvoS: number; children: React.ReactNode }> = ({ pose: ps, p, x, y, w, alvoY, alvoS, children }) => {
  if (p <= 0) return null;
  const o = naTela(ps, x, y);
  const alvoX = 540 - (w * alvoS) / 2;
  const s = lerp(o.escala, alvoS, p);
  const sombra = interpolate(p, [0, 1], [0, 1], CLAMP);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformOrigin: "0 0",
        transform: `translate(${lerp(o.x, alvoX, p)}px, ${lerp(o.y, alvoY, p)}px) scale(${s})`,
        filter: `drop-shadow(0 ${24 * sombra}px ${28 * sombra}px rgba(26,60,90,${0.22 * sombra}))`,
      }}
    >
      {children}
    </div>
  );
};

/* ── Toque ───────────────────────────────────────────────────────────────── */

/** Dedo virtual: o círculo chega, aperta e solta uma onda (coordenadas lógicas). */
export const Toque: React.FC<{ f: number; em: number; x: number; y: number }> = ({ f, em, x, y }) => {
  const t = f - em;
  if (t < -12 || t > 22) return null;
  const chega = interpolate(t, [-12, -2], [0, 1], { ...CLAMP, easing: SAI_RAPIDO });
  const sai = interpolate(t, [8, 18], [1, 0], CLAMP);
  const aperta = interpolate(t, [-2, 0, 5], [1, 0.82, 1], CLAMP);
  const onda = interpolate(t, [0, 18], [0, 1], { ...CLAMP, easing: SUAVE });
  return (
    <div style={{ position: "absolute", left: x, top: y, zIndex: 80, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: -24, top: -24, width: 48, height: 48, borderRadius: 48, background: "rgba(17,17,17,0.22)", border: "2px solid rgba(255,255,255,0.9)", boxSizing: "border-box", opacity: chega * sai, transform: `scale(${(1.25 - 0.25 * chega) * aperta})` }} />
      {t >= 0 ? <div style={{ position: "absolute", left: -24, top: -24, width: 48, height: 48, borderRadius: 48, border: "2px solid rgba(17,17,17,0.35)", boxSizing: "border-box", opacity: 1 - onda, transform: `scale(${1 + onda * 1.4})` }} /> : null}
    </div>
  );
};
