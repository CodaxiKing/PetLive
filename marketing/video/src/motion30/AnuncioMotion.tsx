import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fontFamily } from "../theme";
import { BarraStatus, cor, IndicadorHome } from "./app";
import { Bokeh, borraoMovimento, Confirmacao, EtiquetaDestaque, Feixe, Grao, Halo, varreduraEm, VarreduraLuz } from "./efeitos";
import { aperto, idaEVolta, mola, rampa } from "./movimento";
import { Celular, Destaque, Fundo, naTela, pose, SombraChao, Toque } from "./palco";
import { BATIDAS, CENAS, DADOS, DURACAO, NomeCena, TEXTOS } from "./roteiro";
import { AvisoDose, BlocoVacinas, CartaoRemedio, ChipsPets, FichaLugar, PONTO_CARTEIRINHA, PONTO_DOSE, PINOS, PONTO_PINO, POS_FICHA, POS_REMEDIO, POS_VACINAS, TelaCarteirinha, TelaInicio, TelaMapa, TelaPerfil, TelaRemedios } from "./telas";
import { CardsGancho, Fechamento, Titulo } from "./textos";

/*
 * Anúncio vertical de 30 s, totalmente silencioso (nenhum <Audio> aqui).
 * O celular é o protagonista: um único aparelho atravessa o vídeo, com as
 * telas trocando dentro dele; os títulos explicam cada benefício.
 */

type NomeTela = "perfil" | "inicio" | "carteirinha" | "remedios" | "mapa";
type Troca = { f: number; tela: NomeTela; tipo: "push" | "pop" | "fade" };

/** Navegação dentro do celular. */
const TROCAS: Troca[] = [
  { f: 0, tela: "perfil", tipo: "fade" },
  { f: BATIDAS.voltaInicio, tela: "inicio", tipo: "pop" },
  { f: BATIDAS.abreCarteirinha, tela: "carteirinha", tipo: "push" },
  { f: BATIDAS.abreRemedios, tela: "remedios", tipo: "push" },
  { f: BATIDAS.abreMapa, tela: "mapa", tipo: "fade" },
  { f: BATIDAS.voltaInicioFinal, tela: "inicio", tipo: "fade" },
];
const DUR_TROCA = 16;

const fimDaCena = (c: NomeCena) => {
  const ordem = Object.keys(CENAS) as NomeCena[];
  const i = ordem.indexOf(c);
  return i < ordem.length - 1 ? CENAS[ordem[i + 1]] : DURACAO;
};

export const AnuncioMotion: React.FC = () => {
  const f = useCurrentFrame();
  const p = pose(f);
  const borrao = borraoMovimento(p, pose(f - 1));

  // Estados das interações
  const chipsFora = idaEVolta(f, 124, 164);
  const vacinasFora = idaEVolta(f, BATIDAS.vacinasSai, BATIDAS.vacinasVolta);
  const doseFora = idaEVolta(f, BATIDAS.doseSai, BATIDAS.doseVolta);
  const cardFora = idaEVolta(f, BATIDAS.cardSai, BATIDAS.cardVolta);
  const dada = rampa(f, BATIDAS.toqueDose + 1, BATIDAS.toqueDose + 12);
  const pinos = BATIDAS.pinos.map((em) => mola(f, em, { damping: 13, stiffness: 170 }));
  const selecionado = mola(f, BATIDAS.toquePino + 2, { damping: 16, stiffness: 160 });
  const card = mola(f, BATIDAS.cardSobe, { damping: 22, stiffness: 140 });

  const tela = (nome: NomeTela) => {
    switch (nome) {
      case "perfil":
        return <TelaPerfil />;
      case "inicio":
        return <TelaInicio apertado={aperto(f, BATIDAS.toqueCarteirinha)} chipsFora={chipsFora > 0 ? 1 : 0} />;
      case "carteirinha":
        return <TelaCarteirinha vacinasFora={vacinasFora > 0 ? 1 : 0} />;
      case "remedios":
        return <TelaRemedios dada={dada} apertado={aperto(f, BATIDAS.toqueDose)} cartaoFora={doseFora > 0 ? 1 : 0} />;
      case "mapa":
        return <TelaMapa pinos={pinos} selecionado={selecionado} card={card} cardFora={cardFora > 0 ? 1 : 0} pulso={(f % 45) / 45} />;
    }
  };

  // Tela atual e, durante a troca, a anterior.
  const i = TROCAS.reduce((acc, t, k) => (f >= t.f ? k : acc), 0);
  const atual = TROCAS[i];
  const anterior = i > 0 ? TROCAS[i - 1] : null;
  const t = rampa(f, atual.f, atual.f + DUR_TROCA);
  const emTroca = anterior && t < 1;
  const camadas: React.ReactNode[] = [];
  if (emTroca && anterior) {
    const velha: React.CSSProperties =
      atual.tipo === "push"
        ? { transform: `translateX(${-t * 110}px)` }
        : atual.tipo === "pop"
          ? { transform: `translateX(${t * 390}px)`, zIndex: 2, boxShadow: "-12px 0 30px rgba(17,17,17,0.12)" }
          : { opacity: 1 - Math.min(1, t * 1.8), transform: `scale(${1 - 0.03 * t})` };
    camadas.push(
      <div key="velha" style={{ position: "absolute", inset: 0, ...velha }}>
        {tela(anterior.tela)}
        {atual.tipo === "push" ? <div style={{ position: "absolute", inset: 0, background: `rgba(17,17,17,${0.12 * t})` }} /> : null}
      </div>,
    );
  }
  const nova: React.CSSProperties = !emTroca
    ? {}
    : atual.tipo === "push"
      ? { transform: `translateX(${(1 - t) * 390}px)`, boxShadow: "-12px 0 30px rgba(17,17,17,0.12)", zIndex: 2 }
      : atual.tipo === "pop"
        ? { transform: `translateX(${-(1 - t) * 110}px)` }
        : { opacity: Math.max(0, t * 1.6 - 0.6), transform: `translateY(${(1 - t) * 24}px)`, zIndex: 2 };
  camadas.push(
    <div key="nova" style={{ position: "absolute", inset: 0, ...nova }}>
      {tela(atual.tela)}
      {emTroca && atual.tipo === "pop" ? <div style={{ position: "absolute", inset: 0, background: `rgba(17,17,17,${0.12 * (1 - t)})` }} /> : null}
    </div>,
  );

  // Aviso da dose, que desce do topo da tela.
  const aviso = f < BATIDAS.avisoSai ? mola(f, BATIDAS.avisoEntra, { damping: 18, stiffness: 140 }) : 1 - rampa(f, BATIDAS.avisoSai, BATIDAS.avisoSai + 12);

  const titulo = (c: NomeCena, texto: { l1: string; l2: string; etiqueta?: string }, marca = false, adianta = 0) =>
    f >= CENAS[c] && f < fimDaCena(c) ? <Titulo f={f - CENAS[c]} dur={fimDaCena(c) - CENAS[c]} l1={texto.l1} l2={texto.l2} etiqueta={texto.etiqueta} marca={marca} adianta={adianta} /> : null;

  const centroCelular = naTela(p, 195, 422);

  // Foco: com um card fora, o celular recua um pouco (luz e nitidez).
  const foco = Math.max(chipsFora, vacinasFora, doseFora, cardFora);
  const luz = varreduraEm(f, [8, BATIDAS.voltaInicio + 2, BATIDAS.abreCarteirinha + 4, BATIDAS.abreRemedios + 4, BATIDAS.abreMapa + 6, BATIDAS.voltaInicioFinal + 8]);
  const filtro = [borrao > 0.2 ? `blur(${borrao.toFixed(2)}px)` : "", foco > 0 ? `blur(${(foco * 1.2).toFixed(2)}px) brightness(${1 - foco * 0.06}) saturate(${1 - foco * 0.2})` : ""].join(" ").trim();
  const T = TEXTOS.destaques;

  return (
    <AbsoluteFill style={{ fontFamily, color: "#111111", overflow: "hidden" }}>
      <Fundo f={f} />
      <Feixe f={f} />
      <Bokeh f={f} p={p} />
      <SombraChao p={p} />

      <AbsoluteFill style={{ filter: filtro || undefined }}>
      <Celular p={p}>
        {camadas}
        {f >= BATIDAS.pinos[0] && f < BATIDAS.voltaInicioFinal
          ? PINOS.map((pin, k) => {
              const t = rampa(f, BATIDAS.pinos[k] + 5, BATIDAS.pinos[k] + 26);
              return t > 0 && t < 1 ? (
                <div key={pin.c} style={{ position: "absolute", left: pin.x - 30, top: pin.y - 10, width: 60, height: 20, borderRadius: "50%", border: `2px solid ${cor.azulEscuro}`, opacity: (1 - t) * 0.5, transform: `scale(${0.4 + t * 1.4})`, zIndex: 0 }} />
              ) : null;
            })
          : null}
        {f < BATIDAS.voltaInicioFinal ? <Halo f={f} de={BATIDAS.toquePino + 4} x={PINOS[0].x} y={PINOS[0].y - 40} intensidade={selecionado} /> : null}
        <Confirmacao f={f} em={BATIDAS.toqueDose + 2} x={PONTO_DOSE.x} y={PONTO_DOSE.y} />
        <VarreduraLuz t={luz} />
        {aviso > 0 && f >= BATIDAS.avisoEntra ? (
          <div style={{ position: "absolute", left: 12, top: 52 + (1 - aviso) * -150, opacity: Math.min(1, aviso * 2), zIndex: 40 }}>
            <AvisoDose />
          </div>
        ) : null}
        <Toque f={f} em={BATIDAS.toqueCarteirinha} x={PONTO_CARTEIRINHA.x} y={PONTO_CARTEIRINHA.y} />
        <Toque f={f} em={BATIDAS.toqueDose} x={PONTO_DOSE.x} y={PONTO_DOSE.y} />
        <Toque f={f} em={BATIDAS.toquePino} x={PONTO_PINO.x} y={PONTO_PINO.y} />
        <BarraStatus hora={DADOS.hora} />
        <IndicadorHome />
      </Celular>
      </AbsoluteFill>

      {/* Luz suave atrás do card ampliado */}
      {foco > 0 ? <div style={{ position: "absolute", left: 40, right: 40, top: 760, height: 900, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,255,255,0.75), rgba(255,255,255,0))", opacity: foco }} /> : null}

      {f < 110 ? <CardsGancho f={f} alvo={centroCelular} /> : null}

      {/* Cards que saem do celular e voltam */}
      <Destaque pose={p} p={chipsFora} x={24} y={172} w={250} alvoY={1070} alvoS={3.5}>
        <ChipsPets />
      </Destaque>
      <Destaque pose={p} p={vacinasFora} x={POS_VACINAS.x} y={POS_VACINAS.y} w={POS_VACINAS.w} alvoY={930} alvoS={2.25}>
        <BlocoVacinas />
      </Destaque>
      <Destaque pose={p} p={doseFora} x={POS_REMEDIO.x} y={POS_REMEDIO.y} w={POS_REMEDIO.w} alvoY={980} alvoS={2.2}>
        <CartaoRemedio dada={1} />
      </Destaque>
      <Destaque pose={p} p={cardFora} x={POS_FICHA.x} y={POS_FICHA.y} w={POS_FICHA.w} alvoY={1000} alvoS={2.2}>
        <FichaLugar />
      </Destaque>
      <EtiquetaDestaque p={chipsFora} y={966} texto={T.pets} icone="pata" fundo={cor.azulClaro} c={cor.azulEscuro} />
      <EtiquetaDestaque p={vacinasFora} y={826} texto={T.vacinas} icone="vacina" fundo={cor.rosaClaro} c={cor.rosa} />
      <EtiquetaDestaque p={doseFora} y={876} texto={T.dose} icone="check" fundo={cor.verdeClaro} c={cor.verde} />
      <EtiquetaDestaque p={cardFora} y={896} texto={T.lugar} icone="local" fundo={cor.azulClaro} c={cor.azulEscuro} />

      {titulo("gancho", TEXTOS.gancho, false, 12)}
      {titulo("marca", TEXTOS.marca, true)}
      {titulo("saude", TEXTOS.saude)}
      {titulo("rotina", TEXTOS.rotina)}
      {titulo("lugares", TEXTOS.lugares)}
      {f >= CENAS.fechamento ? <Fechamento f={f - CENAS.fechamento} /> : null}

      <Grao />
      {/* Vinheta suave nas bordas */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(120% 80% at 50% 40%, rgba(255,255,255,0) 60%, rgba(26,60,90,0.06) 100%)" }} />
    </AbsoluteFill>
  );
};
