import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Rex } from "./mascote";
import { C, CLAMP } from "./theme";
import { Icone, NomeIcone } from "./ui";

/*
 * Telas do app redesenhadas a partir do protótipo (prototipo/*.dc.html), em
 * coordenadas de 390×844. Os locais e números são exemplos fictícios,
 * só para ilustrar (no protótipo eles ficam entre [colchetes]).
 */

const Onda: React.FC<{ cor?: string; y: number }> = ({ cor = C.branco, y }) => (
  <svg style={{ position: "absolute", left: 0, top: y }} width={390} height={40} viewBox="0 0 390 40" preserveAspectRatio="none">
    <path d="M0 20 C 60 0, 110 0, 170 18 S 300 40, 390 12 L390 40 L0 40 Z" fill={cor} />
  </svg>
);

const BotaoRedondo: React.FC<{ n: NomeIcone; x: number; y: number }> = ({ n, x, y }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 40, height: 40, borderRadius: 40, background: C.branco, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(42,33,28,0.08)" }}>
    <Icone n={n} t={18} />
  </div>
);

/** Cabeçalho azul com onda, comum às telas internas. */
const Cabecalho: React.FC<{ sub: string; titulo: string; cor?: string; selo?: string; altura?: number }> = ({ sub, titulo, cor = C.azul, selo, altura = 170 }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: altura, background: cor }}>
    <BotaoRedondo n="voltar" x={20} y={44} />
    {selo ? <div style={{ position: "absolute", right: 20, top: 52, background: C.verdeClaro, color: C.verde, fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>{selo}</div> : null}
    <div style={{ position: "absolute", left: 22, top: 98, fontSize: 13, color: C.azulEscuro, fontWeight: 500 }}>{sub}</div>
    <div style={{ position: "absolute", left: 22, top: 114, fontSize: 26, color: C.texto, fontWeight: 500, letterSpacing: -0.6 }}>{titulo}</div>
    <Onda y={altura - 30} />
  </div>
);

/** Barra de ação escura do rodapé, com o círculo azul do ícone. */
export const BarraAcao: React.FC<{ texto: string; n: NomeIcone; top?: number; left?: number; width?: number; destaque?: number }> = ({ texto, n, top = 762, left = 22, width = 346, destaque = 0 }) => (
  <div style={{ position: "absolute", left, top, width, height: 56, borderRadius: 56, background: C.preto, display: "flex", alignItems: "center", transform: `scale(${1 - destaque * 0.05})` }}>
    <div style={{ width: 44, height: 44, borderRadius: 44, background: C.azul, marginLeft: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone n={n} t={20} />
    </div>
    <div style={{ flex: 1, textAlign: "center", color: C.branco, fontSize: 15, fontWeight: 700, marginRight: 50 }}>{texto}</div>
  </div>
);

const Linha: React.FC<{ n: NomeIcone; rotulo: string; valor: string; top: number; fundo?: string }> = ({ n, rotulo, valor, top, fundo = C.fundoTela }) => (
  <div style={{ position: "absolute", left: 22, top, width: 346, height: 54, borderRadius: 16, background: fundo, display: "flex", alignItems: "center" }}>
    <div style={{ width: 34, height: 34, borderRadius: 34, background: C.branco, marginLeft: 10, marginRight: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone n={n} t={16} />
    </div>
    <div>
      <div style={{ fontSize: 10.5, color: C.textoApoio }}>{rotulo}</div>
      <div style={{ fontSize: 13.5, color: C.texto, fontWeight: 600 }}>{valor}</div>
    </div>
  </div>
);

const Chip: React.FC<{ texto: string; fundo: string; cor: string }> = ({ texto, fundo, cor }) => (
  <span style={{ background: fundo, color: cor, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>{texto}</span>
);

/* ── Pet (vacinas) ───────────────────────────────────────────────────────── */

/** `registrada` 0→1 marca a dose como aplicada; o Rex fica feliz junto. */
export const TelaPet: React.FC<{ registrada?: number }> = ({ registrada = 0 }) => (
  <div style={{ position: "absolute", inset: 0, background: C.branco }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: 300, background: C.heroi, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 65, top: 20 }}>
        <Rex tam={260} alegria={0.45 + 0.55 * registrada} />
      </div>
      <Onda y={270} />
    </div>
    <BotaoRedondo n="voltar" x={20} y={44} />
    <BotaoRedondo n="compartilhar" x={278} y={44} />
    <BotaoRedondo n="coracao" x={330} y={44} />
    <div style={{ position: "absolute", left: 22, top: 300, fontSize: 32, fontWeight: 500, letterSpacing: -1 }}>Rex</div>
    <div style={{ position: "absolute", right: 22, top: 310 }}>
      {registrada > 0.5 ? <Chip texto="Vacinas em dia" fundo={C.verdeClaro} cor={C.verde} /> : <Chip texto="V10 vence em 5 dias" fundo={C.rosaClaro} cor={C.vinho} />}
    </div>
    {[
      ["Macho", "Sexo", C.roxoClaro, C.roxo],
      ["3 anos", "Idade", C.amareloClaro, C.amarelo],
      ["28 kg", "Peso", C.verdeClaro, C.verde],
    ].map(([v, r, fundo, cor], i) => (
      <div key={i} style={{ position: "absolute", left: 22 + i * 120, top: 356, width: 106, height: 58, borderRadius: 16, background: fundo, textAlign: "center", paddingTop: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.texto }}>{v}</div>
        <div style={{ fontSize: 11, color: cor }}>{r}</div>
      </div>
    ))}
    <div style={{ position: "absolute", left: 22, top: 436, display: "flex", gap: 22, fontSize: 14 }}>
      <span style={{ fontWeight: 700, borderBottom: `2px solid ${C.azul}`, paddingBottom: 4 }}>Vacinas</span>
      <span style={{ color: C.textoApoio }}>Peso</span>
      <span style={{ color: C.textoApoio }}>Consultas</span>
    </div>
    {[
      { nome: "V10", data: registrada > 0.5 ? "Aplicada hoje" : "Aplicada em 12/09/25", fim: registrada > 0.5 ? "próx. 2027" : "em 5 dias", fundo: C.azul },
      { nome: "Antirrábica", data: "Aplicada em 30/11/25", fim: "30/11/26", fundo: C.roxoClaro },
    ].map((v, i) => (
      <div key={i} style={{ position: "absolute", left: 22, top: 478 + i * 70, width: 346, height: 58, borderRadius: 16, background: i === 0 && registrada > 0 ? `rgba(221,243,230,${registrada})` : C.fundoTela, display: "flex", alignItems: "center" }}>
        <div style={{ width: 34, height: 34, borderRadius: 34, background: v.fundo, margin: "0 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n={i === 0 && registrada > 0.5 ? "check" : "diamante"} t={15} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{v.nome}</div>
          <div style={{ fontSize: 11, color: C.textoApoio }}>{v.data}</div>
        </div>
        <div style={{ background: C.branco, fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 20, marginRight: 12 }}>{v.fim}</div>
      </div>
    ))}
    <BarraAcao texto="Registrar vacina" n="mais" />
  </div>
);

/* ── Mapa e lugar ────────────────────────────────────────────────────────── */

const Ruas: React.FC = () => (
  <svg style={{ position: "absolute", left: 0, top: 0 }} width={390} height={844}>
    <rect width={390} height={844} fill="#EDF1F5" />
    <ellipse cx={20} cy={180} rx={90} ry={80} fill="#CFE6F7" />
    <rect x={240} y={210} width={90} height={60} rx={14} fill="#D7EEDD" />
    <rect x={30} y={500} width={70} height={70} rx={14} fill="#D7EEDD" />
    {[160, 320, 470].map((y) => (
      <rect key={y} x={0} y={y + 60} width={390} height={14} fill={C.branco} />
    ))}
    {[70, 180, 290].map((x) => (
      <rect key={x} x={x} y={0} width={14} height={844} fill={C.branco} />
    ))}
  </svg>
);

const Marcador: React.FC<{ x: number; y: number; n: NomeIcone; fundo: string; t?: number; em?: number }> = ({ x, y, n, fundo, t = 30, em = -99 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Cai do alto e quica no lugar.
  const e = spring({ frame: Math.max(0, f - em), fps, config: { damping: 8, stiffness: 200 } });
  return (
  <div style={{ position: "absolute", left: x - t / 2, top: y - t / 2 - (1 - e) * 160, opacity: Math.min(1, e * 3), transform: `scale(${0.6 + 0.4 * e})`, width: t, height: t, borderRadius: t, background: fundo, border: `3px solid ${C.branco}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.12)" }}>
    <Icone n={n} t={t * 0.5} />
  </div>
  );
};

/**
 * `pinos`: quadros em que cada marcador cai no mapa. `rota`: quadro em que a
 * rota até a clínica começa a ser desenhada. `limpo`: só o mapa, sem barra de
 * busca, filtros, card e menu (para usar em tela cheia).
 */
export const TelaMapa: React.FC<{ eventos?: boolean; pinos?: number[]; rota?: number; limpo?: boolean }> = ({ eventos = false, pinos = [], rota = -1, limpo = false }) => {
  const f = useCurrentFrame();
  const p = (i: number) => pinos[i] ?? -99;
  const desenho = rota < 0 ? 0 : interpolate(f, [rota, rota + 20], [0, 1], CLAMP);
  const pulso = (f % 40) / 40;
  return (
  <div style={{ position: "absolute", inset: 0 }}>
    <Ruas />
    {limpo ? null : <BotaoRedondo n="voltar" x={18} y={46} />}
    {limpo ? null : eventos ? (
      <div style={{ position: "absolute", left: 68, top: 46, width: 300, height: 40, borderRadius: 40, background: C.branco, display: "flex", padding: 4, gap: 4, fontSize: 13 }}>
        <div style={{ flex: 1, textAlign: "center", lineHeight: "32px", color: C.textoApoio }}>Lugares</div>
        <div style={{ flex: 1, textAlign: "center", lineHeight: "32px", background: C.preto, color: C.branco, borderRadius: 32, fontWeight: 700 }}>Eventos</div>
      </div>
    ) : (
      <div style={{ position: "absolute", left: 68, top: 46, width: 300, height: 40, borderRadius: 40, background: C.branco, display: "flex", alignItems: "center", gap: 8, paddingLeft: 14, fontSize: 13, color: C.textoApoio }}>
        <Icone n="busca" t={16} cor={C.textoApoio} /> Buscar lugares pet
      </div>
    )}
    <div style={{ position: "absolute", left: 18, top: 100, display: limpo ? "none" : "flex", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
      {(eventos ? ["Hoje", "Esta semana", "Adoção", "Vacinação"] : ["Todos", "Clínicas", "Petshops", "Creches"]).map((t, i) => (
        <span key={t} style={{ padding: "7px 14px", borderRadius: 20, background: i === (eventos ? 1 : 0) ? C.preto : C.branco, color: i === (eventos ? 1 : 0) ? C.branco : C.texto }}>{t}</span>
      ))}
    </div>
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={390} height={844}>
      <path d="M210 359 H187 V227 H110 V240" stroke={C.azulForte} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={300} strokeDashoffset={300 * (1 - desenho)} />
    </svg>
    <Marcador x={210} y={300} n={eventos ? "calendario" : "mais"} fundo={C.azul} t={44} em={p(0)} />
    <div style={{ position: "absolute", left: 210 - 40, top: 359 - 40, width: 80, height: 80, borderRadius: 80, border: `3px solid ${C.azul}`, transform: `scale(${pulso})`, opacity: 1 - pulso }} />
    <div style={{ position: "absolute", left: 196, top: 345, width: 28, height: 28, borderRadius: 28, background: "rgba(154,214,248,0.5)" }}>
      <div style={{ margin: 8, width: 12, height: 12, borderRadius: 12, background: C.preto }} />
    </div>
    <Marcador x={110} y={240} n={eventos ? "calendario" : "casa"} fundo={C.verdeClaro} em={p(1)} />
    <Marcador x={300} y={230} n={eventos ? "calendario" : "coracao"} fundo={C.azulClaro} em={p(2)} />
    <Marcador x={90} y={470} n={eventos ? "calendario" : "mais"} fundo={C.amareloClaro} em={p(3)} />
    <Marcador x={310} y={450} n="relogio" fundo={C.roxoClaro} em={p(4)} />
    {eventos || limpo ? null : (
      <>
        <div style={{ position: "absolute", left: 18, top: 540, width: 354, height: 170, borderRadius: 22, background: C.branco, boxShadow: "0 8px 24px rgba(42,33,28,0.12)" }}>
          <div style={{ position: "absolute", left: 16, top: 16, width: 48, height: 48, borderRadius: 14, background: C.azul, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone n="mais" t={22} />
          </div>
          <div style={{ position: "absolute", left: 76, top: 18, fontSize: 16, fontWeight: 700 }}>Clínica Patas & Cia</div>
          <div style={{ position: "absolute", left: 76, top: 42, fontSize: 12, color: C.textoApoio }}>Clínica · 0,8 km · 4,8 ★</div>
          <div style={{ position: "absolute", right: 16, top: 30 }}>
            <Icone n="seta" t={18} />
          </div>
          <div style={{ position: "absolute", left: 16, top: 78, display: "flex", gap: 6 }}>
            <Chip texto="Aberto agora" fundo={C.verdeClaro} cor={C.verde} />
            <Chip texto="Clínica" fundo={C.roxoClaro} cor={C.roxo} />
          </div>
          <div style={{ position: "absolute", left: 16, top: 112, width: 44, height: 44, borderRadius: 44, background: C.fundoTela, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone n="telefone" t={18} />
          </div>
          <BarraAcao texto="Traçar rota" n="rota" top={108} left={70} width={268} />
        </div>
        <div style={{ position: "absolute", left: 18, top: 740, width: 354, height: 60, borderRadius: 60, background: C.preto, display: "flex", justifyContent: "space-around", alignItems: "center" }}>
          {(["casa", "coracao", "pino", "pessoa"] as NomeIcone[]).map((n, i) => (
            <div key={n} style={{ width: 44, height: 44, borderRadius: 44, background: i === 2 ? C.azul : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone n={n} t={20} cor={i === 2 ? C.texto : C.branco} />
            </div>
          ))}
        </div>
      </>
    )}
  </div>
  );
};

/** Fachada ilustrada da clínica (fictícia), com zoom lento como numa foto. */
const FotoClinica: React.FC = () => {
  const f = useCurrentFrame();
  const zoom = 1.04 + Math.min(f, 240) * 0.0004;
  const nuvem = (f * 0.25) % 460;
  return (
    <svg width={390} height={260} viewBox="0 0 390 260" style={{ position: "absolute", left: 0, top: 0 }}>
      <defs>
        <linearGradient id="ceuClinica" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8FD0F5" />
          <stop offset="1" stopColor="#D8F0FC" />
        </linearGradient>
      </defs>
      <g transform={`translate(195 150) scale(${zoom}) translate(-195 -150)`}>
        <rect width={390} height={260} fill="url(#ceuClinica)" />
        {/* nuvens passando */}
        <g fill={C.branco} opacity={0.9} transform={`translate(${nuvem - 80} 0)`}>
          <ellipse cx={40} cy={40} rx={30} ry={12} />
          <ellipse cx={62} cy={34} rx={20} ry={12} />
          <ellipse cx={250} cy={28} rx={26} ry={10} />
        </g>
        {/* árvore à direita */}
        <rect x={352} y={130} width={10} height={110} fill="#8A5527" />
        <circle cx={357} cy={118} r={34} fill="#6FC28F" />
        <circle cx={338} cy={134} r={22} fill="#5BB17D" />
        {/* prédio */}
        <rect x={34} y={70} width={300} height={175} rx={6} fill="#FFF6E5" />
        <rect x={34} y={70} width={300} height={12} fill="#F2E2C4" />
        {/* letreiro */}
        <rect x={74} y={88} width={220} height={40} rx={20} fill={C.azulForte} />
        <circle cx={100} cy={108} r={14} fill={C.branco} />
        <path d="M100 100 v16 M92 108 h16" stroke="#3FAE6A" strokeWidth={5} strokeLinecap="round" />
        <text x={200} y={115} textAnchor="middle" fontSize={17} fontWeight={800} fill={C.branco} fontFamily="Plus Jakarta Sans, sans-serif" letterSpacing={0.5}>
          PATAS & CIA
        </text>
        <text x={200} y={140} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={C.azulEscuro} fontFamily="Plus Jakarta Sans, sans-serif" letterSpacing={1.5}>
          CLÍNICA VETERINÁRIA
        </text>
        {/* toldo listrado */}
        {Array.from({ length: 10 }).map((_, i) => (
          <path key={i} d={`M${54 + i * 26} 148 h26 l-3 18 a10 10 0 0 1 -20 0z`} fill={i % 2 ? C.branco : C.azul} />
        ))}
        {/* vitrines */}
        {[62, 246].map((x) => (
          <g key={x}>
            <rect x={x} y={172} width={60} height={50} rx={4} fill="#BFE5F8" stroke="#E8D6B5" strokeWidth={4} />
            <path d={`M${x + 8} 214 l16 -34 M${x + 30} 214 l12 -26`} stroke={C.branco} strokeWidth={4} opacity={0.7} />
          </g>
        ))}
        {/* gato e cachorro na vitrine */}
        <circle cx={92} cy={212} r={9} fill="#E7A867" />
        <path d="M84 206 l3 -8 l4 6 M100 206 l-3 -8 l-4 6" fill="#E7A867" />
        <ellipse cx={276} cy={212} rx={10} ry={9} fill="#B7743B" />
        <ellipse cx={268} cy={208} rx={4} ry={7} fill="#8A5527" />
        <ellipse cx={284} cy={208} rx={4} ry={7} fill="#8A5527" />
        {/* porta de vidro com patinha */}
        <rect x={150} y={168} width={68} height={77} rx={4} fill="#A9DCF6" stroke="#E8D6B5" strokeWidth={4} />
        <path d="M184 168 v77" stroke="#E8D6B5" strokeWidth={3} />
        <g fill={C.branco} opacity={0.9} transform="translate(160 186) scale(0.16)">
          <ellipse cx="22" cy="44" rx="9" ry="11" />
          <ellipse cx="40" cy="26" rx="9.5" ry="11.5" />
          <ellipse cx="60" cy="26" rx="9.5" ry="11.5" />
          <ellipse cx="78" cy="44" rx="9" ry="11" />
          <path d="M50 46c13 0 26 15 26 26 0 9-7 13-14 12-5-.7-8-3-12-3s-7 2.3-12 3c-7 1-14-3-14-12 0-11 13-26 26-26z" />
        </g>
        <circle cx={210} cy={210} r={2.5} fill="#8A5527" />
        {/* plaquinha "aberto" e vasos */}
        <rect x={190} y={176} width={24} height={11} rx={3} fill="#3FAE6A" />
        <text x={202} y={184} textAnchor="middle" fontSize={6} fontWeight={800} fill={C.branco} fontFamily="Plus Jakarta Sans, sans-serif">
          ABERTO
        </text>
        {[128, 228].map((x) => (
          <g key={x}>
            <path d={`M${x} 232 h16 l-3 14 h-10z`} fill="#D77A4A" />
            <circle cx={x + 8} cy={226} r={9} fill="#5BB17D" />
          </g>
        ))}
        {/* calçada */}
        <rect x={0} y={244} width={390} height={16} fill="#E6DCCB" />
      </g>
    </svg>
  );
};

export const TelaLugar: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: C.branco }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: 390, height: 260, background: C.heroi, overflow: "hidden" }}>
      <FotoClinica />
      <div style={{ position: "absolute", left: 22, top: 192, background: "rgba(17,17,17,0.6)", color: C.branco, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>Fotos do Google · 1 de 12</div>
      <Onda y={230} />
    </div>
    <BotaoRedondo n="voltar" x={20} y={44} />
    <BotaoRedondo n="coracao" x={330} y={44} />
    <div style={{ position: "absolute", left: 22, top: 266, fontSize: 26, fontWeight: 500, letterSpacing: -0.6 }}>Clínica Patas & Cia</div>
    <div style={{ position: "absolute", left: 22, top: 302, fontSize: 12, color: C.textoApoio }}>Clínica veterinária · 0,8 km · 4,8 ★ no Google</div>
    <div style={{ position: "absolute", left: 22, top: 326, display: "flex", gap: 6 }}>
      <Chip texto="Aberto agora" fundo={C.verdeClaro} cor={C.verde} />
      <Chip texto="312 avaliações" fundo={C.roxoClaro} cor={C.roxo} />
      <Chip texto="Aberto até 22h" fundo={C.amareloClaro} cor={C.amarelo} />
    </div>
    <Linha n="pino" rotulo="Endereço" valor="Rua das Flores, 120" top={366} />
    <Linha n="relogio" rotulo="Horário" valor="Aberto até 22h" top={428} />
    <Linha n="telefone" rotulo="Telefone" valor="Ligar agora" top={490} />
    <Linha n="globo" rotulo="Site" valor="Ver site" top={552} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 622, textAlign: "center", fontSize: 10.5, color: C.textoApoio }}>Informações e fotos do Google</div>
    <div style={{ position: "absolute", left: 22, top: 762, width: 56, height: 56, borderRadius: 56, background: C.fundoTela, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone n="telefone" t={20} />
    </div>
    <div style={{ position: "absolute", left: 88, top: 762, width: 56, height: 56, borderRadius: 56, background: C.fundoTela, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone n="chat" t={20} />
    </div>
    <BarraAcao texto="Traçar rota" n="rota" left={154} width={214} />
  </div>
);

/* ── Emergência ──────────────────────────────────────────────────────────── */

export const TelaSOS: React.FC<{ realce?: number }> = ({ realce = 0 }) => (
  <div style={{ position: "absolute", inset: 0, background: C.branco }}>
    <Cabecalho sub="Emergência" titulo="SOS" cor={C.rosaClaro} selo="Funciona sem internet" />
    <div style={{ position: "absolute", left: 22, top: 182, width: 346, height: 130, borderRadius: 20, background: C.rosaClaro, padding: 16, boxSizing: "border-box", transform: `scale(${1 + realce * 0.04})`, boxShadow: realce ? `0 0 0 ${realce * 4}px ${C.vinho}` : undefined }}>
      <div style={{ fontSize: 11.5, color: C.vinho, fontWeight: 700 }}>Clínica 24 h mais perto</div>
      <div style={{ fontSize: 19, fontWeight: 600, marginTop: 8 }}>Clínica 24 h Vida Pet</div>
      <div style={{ fontSize: 12, color: C.textoApoio, marginTop: 6 }}>1,4 km · 6 min de carro · Aberta agora</div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <Chip texto="Aceita emergência" fundo={C.verdeClaro} cor={C.verde} />
        <Chip texto="Fotos e avaliações" fundo={C.branco} cor={C.texto} />
      </div>
    </div>
    <Linha n="escudo" rotulo="Primeiros socorros" valor="Passo a passo para agir agora" top={328} fundo={C.amareloClaro} />
    <Linha n="bandeira" rotulo="O que intoxica o pet" valor="Chocolate, uva, cebola e mais" top={392} fundo={C.amareloClaro} />
    <Linha n="telefone" rotulo="Meu veterinário" valor="Ligar para a Dra. Ana" top={456} />
    <div style={{ position: "absolute", left: 40, right: 40, top: 524, textAlign: "center", fontSize: 10.5, color: C.textoApoio }}>Em emergência, vá à clínica. O app não substitui o atendimento veterinário.</div>
    <BarraAcao texto="Ligar para a clínica 24 h" n="telefone" destaque={realce} />
  </div>
);

export const TelaSocorros: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: C.branco }}>
    <Cabecalho sub="Emergência" titulo="Primeiros socorros" selo="Funciona sem internet" />
    {["Engasgo"].map((t, i) => (
      <div key={t} style={{ position: "absolute", left: 22, top: 182 + i * 50, width: 346, height: 42, borderRadius: 14, background: C.fundoTela, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", boxSizing: "border-box", fontSize: 13.5, fontWeight: 600 }}>
        {t} <span>+</span>
      </div>
    ))}
    <div style={{ position: "absolute", left: 22, top: 232, width: 346, height: 42, borderRadius: 14, background: C.rosaClaro, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", boxSizing: "border-box", fontSize: 13.5, fontWeight: 600 }}>
      Golpe de calor <span>–</span>
    </div>
    <div style={{ position: "absolute", left: 22, top: 282, width: 346, borderRadius: 16, border: `1px solid ${C.borda}`, padding: "12px 14px", boxSizing: "border-box" }}>
      {["Leve o pet para a sombra e ao vento.", "Molhe com água fresca, não gelada, nas patas e na barriga.", "Ofereça água em pequenos goles.", "Vá a uma clínica 24 h agora, mesmo que ele melhore."].map((t, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 12.5, lineHeight: 1.35 }}>
          <span style={{ minWidth: 22, height: 22, borderRadius: 22, background: C.preto, color: C.branco, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
          {t}
        </div>
      ))}
    </div>
    {["Convulsão", "Sangramento", "Picada de inseto"].map((t, i) => (
      <div key={t} style={{ position: "absolute", left: 22, top: 506 + i * 50, width: 346, height: 42, borderRadius: 14, background: C.fundoTela, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", boxSizing: "border-box", fontSize: 13.5, fontWeight: 600 }}>
        {t} <span>+</span>
      </div>
    ))}
    <BarraAcao texto="Clínica 24 h mais perto" n="pino" />
  </div>
);

/* ── Cuidados ────────────────────────────────────────────────────────────── */

const Campo: React.FC<{ r: string; v: string; x: number; y: number; w: number }> = ({ r, v, x, y, w }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: 50, borderRadius: 14, background: C.fundoTela, padding: "8px 12px", boxSizing: "border-box" }}>
    <div style={{ fontSize: 10.5, color: C.textoApoio }}>{r}</div>
    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div>
  </div>
);

export const TelaCalculadora: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: C.branco }}>
    <Cabecalho sub="Ferramentas" titulo="Calculadoras" />
    <div style={{ position: "absolute", left: 22, top: 182, width: 346, height: 44, borderRadius: 44, background: C.fundoTela, display: "flex", padding: 4, boxSizing: "border-box", fontSize: 13.5 }}>
      {["Idade", "Ração", "Peso"].map((t, i) => (
        <div key={t} style={{ flex: 1, textAlign: "center", lineHeight: "36px", borderRadius: 36, background: i === 1 ? C.preto : "transparent", color: i === 1 ? C.branco : C.textoApoio, fontWeight: i === 1 ? 700 : 500 }}>{t}</div>
      ))}
    </div>
    <Campo r="Pet" v="Rex · cão" x={22} y={240} w={346} />
    <Campo r="Peso" v="28 kg" x={22} y={300} w={168} />
    <Campo r="Fase" v="Adulto" x={200} y={300} w={168} />
    <Campo r="Atividade" v="Normal" x={22} y={360} w={346} />
    <div style={{ position: "absolute", left: 22, top: 424, width: 346, height: 104, borderRadius: 18, background: C.verdeClaro, padding: "12px 14px", boxSizing: "border-box" }}>
      <div style={{ fontSize: 11.5, color: C.verde, fontWeight: 700 }}>Porção diária estimada</div>
      <div style={{ fontSize: 34, fontWeight: 500, letterSpacing: -1 }}>380 g</div>
      <div style={{ fontSize: 11.5, color: C.textoApoio }}>Em 2 refeições, cerca de 190 g cada</div>
    </div>
    <div style={{ position: "absolute", left: 22, top: 540, width: 168, height: 64, borderRadius: 16, background: C.roxoClaro, padding: "10px 12px", boxSizing: "border-box" }}>
      <div style={{ fontSize: 10.5, color: C.roxo, fontWeight: 700 }}>Idade humana</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>28 anos</div>
    </div>
    <div style={{ position: "absolute", left: 200, top: 540, width: 168, height: 64, borderRadius: 16, background: C.azulClaro, padding: "10px 12px", boxSizing: "border-box" }}>
      <div style={{ fontSize: 10.5, color: C.azulEscuro, fontWeight: 700 }}>Peso ideal</div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>26 a 30 kg</div>
    </div>
    <BarraAcao texto="Calcular" n="grafico" />
  </div>
);

const Chave: React.FC<{ ligada: boolean }> = ({ ligada }) => (
  <div style={{ width: 46, height: 26, borderRadius: 26, background: ligada ? C.preto : C.bordaForte, position: "relative" }}>
    <div style={{ position: "absolute", top: 3, left: ligada ? 23 : 3, width: 20, height: 20, borderRadius: 20, background: ligada ? C.azul : C.branco }} />
  </div>
);

export const TelaRotina: React.FC<{ ligadas?: number }> = ({ ligadas = 5 }) => (
  <div style={{ position: "absolute", inset: 0, background: C.branco }}>
    <Cabecalho sub="Lembretes" titulo="Rotina de cuidados" />
    {[
      ["Antipulgas e carrapatos", "Todo mês, no dia 10", C.azulClaro, true],
      ["Vermífugo", "A cada 3 meses", C.roxoClaro, true],
      ["Banho", "A cada 15 dias", C.amareloClaro, true],
      ["Escovar os dentes", "3 vezes por semana", C.fundoTela, false],
      ["Aniversário do Rex", "18/11 · aviso 1 dia antes", C.rosaClaro, true],
    ].map(([t, s, fundo, liga], i) => (
      <div key={i} style={{ position: "absolute", left: 22, top: 182 + i * 64, width: 346, height: 54, borderRadius: 16, background: fundo as string, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", boxSizing: "border-box" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
          <div style={{ fontSize: 11, color: C.textoApoio }}>{s}</div>
        </div>
        <Chave ligada={(liga as boolean) && i < ligadas} />
      </div>
    ))}
    <Campo r="Horário dos avisos" v="9:00" x={22} y={502} w={346} />
    <BarraAcao texto="Salvar rotina" n="sino" />
  </div>
);
