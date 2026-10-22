import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CENAS, NomeCena } from "./roteiro";
import { CLAMP, EASE_IN_OUT, EASE_OUT } from "./theme";

export const FPS = 30;

/** Segundos do roteiro → quadros. */
export const q = (s: number) => Math.round(s * FPS);

/** Quadro local (dentro da cena) de um segundo absoluto do roteiro. */
export const local = (cena: NomeCena) => (s: number) => q(s - CENAS[cena].de);

type Mola = Partial<{ damping: number; stiffness: number; mass: number }>;

/** Spring sem hook, para usar dentro de .map(). Antes do `em` vale 0. */
export const sp = (frame: number, fps: number, em = 0, config: Mola = {}) =>
  spring({ frame: Math.max(0, frame - em), fps, config: { damping: 16, stiffness: 140, mass: 0.8, ...config } });

/** Spring que começa em `em` quadros dentro da cena atual. */
export const useSp = (em = 0, config: Mola = {}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return sp(f, fps, em, config);
};

/** 0→1 entre dois quadros, com easing suave. */
export const rampa = (f: number, de: number, ate: number, easing = EASE_IN_OUT) =>
  interpolate(f, [de, ate], [0, 1], { ...CLAMP, easing });

export const saida = (f: number, de: number, ate: number) => rampa(f, de, ate, EASE_OUT);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
