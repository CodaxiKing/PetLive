import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, local, sp } from "../base";
import { Brilho, Confete, Coracoes, FundoVivo } from "../fx";
import { Rex } from "../mascote";
import { BATIDAS, TEXTOS } from "../roteiro";
import { C, CLAMP } from "../theme";
import { Cena, SeloMarca, Titulo } from "../ui";

const Calendario: React.FC<{ tam: number }> = ({ tam }) => (
  <svg width={tam} height={tam} viewBox="0 0 120 120">
    <rect x="14" y="22" width="92" height="84" rx="16" fill={C.branco} stroke={C.preto} strokeWidth="7" />
    <path d="M14 46 H106" stroke={C.preto} strokeWidth="7" />
    <path d="M38 12 V30 M82 12 V30" stroke={C.preto} strokeWidth="7" strokeLinecap="round" />
    {[0, 1, 2].map((l) => [0, 1, 2, 3].map((c) => <rect key={`${l}${c}`} x={26 + c * 18} y={56 + l * 15} width={10} height={8} rx={2} fill={l === 2 && c === 1 ? C.vinho : "#E6DCCB"} />))}
  </svg>
);

/**
 * Gancho em dois tempos. Primeiro o Rex em close, triste, ocupando a tela, e
 * o carimbo "VENCEU" bate no 1º segundo com tremor e flash. Depois ele recua
 * para o lado, o calendário entra e o título aparece palavra por palavra.
 */
export const Gancho: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = local("gancho");
  const bate = b(BATIDAS.carimboVenceu);
  const carimbo = sp(f, fps, bate, { damping: 9, stiffness: 280 });
  const dt = f - bate;
  const tremor = dt >= 0 && dt < 12 ? (1 - dt / 12) * 26 : 0;
  const flash = dt >= 0 ? interpolate(dt, [0, 2, 8], [0, 0.6, 0], CLAMP) : 0;
  const alerta = dt >= 0 ? (0.5 + 0.5 * Math.sin(dt * 0.22)) * interpolate(dt, [0, 10], [0, 1], CLAMP) : 0;
  // k: 0 = close no Rex, 1 = layout com título e calendário.
  const k = sp(f, fps, b(BATIDAS.tituloGancho), { damping: 14, stiffness: 120 });
  const zoom = interpolate(f, [0, 140], [1, 1.08], CLAMP);
  const balanco = dt > 0 ? Math.sin(dt * 0.5) * 10 * Math.exp(-dt / 25) : 0;
  return (
    <Cena>
      <FundoVivo cor={C.creme} tom="#FFE3A3" patas="rgba(255,255,255,0.7)" />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 55%, transparent 45%, rgba(163,48,79,${0.35 * alerta}) 100%)` }} />
      <AbsoluteFill style={{ transform: `scale(${zoom}) translate(${Math.sin(f * 1.7) * tremor}px, ${Math.cos(f * 2.3) * tremor}px)` }}>
        <Titulo l1="Vacina do pet" l2="atrasada?" cor={C.vinho} marca="rgba(163,48,79,0.18)" tam={128} top={220} em={b(BATIDAS.tituloGancho) + 2} />
        <div style={{ position: "absolute", left: 110, top: 600, transform: `rotate(${-8 + balanco}deg) scale(${k})`, opacity: Math.min(1, k * 2) }}>
          <Calendario tam={360} />
        </div>
        <div style={{ position: "absolute", left: lerp(40, 500, k), top: lerp(330, 620, k) }}>
          <Rex tam={lerp(1000, 480, k)} alegria={0.12} olhar={lerp(0, -1, k)} />
        </div>
        <div
          style={{
            position: "absolute",
            left: lerp(200, 120, k),
            top: lerp(200, 880, k),
            background: C.vinho,
            color: C.branco,
            fontSize: lerp(140, 80, k),
            fontWeight: 800,
            letterSpacing: -2,
            padding: "12px 40px",
            borderRadius: 24,
            border: `6px solid ${C.branco}`,
            transform: `rotate(-12deg) scale(${f < bate ? 0 : 3 - 2 * carimbo})`,
            opacity: Math.min(1, carimbo * 2),
            boxShadow: "0 20px 40px rgba(163,48,79,0.4)",
          }}
        >
          VENCEU
        </div>
        <Confete x={520} y={320} em={bate} n={34} forca={0.7} seed="venceu" />
        {/* ponto de interrogação flutuando sobre o Rex */}
        <div style={{ position: "absolute", left: 860, top: 520 - Math.sin(f * 0.15) * 14, fontSize: 130, fontWeight: 800, color: C.vinho, transform: `scale(${k}) rotate(${Math.sin(f * 0.1) * 12}deg)` }}>?</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.branco, opacity: flash }} />
    </Cena>
  );
};

/**
 * Virada: a íris azul abre, a pata da marca cai com amassa-e-estica, o Rex
 * pula feliz soltando corações e o slogan acende palavra por palavra.
 */
export const Marca: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const selo = sp(f, fps, 6, { damping: 7, stiffness: 160 });
  // Amassa ao bater e estica ao subir.
  const amassa = 1 + (selo - 1) * 0.9;
  const nome = sp(f, fps, 14, { damping: 10 });
  const rex = sp(f, fps, 30, { damping: 9, stiffness: 140 });
  const pulo = Math.abs(Math.sin(Math.max(0, f - 50) * 0.16)) * 36 * interpolate(f, [50, 60], [0, 1], CLAMP);
  const giroSelo = (1 - selo) * -120 + Math.sin(f * 0.06) * 4;
  return (
    <Cena entrada="circulo" cx={290} cy={780}>
      <FundoVivo cor={C.heroi} tom="#CDEBFB" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 220, display: "flex", justifyContent: "center", transform: `scale(${selo * (2 - amassa)}, ${selo * amassa}) rotate(${giroSelo}deg)` }}>
        <SeloMarca t={380} />
      </div>
      {[
        [230, 260, 0],
        [860, 330, 1],
        [800, 620, 2],
        [250, 600, 3],
      ].map(([x, y, s]) => (
        <Brilho key={s} x={x} y={y} tam={70} em={16 + s * 4} seed={s} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", fontSize: 210, fontWeight: 800, letterSpacing: -8, color: C.preto }}>
        {"PetLive".split("").map((l, i) => {
          const e = sp(f, fps, 14 + i * 2, { damping: 8, stiffness: 200 });
          return (
            <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - e) * -200}px) rotate(${(1 - e) * 30}deg)`, opacity: Math.min(1, e * 2) * nome }}>{l}</span>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 70, right: 70, top: 880, textAlign: "center", fontSize: 68, fontWeight: 800, letterSpacing: -1.8, lineHeight: 1.12 }}>
        {/* Quebra fixa depois da vírgula: a 2ª linha é o destaque. */}
        {TEXTOS.slogan.replace(", ", ",|").split("|").map((linha, l) => (
          <div key={l}>
            {linha.split(" ").map((p, i) => {
              const e = sp(f, fps, 30 + (l * 5 + i) * 4, { damping: 10, stiffness: 200 });
              return (
                <span key={i} style={{ display: "inline-block", margin: "0 0.15em", color: l === 1 ? C.azulForte : C.texto, transform: `translateY(${(1 - e) * 50}px) scale(${e})`, opacity: Math.min(1, e * 2) }}>{p}</span>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 300, top: 1110 - pulo, transform: `translateY(${(1 - rex) * 600}px)` }}>
        <Rex tam={480} alegria={1} />
      </div>
      <Coracoes x={540} y={1260} em={44} n={9} subida={200} />
    </Cena>
  );
};
