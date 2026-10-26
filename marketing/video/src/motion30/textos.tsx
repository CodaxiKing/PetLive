import React from "react";
import { interpolate } from "remotion";
import { Avatar, cor, Icone, NomeIcone, SeloMarca } from "./app";
import { BrilhoTexto } from "./efeitos";
import { CLAMP, mola, rampa, SAI_RAPIDO } from "./movimento";
import { TEXTOS } from "./roteiro";

/** Zona segura: títulos entre x 96 e 984, acima do celular, longe do rodapé. */
const MARGEM = 96;

/** Uma linha que sobe, ganha nitidez e assenta. */
const Linha: React.FC<{ f: number; em: number; tam: number; children: React.ReactNode }> = ({ f, em, children }) => {
  const e = rampa(f, em, em + 20, SAI_RAPIDO);
  return <div style={{ transform: `translateY(${(1 - e) * 60}px) scale(${0.94 + 0.06 * e})`, opacity: Math.min(1, e * 2.2), filter: e < 1 ? `blur(${(1 - e) * 14}px)` : undefined }}>{children}</div>;
};

/** Linha palavra por palavra: cada uma sobe desfocada, com atraso curto. */
const Palavras: React.FC<{ f: number; em: number; texto: string }> = ({ f, em, texto }) => (
  <div>
    {texto.split(" ").map((p, i) => {
      const e = rampa(f, em + i * 3, em + i * 3 + 18, SAI_RAPIDO);
      return (
        <span key={i} style={{ display: "inline-block", marginRight: "0.24em", transform: `translateY(${(1 - e) * 50}px) rotate(${(1 - e) * 4}deg)`, opacity: Math.min(1, e * 2.2), filter: e < 1 ? `blur(${(1 - e) * 12}px)` : undefined }}>
          {p}
        </span>
      );
    })}
  </div>
);

/** Marca-texto azul que se desenha atrás da palavra. */
const Marca: React.FC<{ p: number; children: React.ReactNode }> = ({ p, children }) => (
  <span style={{ position: "relative", display: "inline-block", isolation: "isolate" }}>
    <span style={{ position: "absolute", left: "-3%", width: `${106 * p}%`, bottom: "6%", height: "38%", borderRadius: 14, background: cor.azul, zIndex: -1 }} />
    {children}
  </span>
);

const ETIQUETAS: Record<string, { fundo: string; c: string; icone: NomeIcone }> = {
  Saúde: { fundo: cor.rosaClaro, c: cor.rosa, icone: "vacina" },
  Remédios: { fundo: cor.lilasClaro, c: cor.lilas, icone: "capsula" },
  Mapa: { fundo: cor.azulClaro, c: cor.azulEscuro, icone: "local" },
};

/**
 * Título da cena: etiqueta opcional (família de cor do app) + duas linhas.
 * `f` é o quadro local da cena; sai nos últimos 10 quadros de `dur`.
 */
export const Titulo: React.FC<{ f: number; dur: number; l1: string; l2: string; etiqueta?: string; marca?: boolean; adianta?: number }> = ({ f: fCena, dur, l1, l2, etiqueta, marca = false, adianta = 0 }) => {
  // `adianta` faz o título já estar entrando no 1º quadro da cena.
  const f = fCena + adianta;
  const maior = Math.max(l1.length, l2.length);
  const tam = Math.min(88, Math.floor(1580 / maior));
  const sai = rampa(fCena, dur - 12, dur - 1);
  const et = etiqueta ? ETIQUETAS[etiqueta] : null;
  const eEt = rampa(f, 0, 14, SAI_RAPIDO);
  const risco = rampa(f, 14 + l1.split(" ").length * 3, 36 + l1.split(" ").length * 3, SAI_RAPIDO);
  return (
    <div
      style={{
        position: "absolute",
        left: MARGEM,
        right: MARGEM,
        top: 168,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        opacity: 1 - sai,
        transform: `translateY(${-sai * 30}px)`,
        filter: sai > 0 ? `blur(${sai * 6}px)` : undefined,
      }}
    >
      <div style={{ height: 64, marginBottom: 22 }}>
        {et ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 60, padding: "0 26px 0 14px", borderRadius: 999, background: et.fundo, opacity: eEt, transform: `translateY(${(1 - eEt) * 16}px)` }}>
            <div style={{ width: 40, height: 40, borderRadius: 20, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone n={et.icone} t={22} c={et.c} e={2.2} />
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, color: et.c, letterSpacing: 0.4 }}>{etiqueta}</span>
          </div>
        ) : null}
      </div>
      <div style={{ fontSize: tam, lineHeight: 1.16, fontWeight: 800, letterSpacing: -tam * 0.035, color: cor.texto }}>
        <Palavras f={f} em={2} texto={l1} />
        <Linha f={f} em={4 + l1.split(" ").length * 3} tam={tam}>
          {marca ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: tam * 0.22 }}>
              <SeloMarca t={tam * 0.92} />
              <Marca p={risco}>{l2}</Marca>
            </span>
          ) : (
            <Marca p={risco}>{l2}</Marca>
          )}
        </Linha>
      </div>
    </div>
  );
};

/* ── Gancho: pequenos cards que se organizam ao redor do celular ─────────── */

const MINI = [
  { icone: "vacina" as NomeIcone, fundo: cor.rosaClaro, c: cor.rosa, rotulo: "Próxima vacina", valor: "V10 em 12 dias", x: 64, y: 760, dx: -260, dy: -120, rot: -9 },
  { icone: "sino" as NomeIcone, fundo: cor.lilasClaro, c: cor.lilas, rotulo: "Lembrete", valor: "Antibiótico, 20:00", x: 530, y: 1010, dx: 280, dy: -60, rot: 8 },
  { icone: "local" as NomeIcone, fundo: cor.azulClaro, c: cor.azulEscuro, rotulo: "Clínica", valor: "a 800 m", x: 96, y: 1300, dx: -240, dy: 140, rot: -6 },
];

/** Cards do gancho: chegam soltos (já em movimento no 1º quadro), assentam e entram no celular. */
export const CardsGancho: React.FC<{ f: number; alvo: { x: number; y: number } }> = ({ f, alvo }) => (
  <>
    {MINI.map((m, i) => {
      const e = interpolate(f, [-18 + i * 4, 40 + i * 4], [0, 1], { ...CLAMP, easing: SAI_RAPIDO });
      const flut = Math.sin(f * 0.07 + i * 2) * 6;
      const recolhe = rampa(f, 84 + i * 3, 104 + i * 3);
      const x = m.x + m.dx * (1 - e);
      const y = m.y + m.dy * (1 - e) + flut;
      const largura = 430;
      const cx = x + largura / 2;
      const cy = y + 60;
      const fx = cx + (alvo.x - cx) * recolhe;
      const fy = cy + (alvo.y - cy) * recolhe;
      return (
        <div
          key={m.rotulo}
          style={{
            position: "absolute",
            left: fx - largura / 2,
            top: fy - 60,
            height: 120,
            whiteSpace: "nowrap",
            boxSizing: "border-box",
            borderRadius: 36,
            background: "rgba(255,255,255,0.96)",
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "0 26px 0 18px",
            boxShadow: "0 26px 50px -18px rgba(26,60,90,0.32)",
            opacity: Math.min(1, e * 1.8) * (1 - recolhe),
            transform: `rotate(${m.rot * (1 - e)}deg) scale(${(0.86 + 0.14 * e) * (1 - recolhe * 0.6)})`,
            filter: e < 0.6 ? `blur(${(0.6 - e) * 12}px)` : undefined,
          }}
        >
          <div style={{ width: 76, height: 76, borderRadius: 38, background: m.fundo, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone n={m.icone} t={36} c={m.c} e={2} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 600, color: m.c }}>{m.rotulo}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: cor.texto, letterSpacing: -0.6 }}>{m.valor}</div>
          </div>
        </div>
      );
    })}
  </>
);

/* ── Fechamento ──────────────────────────────────────────────────────────── */

/** Logo do fechamento: entra girando com mola, quica e recebe um brilho. */
const SeloDesenhado: React.FC<{ f: number; t: number }> = ({ f, t }) => {
  const e = mola(f, 2, { damping: 11, stiffness: 160, mass: 0.8 });
  const brilho = rampa(f, 26, 46);
  const anel = rampa(f, 8, 34, SAI_RAPIDO);
  return (
    <div style={{ position: "relative", width: t, height: t, flexShrink: 0, transform: `scale(${e}) rotate(${(1 - e) * -160}deg)` }}>
      <div style={{ position: "absolute", inset: -t * 0.1, borderRadius: t * 0.32, border: `4px solid ${cor.azul}`, opacity: (1 - anel) * Math.min(1, e * 2), transform: `scale(${0.85 + anel * 0.5})` }} />
      <SeloMarca t={t} />
      {brilho > 0 && brilho < 1 ? (
        <div style={{ position: "absolute", inset: 0, borderRadius: t * 0.235, overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, rgba(255,255,255,0) ${brilho * 180 - 50}%, rgba(255,255,255,0.75) ${brilho * 180 - 30}%, rgba(255,255,255,0) ${brilho * 180 - 10}%)` }} />
        </div>
      ) : null}
    </div>
  );
};

export const Fechamento: React.FC<{ f: number }> = ({ f }) => {
  const t = TEXTOS.fechamento;
  const eApoio1 = rampa(f, 26, 48, SAI_RAPIDO);
  const eApoio2 = rampa(f, 34, 56, SAI_RAPIDO);
  const eCta = mola(f, 46, { damping: 15, stiffness: 120 });
  const eNota = rampa(f, 64, 80);
  const pets = [mola(f, 56, { damping: 12, stiffness: 140 }), mola(f, 64, { damping: 12, stiffness: 140 })];
  const brilhoMarca = rampa(f, 40, 66);
  const brilhoCta = Math.max(rampa(f, 76, 100), f > 120 ? rampa(f, 124, 148) : 0);
  const respira = 1 + Math.sin(Math.max(0, f - 70) * 0.11) * 0.012 * rampa(f, 70, 90);
  const brilho = rampa(f, 0, 40, SAI_RAPIDO);
  return (
    <>
      {/* Clarão suave atrás da marca */}
      <div style={{ position: "absolute", left: 40, top: 40, width: 1000, height: 760, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0))", opacity: brilho, transform: `scale(${0.7 + 0.3 * brilho})` }} />
      <div style={{ position: "absolute", left: 96, right: 96, top: 150, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <SeloDesenhado f={f} t={132} />
          <BrilhoTexto t={brilhoMarca} style={{ fontSize: 156, fontWeight: 800, letterSpacing: -6, color: cor.texto, lineHeight: 1 }}>
            {t.marca.split("").map((l, i) => {
              const e = rampa(f, 10 + i * 2.5, 30 + i * 2.5, SAI_RAPIDO);
              return (
                <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - e) * 70}px)`, opacity: Math.min(1, e * 2), filter: e < 1 ? `blur(${(1 - e) * 14}px)` : undefined }}>
                  {l}
                </span>
              );
            })}
          </BrilhoTexto>
        </div>
        <div style={{ marginTop: 44, fontSize: 60, lineHeight: 1.18, fontWeight: 700, letterSpacing: -1.8, color: "#2B3A4A" }}>
          <div style={{ opacity: eApoio1, transform: `translateY(${(1 - eApoio1) * 30}px)`, filter: eApoio1 < 1 ? `blur(${(1 - eApoio1) * 10}px)` : undefined }}>{t.apoio[0]}</div>
          <div style={{ opacity: eApoio2, transform: `translateY(${(1 - eApoio2) * 30}px)`, filter: eApoio2 < 1 ? `blur(${(1 - eApoio2) * 10}px)` : undefined }}>{t.apoio[1]}</div>
        </div>
        <div style={{ position: "relative", overflow: "hidden", marginTop: 52, height: 112, borderRadius: 56, background: cor.texto, display: "flex", alignItems: "center", padding: "0 52px 0 10px", gap: 26, opacity: Math.min(1, eCta * 1.5), transform: `scale(${(0.86 + 0.14 * eCta) * respira})`, boxShadow: "0 30px 50px -22px rgba(17,17,17,0.55)" }}>
          <div style={{ width: 92, height: 92, borderRadius: 46, background: cor.azul, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${(1 - eCta) * -90}deg)` }}>
            <Icone n="pata" t={44} e={2} />
          </div>
          <span style={{ fontSize: 42, fontWeight: 700, color: cor.branco, letterSpacing: -0.6 }}>{t.cta}</span>
          {brilhoCta > 0 && brilhoCta < 1 ? (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(105deg, rgba(255,255,255,0) ${brilhoCta * 160 - 40}%, rgba(255,255,255,0.28) ${brilhoCta * 160 - 25}%, rgba(255,255,255,0) ${brilhoCta * 160 - 10}%)` }} />
          ) : null}
        </div>
        <div style={{ marginTop: 26, fontSize: 24, fontWeight: 500, color: "#566070", opacity: eNota }}>{t.nota}</div>
      </div>
      {/* Mascotes, pontuais, ao lado do celular */}
      <div style={{ position: "absolute", left: 80, top: 1230 + Math.sin(f * 0.06) * 8, transform: `scale(${pets[0]}) rotate(${(1 - pets[0]) * -20}deg)`, opacity: Math.min(1, pets[0] * 2) }}>
        <Avatar t={190} style={{ border: `8px solid ${cor.branco}`, boxShadow: "0 24px 40px -16px rgba(26,60,90,0.4)" }} />
      </div>
      <div style={{ position: "absolute", left: 790, top: 1080 + Math.sin(f * 0.06 + 2) * 8, transform: `scale(${pets[1]}) rotate(${(1 - pets[1]) * 20}deg)`, opacity: Math.min(1, pets[1] * 2) }}>
        <Avatar especie="gato" t={150} style={{ border: `7px solid ${cor.branco}`, boxShadow: "0 24px 40px -16px rgba(26,60,90,0.4)" }} />
      </div>
    </>
  );
};
