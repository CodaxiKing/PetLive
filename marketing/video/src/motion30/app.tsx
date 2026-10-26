import React from "react";
import { Img, staticFile } from "remotion";

/*
 * Peças do app redesenhadas para a web, com as mesmas medidas, cores e
 * traços de apps/tutor (theme/colors.ts, components/Icone.tsx,
 * Mascote.tsx, MenuInferior.tsx, BotaoPrimario.tsx...). Coordenadas na
 * tela lógica de 390×844.
 */

/** Tokens de apps/tutor/src/theme/colors.ts. */
export const cor = {
  texto: "#111111",
  apoio: "#566070",
  fundo: "#F3F5F8",
  branco: "#FFFFFF",
  borda: "#E1E6EE",
  bordaForte: "#C9D0DB",
  desativado: "#EEF1F5",
  azul: "#9AD6F8",
  azulEscuro: "#1A5577",
  azulClaro: "#E0F1FA",
  verdeClaro: "#D8F2E3",
  verde: "#1F6B45",
  lilasClaro: "#EADCFB",
  lilas: "#5B3E8A",
  rosaClaro: "#FDE0E6",
  rosa: "#A3324F",
  amareloClaro: "#FFF0C9",
  amarelo: "#8A6414",
  emergencia: "#C0392B",
};

/* ── Ícones (components/Icone.tsx: viewBox 24, traço 1.8) ─────────────────── */

type Forma = string | { cx: number; cy: number; r: number };

const DESENHOS: Record<string, Forma[]> = {
  sino: ["M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z", "M10 21h4"],
  local: ["M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z", { cx: 12, cy: 10, r: 2.4 }],
  telefone: ["M5 4h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"],
  cruz: ["M12 5v14M5 12h14"],
  calculadora: ["M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M8 7h8", "M8 12h.5M12 12h.5M16 12h.5M8 16h.5M12 16h.5M16 16h.5"],
  relogio: [{ cx: 12, cy: 12, r: 8 }, "M12 8v4l2.5 1.5"],
  seta: ["M9 6l6 6-6 6"],
  voltar: ["M15 5l-7 7 7 7"],
  busca: [{ cx: 11, cy: 11, r: 7 }, "M20 20l-4-4"],
  vacina: ["M14 4l6 6-9 9-6-6z", "M5 13l6 6"],
  capsula: ["M5 9h14a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6z", "M12 9v6"],
  compartilhar: [{ cx: 6, cy: 12, r: 2.5 }, { cx: 18, cy: 6, r: 2.5 }, { cx: 18, cy: 18, r: 2.5 }, "M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  carteirinha: ["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", { cx: 9, cy: 11, r: 2 }, "M6 16c.5-1.6 1.6-2.4 3-2.4s2.5.8 3 2.4", "M14 10h4M14 14h4"],
  camera: ["M3 8h4l2-3h6l2 3h4v11H3z", { cx: 12, cy: 13, r: 3.5 }],
  escudo: ["M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", "M9 12l2 2 4-4"],
  coracao: ["M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"],
  grade: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  casa: ["M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"],
  pata: [{ cx: 6, cy: 10, r: 1.8 }, { cx: 10, cy: 6, r: 1.8 }, { cx: 14, cy: 6, r: 1.8 }, { cx: 18, cy: 10, r: 1.8 }, "M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z"],
  pessoa: [{ cx: 12, cy: 8, r: 4 }, "M4 20c1-4 4-6 8-6s7 2 8 6"],
  rota: ["M21 3L10 21l-1.5-7.5L1 12l20-9z"],
  mira: ["M12 3v3M12 18v3M3 12h3M18 12h3", "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"],
  mais: ["M12 5v14M5 12h14"],
};

export type NomeIcone = keyof typeof DESENHOS;

export const Icone: React.FC<{ n: NomeIcone; t?: number; c?: string; e?: number; style?: React.CSSProperties }> = ({ n, t = 18, c = cor.texto, e = 1.8, style }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={e} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0, ...style }}>
    {DESENHOS[n].map((f, i) => (typeof f === "string" ? <path key={i} d={f} /> : <circle key={i} cx={f.cx} cy={f.cy} r={f.r} />))}
  </svg>
);

/** Pata em traço (components/MarcaPata.tsx). */
export const MarcaPata: React.FC<{ t: number; c?: string; e?: number; style?: React.CSSProperties }> = ({ t, c = cor.branco, e = 1.1, style }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={e} style={style}>
    <circle cx={6} cy={10} r={1.8} />
    <circle cx={10} cy={6} r={1.8} />
    <circle cx={14} cy={6} r={1.8} />
    <circle cx={18} cy={10} r={1.8} />
    <path d="M12 12c-3 0-5 2.5-5 4.5 0 1.5 1.2 2 2.6 2 1 0 1.6-.4 2.4-.4s1.4.4 2.4.4c1.4 0 2.6-.5 2.6-2 0-2-2-4.5-5-4.5z" />
  </svg>
);

/* ── Mascotes (components/Mascote.tsx) ───────────────────────────────────── */

export const Cao: React.FC<{ t: number; recorte?: boolean }> = ({ t, recorte = false }) => (
  <svg width={t} height={t} viewBox="0 0 200 200" style={{ display: "block" }}>
    <path d="M52 150Q100 190 148 150L170 200H30z" fill="#E3AD6A" />
    <path d="M50 58C26 68 22 122 40 146C58 146 64 102 64 70z" fill="#B97A3C" />
    <path d="M150 58C174 68 178 122 160 146C142 146 136 102 136 70z" fill="#B97A3C" />
    <ellipse cx={100} cy={92} rx={52} ry={56} fill="#EDB878" />
    <ellipse cx={100} cy={120} rx={30} ry={24} fill="#F8E3C0" />
    <ellipse cx={100} cy={104} rx={11} ry={7.5} fill="#2A211C" />
    <path d="M100 111v10M88 124c6 8 18 8 24 0" fill="none" stroke="#2A211C" strokeWidth={3} strokeLinecap="round" />
    <circle cx={79} cy={82} r={recorte ? 6.5 : 7} fill="#2A211C" />
    <circle cx={121} cy={82} r={recorte ? 6.5 : 7} fill="#2A211C" />
    {!recorte ? (
      <>
        <circle cx={81} cy={80} r={2} fill="#fff" />
        <circle cx={123} cy={80} r={2} fill="#fff" />
        <path d="M54 152Q100 182 146 152L150 166Q100 196 50 166z" fill="#FF7A7A" />
      </>
    ) : null}
  </svg>
);

export const Gato: React.FC<{ t: number; recorte?: boolean }> = ({ t, recorte = false }) => (
  <svg width={t} height={t} viewBox="0 0 200 200" style={{ display: "block" }}>
    <path d="M30 200Q36 150 100 150Q164 150 170 200z" fill="#E88F45" />
    <path d="M46 78L52 24L96 54z" fill="#E88F45" />
    <path d="M154 78L148 24L104 54z" fill="#E88F45" />
    {!recorte ? (
      <>
        <path d="M58 64L60 40L80 54z" fill="#F7B7B0" />
        <path d="M142 64L140 40L120 54z" fill="#F7B7B0" />
      </>
    ) : null}
    <ellipse cx={100} cy={98} rx={58} ry={52} fill="#F2A65A" />
    <ellipse cx={100} cy={120} rx={22} ry={15} fill="#FBE3CC" />
    <ellipse cx={76} cy={94} rx={8} ry={10} fill="#3E8E6A" />
    <ellipse cx={124} cy={94} rx={8} ry={10} fill="#3E8E6A" />
    <ellipse cx={76} cy={94} rx={2.5} ry={7} fill="#1D1A18" />
    <ellipse cx={124} cy={94} rx={2.5} ry={7} fill="#1D1A18" />
    {!recorte ? (
      <>
        <circle cx={78} cy={90} r={2} fill="#fff" />
        <circle cx={126} cy={90} r={2} fill="#fff" />
        <path d="M93 109h14l-7 9z" fill="#E57373" />
        <path d="M100 118c0 7-8 8-12 4M100 118c0 7 8 8 12 4" fill="none" stroke="#6B4A3A" strokeWidth={2.5} strokeLinecap="round" />
        <path d="M60 112l-26-4M60 120l-26 6M140 112l26-4M140 120l26 6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
      </>
    ) : null}
  </svg>
);

/** Avatar redondo do pet (sem foto: mascote recortado sobre o fundo da espécie). */
export const Avatar: React.FC<{ especie?: "cao" | "gato"; t: number; style?: React.CSSProperties }> = ({ especie = "cao", t, style }) => (
  <div style={{ width: t, height: t, borderRadius: t, overflow: "hidden", background: especie === "cao" ? cor.azul : cor.lilasClaro, flexShrink: 0, ...style }}>
    <div style={{ marginTop: t * 0.06 }}>{especie === "cao" ? <Cao t={t} recorte /> : <Gato t={t} recorte />}</div>
  </div>
);

/* ── Estrutura ───────────────────────────────────────────────────────────── */

/** Onda branca do rodapé dos heróis (HeroiOnda / OndaHeroi). */
export const Onda: React.FC<{ altura?: number; c?: string; style?: React.CSSProperties }> = ({ altura = 46, c = cor.branco, style }) => (
  <svg width={390} height={altura} viewBox="0 0 390 46" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: -1, display: "block", ...style }}>
    <path d="M0 46V26C28 8 56 10 80 24C104 38 132 40 154 26C180 8 214 10 238 26C262 42 300 38 322 22C346 6 372 12 390 24V46z" fill={c} />
  </svg>
);

export const BotaoRedondo: React.FC<{ x: number; y: number; t?: number; fundo?: string; children: React.ReactNode }> = ({ x, y, t = 46, fundo = cor.branco, children }) => (
  <div style={{ position: "absolute", left: x, top: y, width: t, height: t, borderRadius: t, background: fundo, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
);

/** Barra de status do iPhone (hora fixa do roteiro). */
export const BarraStatus: React.FC<{ hora: string; escura?: boolean }> = ({ hora, escura = true }) => {
  const c = escura ? cor.texto : cor.branco;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: 47, zIndex: 50, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 34, top: 15, fontSize: 16, fontWeight: 700, color: c, letterSpacing: -0.2 }}>{hora}</div>
      <svg style={{ position: "absolute", right: 30, top: 18 }} width={68} height={13} viewBox="0 0 68 13">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 5} y={9 - i * 3} width={3.2} height={4 + i * 3} rx={1} fill={c} />
        ))}
        <path d="M30 4.6a8.5 8.5 0 0 1 11.6 0M32.4 7.2a5 5 0 0 1 6.8 0" stroke={c} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <circle cx={35.8} cy={10.2} r={1.5} fill={c} />
        <rect x={45.5} y={0.5} width={20} height={11} rx={3.2} stroke={c} strokeOpacity={0.4} fill="none" />
        <rect x={47.5} y={2.5} width={14} height={7} rx={1.6} fill={c} />
        <rect x={66.5} y={4} width={1.5} height={4} rx={0.7} fill={c} fillOpacity={0.45} />
      </svg>
    </div>
  );
};

/** Indicador de início do iPhone. */
export const IndicadorHome: React.FC = () => (
  <div style={{ position: "absolute", left: 128, bottom: 8, width: 134, height: 5, borderRadius: 5, background: cor.texto, zIndex: 50 }} />
);

/** Menu inferior flutuante (MenuInferior.tsx): pílula preta, bolha azul no ativo. */
export const MenuInferior: React.FC<{ ativo: number }> = ({ ativo }) => {
  const icones: NomeIcone[] = ["casa", "pata", "local", "pessoa"];
  const passo = (342 - 16 - 48) / 3;
  return (
    <div style={{ position: "absolute", left: 24, right: 24, bottom: 34, height: 64, borderRadius: 32, background: cor.texto, zIndex: 20 }}>
      <div style={{ position: "absolute", left: 8 + passo * ativo, top: 8, width: 48, height: 48, borderRadius: 24, background: cor.azul }} />
      {icones.map((n, i) => (
        <div key={n} style={{ position: "absolute", left: 8 + passo * i, top: 8, width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n={n} t={24} c={i === ativo ? cor.texto : cor.branco} />
        </div>
      ))}
    </div>
  );
};

/** BotaoPrimario.tsx: pílula preta de 64 px com o círculo azul do ícone. */
export const BotaoPrimario: React.FC<{ titulo: string; icone: React.ReactNode; style?: React.CSSProperties }> = ({ titulo, icone, style }) => (
  <div style={{ height: 64, borderRadius: 32, background: cor.texto, display: "flex", alignItems: "center", paddingLeft: 6, paddingRight: 6, ...style }}>
    <div style={{ width: 52, height: 52, borderRadius: 26, background: cor.azul, display: "flex", alignItems: "center", justifyContent: "center" }}>{icone}</div>
    <div style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 700, color: cor.branco, paddingRight: 44 }}>{titulo}</div>
  </div>
);

/** Barra de progresso do app (fundo claro, preenchimento cheio). */
export const Barra: React.FC<{ fracao: number; c: string; fundo: string; altura?: number }> = ({ fracao, c, fundo, altura = 8 }) => (
  <div style={{ height: altura, borderRadius: altura, background: fundo, overflow: "hidden" }}>
    <div style={{ width: `${fracao * 100}%`, height: "100%", borderRadius: altura, background: c }} />
  </div>
);

/** Logo oficial do app (apps/tutor/assets/logo-petlive-original.png, recortado em public/). */
export const SeloMarca: React.FC<{ t: number; style?: React.CSSProperties }> = ({ t, style }) => (
  <Img src={staticFile("logo-petlive.png")} style={{ width: t, height: t, display: "block", flexShrink: 0, filter: `drop-shadow(0 ${t * 0.08}px ${t * 0.12}px rgba(26,85,119,0.28))`, ...style }} />
);
