import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./roteiro";

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** Desaceleração longa, para entradas. */
export const SAI_RAPIDO = Easing.bezier(0.16, 1, 0.3, 1);
/** Acelera e desacelera, para câmera e trocas. */
export const SUAVE = Easing.bezier(0.65, 0, 0.35, 1);

/** 0→1 entre dois quadros. */
export const rampa = (f: number, de: number, ate: number, easing = SUAVE) => interpolate(f, [de, ate], [0, 1], { ...CLAMP, easing });

/** Mola calma (sem quique exagerado). Antes de `em` vale 0. */
export const mola = (f: number, em: number, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
  spring({ frame: Math.max(0, f - em), fps: FPS, config: { damping: 20, stiffness: 120, mass: 0.9, ...config } });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sobe e volta: 0 → 1 em [de, de+ida], fica, e volta a 0 em [volta, volta+dur]. */
export const idaEVolta = (f: number, de: number, volta: number, ida = 18, dur = 16) =>
  f < volta ? rampa(f, de, de + ida, SAI_RAPIDO) : 1 - rampa(f, volta, volta + dur, SUAVE);

/** Apertar de botão: 0 → 1 → 0 em volta do quadro do toque. */
export const aperto = (f: number, em: number) => interpolate(f, [em - 3, em, em + 6], [0, 1, 0], CLAMP);

/** Chega rápido, passa um pouco do ponto e volta. */
export const VOLTA = Easing.bezier(0.3, 1.5, 0.55, 1);

/**
 * Quadros-chave numéricos. Entre cada par usa SUAVE, ou VOLTA quando o
 * quadro de destino pede `e: "volta"`.
 */
export const chaves = (f: number, qs: { f: number; v: number; e?: "volta" }[]) => {
  if (f <= qs[0].f) return qs[0].v;
  for (let i = 1; i < qs.length; i++) {
    if (f <= qs[i].f) return lerp(qs[i - 1].v, qs[i].v, rampa(f, qs[i - 1].f, qs[i].f, qs[i].e === "volta" ? VOLTA : SUAVE));
  }
  return qs[qs.length - 1].v;
};
