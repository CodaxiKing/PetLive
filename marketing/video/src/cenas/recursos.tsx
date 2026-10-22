import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { lerp, local, rampa, sp } from "../base";
import { Brilho, Confete, Coracoes, Ecg, FundoVivo, Radar } from "../fx";
import { RexCanto } from "../mascote";
import { BATIDAS } from "../roteiro";
import { TelaCalculadora, TelaLugar, TelaMapa, TelaPet, TelaRotina, TelaSOS, TelaSocorros } from "../telas";
import { C, CLAMP } from "../theme";
import { Camera, Celular3D, Cena, Icone, Pilula, Titulo, Toque, Topo } from "../ui";

/*
 * Celulares grandes (700 px) girando em 3D: a parte de baixo sai do quadro de
 * propósito, porque é onde a frase fica, e a câmera aproxima no que importa.
 */
const LARGURA = 700;
const ESQ = (1080 - LARGURA) / 2;

/** Troca de tela dentro do celular: a nova desliza da direita. */
const Troca: React.FC<{ em: number; antes: React.ReactNode; depois: React.ReactNode }> = ({ em, antes, depois }) => {
  const f = useCurrentFrame();
  const p = rampa(f, em, em + 12);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${-p * 30}%) scale(${1 - p * 0.08})`, opacity: 1 - p * 0.6 }}>{antes}</div>
      {p > 0 ? <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - p) * 100}%)`, boxShadow: "-10px 0 30px rgba(0,0,0,0.1)" }}>{depois}</div> : null}
    </>
  );
};

/* ── Vacinas ─────────────────────────────────────────────────────────────── */

export const Vacinas: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = local("vacinas");
  const nf = b(BATIDAS.notificacao);
  const toque = b(BATIDAS.toqueAplicada);
  const dose = b(BATIDAS.doseRegistrada);
  const noti = sp(f, fps, nf, { damping: 9, stiffness: 170 });
  const notiSai = rampa(f, dose + 8, dose + 18);
  const apertou = f >= toque && f < toque + 6;
  const registrada = rampa(f, dose, dose + 10);
  // O sino toca: balança forte e vai parando.
  const sino = f >= nf ? Math.sin((f - nf) * 0.9) * 28 * Math.exp(-(f - nf) / 22) : 0;
  return (
    <Cena entrada="lado">
      <FundoVivo cor={C.ceu} tom="#BFE3F7" />
      <Topo />
      <Titulo l1="Vacinas e remédios" l2="sempre em dia" cor={C.azulEscuro} marca="rgba(154,214,248,0.7)" tam={100} em={6} />
      <Camera
        quadros={[
          { f: 0, s: 1, x: 0, y: 0 },
          { f: dose, s: 1, x: 0, y: 0 },
          { f: dose + 20, s: 1.08, x: 0, y: 30 },
        ]}
      >
        <Celular3D largura={LARGURA} left={ESQ} top={500} em={4}>
          <TelaPet registrada={registrada} />
        </Celular3D>
        <Coracoes x={540} y={760} em={dose + 4} n={10} />
      </Camera>
      {/* Notificação do sistema com a ação "Aplicada". */}
      <div
        style={{
          position: "absolute",
          left: 80,
          width: 860,
          top: lerp(-260, 470, noti) - notiSai * 700,
          height: 170,
          borderRadius: 44,
          background: C.branco,
          boxShadow: "0 30px 60px rgba(42,33,28,0.22)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "0 24px",
          boxSizing: "border-box",
          transform: `rotate(${(1 - noti) * -6}deg)`,
        }}
      >
        <div style={{ width: 96, height: 96, borderRadius: 26, background: C.preto, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${sino}deg)`, transformOrigin: "50% 10%" }}>
          <Icone n="sino" t={58} cor={C.azul} e={2.4} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 30, color: C.textoApoio, fontWeight: 600 }}>PETLIVE · agora</div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: -1, color: C.preto, whiteSpace: "nowrap" }}>Vacina V10 do Rex em 5 dias</div>
        </div>
        <div style={{ position: "relative", background: C.preto, color: C.branco, fontSize: 36, fontWeight: 800, padding: "16px 26px", borderRadius: 60, transform: `scale(${apertou ? 0.85 : 1 + Math.max(0, Math.sin((f - nf - 20) * 0.2)) * 0.06 * (f < toque ? 1 : 0)})` }}>
          Aplicada
          <Toque x={110} y={42} em={toque} />
        </div>
      </div>
      <Confete x={540} y={1180} em={dose} n={90} seed="dose" />
      <Pilula x={540} y={1180} em={dose} fundo={C.verde} cor={C.branco} tam={64}>
        <Icone n="check" t={64} cor={C.branco} e={3} /> Dose registrada
      </Pilula>
      {[
        [220, 1080, 0],
        [870, 1100, 1],
        [800, 1260, 2],
      ].map(([x, y, s]) => (
        <Brilho key={s} x={x} y={y} tam={60} em={dose + 4 + s * 3} seed={s} cor="#FFD66B" />
      ))}
    </Cena>
  );
};

/* ── Lugares ─────────────────────────────────────────────────────────────── */

/** Escala do mapa em tela cheia: a tela lógica de 390 px ocupa os 1080 px. */
const ESCALA_MAPA = 1080 / 390;
/** Corta o topo do mapa (busca e filtros), que ficaria embaixo do título. */
const CORTE_MAPA = 60;

/**
 * Mapa em tela cheia, sem celular: os marcadores caem, a rota é desenhada e,
 * na hora do local, a tela dele sobe como um cartão flutuante.
 */
export const Lugares: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const b = local("lugares");
  const [p1, p2, p3, p4] = BATIDAS.pilulas.map(b);
  const troca = b(BATIDAS.telaLugar);
  const rota = b(BATIDAS.rota);
  const cartao = sp(f, fps, troca, { damping: 13, stiffness: 110 });
  return (
    <Cena entrada="zoom">
      <Camera
        quadros={[
          { f: 0, s: 1.12, x: 0, y: 0 },
          { f: rota, s: 1.04, x: 0, y: 0 },
          { f: rota + 24, s: 1.18, x: 90, y: 60 },
          { f: troca + 20, s: 1.1, x: 60, y: 40 },
        ]}
      >
        <div style={{ position: "absolute", left: 0, top: -CORTE_MAPA * ESCALA_MAPA, width: 390, height: 844, transform: `scale(${ESCALA_MAPA})`, transformOrigin: "0 0" }}>
          <TelaMapa limpo pinos={BATIDAS.pinos.map(b)} rota={rota} />
        </div>
      </Camera>
      {/* Faixa em menta no topo para o título ler bem sobre o mapa. */}
      <AbsoluteFill style={{ background: `linear-gradient(to bottom, ${C.menta} 0%, ${C.menta} 20%, rgba(214,240,226,0) 34%)` }} />
      <AbsoluteFill style={{ background: "rgba(17,17,17,0.35)", opacity: cartao }} />
      <Topo />
      <Titulo l1="Lugares pet" l2="por perto" cor={C.verde} marca="rgba(143,224,176,0.8)" tam={110} em={6} />
      {/* As categorias saem quando o cartão do local sobe. */}
      <AbsoluteFill style={{ opacity: 1 - rampa(f, troca, troca + 10) }}>
        <Pilula x={250} y={640} em={p1} fundo={C.branco} cor={C.preto} tam={58} seed={1}>
          <Icone n="mais" t={50} cor={C.azulForte} e={3} /> Clínicas
        </Pilula>
        <Pilula x={790} y={790} em={p2} fundo={C.rosaClaro} cor={C.vinho} tam={58} seed={2}>
          <Icone n="coracao" t={50} cor={C.vinho} e={3} /> Petshops
        </Pilula>
        <Pilula x={240} y={980} em={p3} fundo={C.roxoClaro} cor={C.roxo} tam={58} seed={3}>
          <Icone n="casa" t={50} cor={C.roxo} e={3} /> Creches
        </Pilula>
        <Pilula x={760} y={1150} em={p4} fundo={C.amareloClaro} cor={C.amarelo} tam={58} seed={4}>
          <Icone n="relogio" t={50} cor={C.amarelo} e={3} /> Hotelzinhos
        </Pilula>
      </AbsoluteFill>
      {f >= troca ? (
        <Celular3D largura={720} left={180} top={520} em={troca} giro={6} semMoldura>
          <TelaLugar />
        </Celular3D>
      ) : null}
      <RexCanto alegria={0.75} fareja={f < troca} balao={f < troca ? "?" : "coracao"} emBalao={f < troca ? 20 : troca + 8} />
    </Cena>
  );
};

/* ── Emergência ──────────────────────────────────────────────────────────── */

/**
 * A câmera entra no celular até o card da clínica 24 h encher a tela e volta
 * nos primeiros socorros. O Rex se assusta e se acalma junto com o ritmo.
 */
export const Emergencia: React.FC = () => {
  const f = useCurrentFrame();
  const b = local("emergencia");
  const c24 = b(BATIDAS.clinica24h);
  const troca = b(BATIDAS.telaSocorros);
  const realce = interpolate(f, [c24, c24 + 8, troca - 6, troca], [0, 1, 1, 0], CLAMP) * (0.75 + 0.25 * Math.sin(f * 0.3));
  // Batimento do fundo: rápido no alerta, calmo depois dos primeiros socorros.
  const ritmo = f < troca ? 0.35 : 0.12;
  const batida = Math.pow(Math.max(0, Math.sin(f * ritmo)), 6);
  const calma = rampa(f, troca, troca + 30);
  const tituloSome = interpolate(f, [c24, c24 + 10, troca, troca + 14], [0, 1, 1, 0], CLAMP);
  return (
    <Cena entrada="lado">
      <FundoVivo cor={C.rosa} tom="#F6B9C6" />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, transparent 40%, rgba(163,48,79,${0.28 * batida * (1 - calma * 0.7)}) 100%)` }} />
      <Topo />
      <div style={{ opacity: 1 - tituloSome, transform: `scale(${1 + batida * 0.05 * (1 - calma)}) rotate(${Math.sin(f * 0.9) * 1.2 * (1 - calma) * (f < c24 ? 1 : 0)}deg)` }}>
        <Titulo l1="Emergência?" cor={C.vinho} tam={150} top={210} em={6} />
      </div>
      <div style={{ opacity: (1 - tituloSome) * 0.9 }}>
        <Ecg y={380} cor={C.vinho} em={10} />
      </div>
      <Camera
        quadros={[
          { f: 0, s: 1, x: 0, y: 0 },
          { f: c24, s: 1, x: 0, y: 0 },
          { f: c24 + 20, s: 1.75, x: 0, y: -100 },
          { f: troca, s: 1.8, x: 0, y: -110 },
          { f: troca + 20, s: 1.04, x: 0, y: -20 },
        ]}
      >
        <Celular3D largura={LARGURA} left={ESQ} top={490} em={4} giro={5}>
          <Troca em={troca} antes={<TelaSOS realce={realce} />} depois={<TelaSocorros />} />
        </Celular3D>
        {f < troca ? <Radar x={540} y={927} cor={C.vinho} em={c24} tam={420} /> : null}
      </Camera>
      <Pilula x={540} y={480} em={b(BATIDAS.semInternet)} fundo={C.verdeClaro} cor={C.verde} tam={60}>
        <Icone n="escudo" t={56} cor={C.verde} e={2.6} /> Funciona sem internet
      </Pilula>
      <RexCanto alegria={lerp(0.2, 0.9, calma)} susto={1 - calma} balao={f < troca ? "!" : "coracao"} emBalao={f < troca ? 14 : troca + 10} />
    </Cena>
  );
};

/* ── Cuidados ────────────────────────────────────────────────────────────── */

const LEMBRETES = [
  { t: "Antipulgas", s: "Todo mês, dia 10", fundo: C.azulClaro, cor: C.azulForte, x: 50, y: 640, rot: -6 },
  { t: "Vermífugo", s: "A cada 3 meses", fundo: C.roxoClaro, cor: C.roxo, x: 590, y: 800, rot: 5 },
  { t: "Banho", s: "A cada 15 dias", fundo: C.amareloClaro, cor: C.amarelo, x: 50, y: 980, rot: -4 },
  { t: "Aniversário", s: "18/11 · do Rex", fundo: C.rosaClaro, cor: C.vinho, x: 590, y: 1150, rot: 6 },
];

/** Lembrete que salta de dentro do celular e liga a chave ao pousar. */
const Lembrete: React.FC<{ i: number; em: number }> = ({ i, em }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const l = LEMBRETES[i];
  const e = sp(f, fps, em, { damping: 11, stiffness: 120 });
  const liga = sp(f, fps, em + 14, { damping: 10, stiffness: 240 });
  if (f < em) return null;
  const bob = Math.sin((f + i * 17) * 0.08) * 10;
  return (
    <div
      style={{
        position: "absolute",
        left: lerp(320, l.x, e),
        top: lerp(1000, l.y, e) + bob,
        width: 440,
        height: 130,
        borderRadius: 36,
        background: l.fundo,
        boxShadow: "0 30px 60px rgba(42,33,28,0.22)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 30px",
        boxSizing: "border-box",
        transform: `scale(${lerp(0.3, 1, e)}) rotate(${l.rot * e + Math.sin((f + i * 11) * 0.06) * 2}deg)`,
        opacity: Math.min(1, e * 2),
      }}
    >
      <div>
        <div style={{ fontSize: 40, fontWeight: 800, color: C.preto, letterSpacing: -1 }}>{l.t}</div>
        <div style={{ fontSize: 26, fontWeight: 600, color: l.cor }}>{l.s}</div>
      </div>
      <div style={{ width: 96, height: 54, borderRadius: 54, background: liga > 0.5 ? C.preto : C.bordaForte, position: "relative", transform: `scale(${1 + Math.sin(liga * Math.PI) * 0.15})` }}>
        <div style={{ position: "absolute", top: 6, left: lerp(6, 48, liga), width: 42, height: 42, borderRadius: 42, background: liga > 0.5 ? C.azul : C.branco }} />
      </div>
    </div>
  );
};

/**
 * Calculadora no celular e, na hora da rotina, a tela troca e os lembretes
 * saltam para fora dela, cada um ligando a chave com um brilho.
 */
export const Cuidados: React.FC = () => {
  const f = useCurrentFrame();
  const b = local("cuidados");
  const tr = b(BATIDAS.telaRotina);
  const fora = rampa(f, tr + 4, tr + 20);
  return (
    <Cena entrada="circulo" cx={540} cy={1300}>
      <FundoVivo cor={C.lavanda} tom="#D2C0F2" />
      <Topo />
      <Titulo l1="Ração, idade" l2="e rotina de cuidados" cor={C.roxo} marca="rgba(201,168,245,0.6)" tam={96} em={6} />
      <AbsoluteFill style={{ transform: `scale(${1 - 0.1 * fora})`, filter: `brightness(${1 - 0.12 * fora})` }}>
        <Celular3D largura={620} left={230} top={520} em={4} giro={7}>
          <Troca em={tr} antes={<TelaCalculadora />} depois={<TelaRotina ligadas={0} />} />
        </Celular3D>
      </AbsoluteFill>
      {LEMBRETES.map((l, i) => (
        <React.Fragment key={i}>
          <Lembrete i={i} em={tr + 6 + i * 6} />
          <Brilho x={l.x + 420} y={l.y + 10} tam={60} em={tr + 20 + i * 6} seed={i} cor="#FFD66B" />
        </React.Fragment>
      ))}
      <RexCanto alegria={1} balao="coracao" emBalao={tr + 30} />
    </Cena>
  );
};
