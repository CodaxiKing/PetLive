import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { local, sp } from "../base";
import { Brilho, Confete, Coracoes, FundoVivo, Reflexo } from "../fx";
import { Rex, RexCanto } from "../mascote";
import { BATIDAS, TEXTOS } from "../roteiro";
import { TelaMapa } from "../telas";
import { C, CLAMP } from "../theme";
import { Cena, Icone, NomeIcone, Pata, SeloMarca, Titulo, Topo } from "../ui";

/* ── Em breve ────────────────────────────────────────────────────────────── */

/** Card que vira em 3D (de costas para de frente) e fica flutuando. */
const Card: React.FC<{ em: number; x: number; y: number; rot: number; seed: number; titulo: string; fundo: string; cor: string; children: React.ReactNode }> = ({ em, x, y, rot, seed, titulo, fundo, cor, children }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const e = sp(f, fps, em, { damping: 11, stiffness: 120 });
  const vira = (1 - e) * 180;
  const bob = Math.sin((f + seed * 20) * 0.08) * 12;
  return (
    <div style={{ position: "absolute", left: x, top: y + bob, width: 360, height: 430, perspective: 1600, opacity: f < em ? 0 : 1 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 48,
          background: vira > 90 ? C.preto : C.branco,
          overflow: "hidden",
          boxShadow: "0 40px 80px rgba(42,33,28,0.22)",
          transform: `translateY(${(1 - e) * 200}px) rotateY(${vira}deg) rotate(${rot * e + Math.sin((f + seed * 30) * 0.05) * 2}deg)`,
        }}
      >
        {vira > 90 ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: "scaleX(-1)" }}>
            <Pata t={160} cor={C.azul} />
          </div>
        ) : (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 320, overflow: "hidden" }}>{children}</div>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 110, background: fundo, color: cor, fontSize: 46, fontWeight: 800, letterSpacing: -1.5, display: "flex", alignItems: "center", justifyContent: "center" }}>{titulo}</div>
          </>
        )}
      </div>
    </div>
  );
};

const Ilustracao: React.FC<{ n: NomeIcone; fundo: string; cor: string }> = ({ n, fundo, cor }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ width: "100%", height: "100%", background: fundo, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      <div style={{ position: "absolute", right: 30, top: 30, opacity: 0.35, transform: `rotate(${Math.sin(f * 0.1) * 15}deg)` }}>
        <Pata t={90} cor={cor} />
      </div>
      <div style={{ width: 180, height: 180, borderRadius: 180, background: C.branco, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + Math.sin(f * 0.18) * 0.06})` }}>
        <Icone n={n} t={100} cor={cor} e={1.8} />
      </div>
    </div>
  );
};

export const EmBreve: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = local("emBreve");
  const [c1, c2, c3] = BATIDAS.cards.map(b);
  const selo = sp(f, fps, 10, { damping: 8, stiffness: 180 });
  return (
    <Cena entrada="zoom">
      <FundoVivo cor={C.creme} tom="#FFE3A3" />
      <Topo />
      <Titulo l1="Em breve" cor={C.preto} tam={150} top={220} em={4} />
      <div style={{ position: "absolute", left: 760, top: 160, transform: `scale(${selo}) rotate(${14 + Math.sin(f * 0.1) * 6}deg)`, background: C.vinho, color: C.branco, fontSize: 36, fontWeight: 800, padding: "12px 26px", borderRadius: 40 }}>NOVIDADE</div>
      <Card em={c1} x={70} y={470} rot={-6} seed={0} titulo="Eventos pet" fundo={C.rosaClaro} cor={C.vinho}>
        <div style={{ width: 390, height: 844, transform: "scale(0.93)", transformOrigin: "0 0" }}>
          <TelaMapa eventos pinos={[c1 + 10, c1 + 14, c1 + 18, c1 + 22, c1 + 26]} />
        </div>
      </Card>
      <Card em={c2} x={590} y={540} rot={5} seed={1} titulo="Adoção" fundo={C.verdeClaro} cor={C.verde}>
        <Ilustracao n="coracao" fundo={C.amareloClaro} cor={C.vinho} />
      </Card>
      <Card em={c3} x={340} y={920} rot={-2} seed={2} titulo="Passeios" fundo={C.azulClaro} cor={C.azulForte}>
        <Ilustracao n="pino" fundo={C.heroi} cor={C.azulForte} />
      </Card>
      <Coracoes x={770} y={620} em={c2 + 12} n={5} />
      <RexCanto alegria={1} olhar={1} balao="?" emBalao={c1 + 4} />
      {[
        [80, 450, 0],
        [990, 520, 1],
        [300, 1300, 2],
      ].map(([x, y, s]) => (
        <Brilho key={s} x={x} y={y} tam={70} em={c1 + s * 6} seed={s} cor={C.laranja} />
      ))}
    </Cena>
  );
};

/* ── Fechamento ──────────────────────────────────────────────────────────── */

/** Fechamento: o Rex comemora, "Baixe grátis" bate e o endereço brilha. */
export const Cta: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = local("cta");
  const bg = b(BATIDAS.baixeGratis);
  const st = b(BATIDAS.site);
  const selo = sp(f, fps, 6, { damping: 8, stiffness: 160 });
  const baixe = sp(f, fps, bg, { damping: 8, stiffness: 220 });
  const site = sp(f, fps, st, { damping: 10, stiffness: 160 });
  const pulso = 1 + Math.max(0, Math.sin((f - st - 16) * 0.2)) * 0.05 * interpolate(f, [st + 16, st + 26], [0, 1], CLAMP);
  const lojas = sp(f, fps, st + 12, { damping: 14 });
  const rex = sp(f, fps, 12, { damping: 10, stiffness: 130 });
  const pulo = Math.abs(Math.sin(Math.max(0, f - 30) * 0.17)) * 60;
  return (
    <Cena entrada="sobe">
      <FundoVivo cor={C.noite} tom="#1E3A4F" patas="rgba(154,214,248,0.25)" />
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", transform: `scale(${selo}) rotate(${(1 - selo) * 180 + Math.sin(f * 0.07) * 5}deg)` }}>
        <SeloMarca t={220} fundo={C.azul} cor={C.preto} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 390, textAlign: "center", fontSize: 180, fontWeight: 800, letterSpacing: -7, color: C.branco }}>
        {"PetLive".split("").map((l, i) => {
          const e = sp(f, fps, 10 + i * 2, { damping: 8, stiffness: 200 });
          return (
            <span key={i} style={{ display: "inline-block", transform: `translateY(${(1 - e) * 160 + Math.sin(f * 0.15 + i * 0.7) * 6}px) scale(${e})` }}>{l}</span>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 610, textAlign: "center", fontSize: 130, fontWeight: 800, letterSpacing: -4, color: C.azul, transform: `scale(${f < bg ? 0 : 2.2 - 1.2 * baixe}) rotate(${(1 - baixe) * -8}deg)`, opacity: Math.min(1, baixe * 2), textShadow: "0 0 60px rgba(154,214,248,0.5)" }}>
        Baixe grátis
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 820, display: "flex", justifyContent: "center", transform: `scale(${site * pulso})`, opacity: Math.min(1, site * 2) }}>
        <div style={{ position: "relative", overflow: "hidden", background: C.azul, color: C.preto, fontSize: 84, fontWeight: 800, letterSpacing: -2, padding: "26px 70px", borderRadius: 999, boxShadow: "0 0 90px rgba(154,214,248,0.45)" }}>
          {TEXTOS.site}
          <Reflexo em={st + 10} a_cada={45} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1010, display: "flex", justifyContent: "center", gap: 20, opacity: lojas, transform: `translateY(${(1 - lojas) * 40}px)` }}>
        {TEXTOS.lojas.map((l) => (
          <div key={l} style={{ border: "3px solid rgba(255,255,255,0.45)", color: C.branco, fontSize: 40, fontWeight: 700, padding: "12px 34px", borderRadius: 999 }}>{l}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1100, textAlign: "center", fontSize: 38, fontWeight: 500, color: "rgba(255,255,255,0.7)", opacity: lojas }}>{TEXTOS.ctaRegiao}</div>
      <div style={{ position: "absolute", left: 360, top: 1180 - pulo, transform: `translateY(${(1 - rex) * 500}px)` }}>
        <Rex tam={360} alegria={1} />
      </div>
      <Confete x={540} y={880} em={st} n={110} forca={1.2} seed="cta" />
      {[
        [150, 300, 0],
        [930, 380, 1],
        [120, 900, 2],
        [960, 980, 3],
      ].map(([x, y, s]) => (
        <Brilho key={s} x={x} y={y} tam={64} em={20 + s * 5} seed={s} cor={C.azul} />
      ))}
    </Cena>
  );
};
