import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, sp } from "./base";
import { C, CLAMP } from "./theme";

/**
 * Rex, o mascote do anúncio. `alegria` vai de 0 (triste) a 1 (feliz) e pode
 * ser animada: boca, sobrancelhas, orelhas e rabo seguem o valor.
 * Ele pisca, respira e abana o rabo sozinho. `susto` (0 a 1) arregala os
 * olhos, levanta as orelhas e faz tremer; `fareja` abaixa a cabeça e mexe o focinho.
 */
export const Rex: React.FC<{ tam: number; alegria: number; olhar?: number; susto?: number; fareja?: boolean; seed?: number; style?: React.CSSProperties }> = ({ tam, alegria, olhar = 0, susto = 0, fareja = false, seed = 0, style }) => {
  const f = useCurrentFrame() + seed * 37;
  const a = Math.max(0, Math.min(1, alegria));
  const su = Math.max(0, Math.min(1, susto));
  const tremor = su * Math.sin(f * 2.6) * 4;
  const fung = fareja ? Math.sin(f * 0.9) : 0;

  // Piscada a cada ~2,6 s, rápida (4 quadros).
  const ciclo = f % 78;
  const olho = ciclo < 4 ? interpolate(ciclo, [0, 2, 4], [1, 0.1, 1]) : 1;
  const respira = 1 + Math.sin(f * 0.12) * 0.015;
  const rabo = Math.sin(f * lerp(0.15, 0.75, a)) * lerp(6, 32, a);
  const orelha = lerp(28, -6, a) + Math.sin(f * 0.2) * lerp(1, 5, a) - su * 22;
  const cabeca = Math.sin(f * 0.07) * lerp(2, 5, a) + lerp(-6, 0, a) + (fareja ? 10 + Math.sin(f * 0.25) * 4 : 0);

  // Boca: curva para baixo quando triste, sorriso aberto quando feliz.
  const cantoY = lerp(212, 190, a);
  const cantoX = lerp(26, 34, a);
  const meioY = lerp(200, 232, a);
  const sobr = lerp(-16, -4, a);
  const sobrY = lerp(92, 84, a);

  return (
    <svg width={tam} height={tam} viewBox="0 0 300 300" style={{ overflow: "visible", ...style }}>
      <g transform={`translate(${tremor} 0)`}>
      {/* rabo */}
      <g transform={`rotate(${rabo} 222 238)`}>
        <path d="M222 238 C 262 230, 270 196, 258 176" stroke="#C9894D" strokeWidth="18" fill="none" strokeLinecap="round" />
      </g>
      {/* corpo */}
      <g transform={`translate(150 300) scale(${respira}) translate(-150 -300)`}>
        <path d="M78 300 C 70 230, 110 205, 150 205 S 232 230, 222 300 Z" fill="#E7A867" />
        <ellipse cx="150" cy="262" rx="40" ry="34" fill="#F7D9B0" />
        <ellipse cx="112" cy="298" rx="22" ry="12" fill="#E7A867" />
        <ellipse cx="188" cy="298" rx="22" ry="12" fill="#E7A867" />
        <path d="M100 214 Q150 240 200 214 L198 230 Q150 256 102 230 Z" fill={C.coral} />
        <circle cx="150" cy="242" r="10" fill="#FFD66B" stroke="#E0A92E" strokeWidth="3" />
      </g>
      {/* cabeça */}
      <g transform={`rotate(${cabeca} 150 190)`}>
        <g transform={`rotate(${orelha} 92 82)`}>
          <ellipse cx="80" cy="128" rx="26" ry="56" fill="#B7743B" />
        </g>
        <g transform={`rotate(${-orelha} 208 82)`}>
          <ellipse cx="220" cy="128" rx="26" ry="56" fill="#B7743B" />
        </g>
        <ellipse cx="150" cy="128" rx="74" ry="76" fill="#E7A867" />
        <ellipse cx="150" cy="166" rx="42" ry="32" fill="#F7D9B0" />
        {/* bochechas coradas quando feliz */}
        <ellipse cx="100" cy="160" rx="14" ry="9" fill="#F28B8B" opacity={a * 0.6} />
        <ellipse cx="200" cy="160" rx="14" ry="9" fill="#F28B8B" opacity={a * 0.6} />
        {/* sobrancelhas */}
        <path d={`M104 ${sobrY - sobr * 0.2} Q119 ${sobrY - 6 * a} 134 ${sobrY + sobr}`} fill="none" stroke="#8A5527" strokeWidth="6" strokeLinecap="round" />
        <path d={`M196 ${sobrY - sobr * 0.2} Q181 ${sobrY - 6 * a} 166 ${sobrY + sobr}`} fill="none" stroke="#8A5527" strokeWidth="6" strokeLinecap="round" />
        {/* olhos */}
        {/* branco dos olhos aparece no susto */}
        <ellipse cx="120" cy="116" rx={17} ry={19 * olho} fill={C.branco} opacity={su} />
        <ellipse cx="180" cy="116" rx={17} ry={19 * olho} fill={C.branco} opacity={su} />
        <g transform={`translate(${olhar * 6} 0)`}>
          <ellipse cx="120" cy="118" rx="10" ry={11 * olho} fill={C.preto} />
          <ellipse cx="180" cy="118" rx="10" ry={11 * olho} fill={C.preto} />
          <circle cx="123" cy="114" r={3.5 * olho} fill={C.branco} />
          <circle cx="183" cy="114" r={3.5 * olho} fill={C.branco} />
        </g>
        {/* focinho e boca */}
        <ellipse cx="150" cy="152" rx={15 * (1 + fung * 0.12)} ry={11 * (1 - fung * 0.08)} fill={C.preto} />
        {fareja
          ? [0, 1, 2].map((k) => {
              const p = ((f + k * 8) % 24) / 24;
              return <path key={k} d={`M${112 - p * 30} ${146 + k * 8} q-8 -4 -16 0`} stroke="#8A5527" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity={1 - p} />;
            })
          : null}
        <ellipse cx="146" cy="148" rx="5" ry="3" fill="#555" />
        <path d={`M150 163 V176 M${150 - cantoX} ${cantoY} Q137 ${meioY - 10} 150 ${lerp(184, 196, a)} Q163 ${meioY - 10} ${150 + cantoX} ${cantoY}`} stroke={C.preto} strokeWidth="4.5" fill="none" strokeLinecap="round" opacity={1 - su} />
        <ellipse cx="150" cy="192" rx={9} ry={13} fill="#7A2E2E" opacity={su} />
        {a > 0.55 && su < 0.5 ? <path d={`M140 ${lerp(184, 196, a) + 2} Q150 ${lerp(196, 226, a)} 160 ${lerp(184, 196, a) + 2} Z`} fill="#F07A7A" opacity={interpolate(a, [0.55, 0.8], [0, 1], CLAMP)} /> : null}
        {/* lágrima quando triste */}
        {a < 0.35 ? (
          <path d={`M196 ${132 + ((f * 1.2) % 40)} q6 10 0 14 q-6 -4 0 -14z`} fill="#7CC3F0" opacity={interpolate(a, [0, 0.35], [1, 0], CLAMP) * (1 - ((f * 1.2) % 40) / 40)} />
        ) : null}
      </g>
      </g>
    </svg>
  );
};

type Balao = "!" | "?" | "coracao" | "zz" | null;

/**
 * Rex sentado no canto de baixo, em cima da faixa das frases, reagindo à
 * cena. Entra subindo com mola; o balão aparece acima da cabeça.
 */
export const RexCanto: React.FC<{ alegria: number; susto?: number; fareja?: boolean; olhar?: number; balao?: Balao; emBalao?: number; lado?: "esq" | "dir"; em?: number }> = ({ alegria, susto = 0, fareja = false, olhar = 1, balao = null, emBalao = 10, lado = "esq", em = 8 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = sp(f, fps, em, { damping: 10, stiffness: 140 });
  const b = sp(f, fps, emBalao, { damping: 8, stiffness: 220 });
  const x = lado === "esq" ? 10 : 640;
  return (
    <div style={{ position: "absolute", left: x, top: 1100, width: 300, height: 300, transform: `translateY(${(1 - e) * 420}px) rotate(${(1 - e) * (lado === "esq" ? -25 : 25)}deg)` }}>
      <Rex tam={300} alegria={alegria} susto={susto} fareja={fareja} olhar={lado === "esq" ? olhar : -olhar} />
      {balao && f >= emBalao ? (
        <div
          style={{
            position: "absolute",
            left: lado === "esq" ? 200 : 0,
            top: -40 + Math.sin(f * 0.12) * 6,
            width: 120,
            height: 104,
            borderRadius: 52,
            background: C.branco,
            boxShadow: "0 12px 30px rgba(42,33,28,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 70,
            fontWeight: 800,
            color: balao === "!" ? C.vinho : C.preto,
            transform: `scale(${b}) rotate(${(1 - b) * 30 + (balao === "!" ? Math.sin(f * 1.2) * 6 : 0)}deg)`,
          }}
        >
          {balao === "coracao" ? (
            <svg width={64} height={64} viewBox="0 0 24 24" style={{ transform: `scale(${1 + Math.max(0, Math.sin(f * 0.3)) * 0.15})` }}>
              <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" fill={C.coral} />
            </svg>
          ) : (
            balao
          )}
        </div>
      ) : null}
    </div>
  );
};
