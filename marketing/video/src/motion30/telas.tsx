import React from "react";
import { Avatar, Barra, BotaoPrimario, BotaoRedondo, Cao, cor, Icone, MarcaPata, MenuInferior, NomeIcone, Onda, SeloMarca } from "./app";
import { DADOS } from "./roteiro";

/*
 * Telas do app recriadas a partir do código de apps/tutor, em 390×844:
 * Início (app/(app)/inicio.tsx), perfil do pet (app/pet/[id]/index.tsx),
 * Carteirinha (pet/[id]/carteirinha.tsx), Medicamentos
 * (pet/[id]/medicamentos.tsx) e Mapa (app/(app)/mapa.tsx).
 * Os dados vêm de roteiro.ts › DADOS (fictícios).
 */

const abs = (left: number, top: number, extra: React.CSSProperties = {}): React.CSSProperties => ({ position: "absolute", left, top, ...extra });
const fundoTela: React.CSSProperties = { position: "absolute", inset: 0, background: cor.branco, overflow: "hidden" };

/* ── Perfil do pet ───────────────────────────────────────────────────────── */

export const TelaPerfil: React.FC = () => (
  <div style={fundoTela}>
    <div style={abs(0, 0, { width: 390, height: 320, background: cor.azul, overflow: "hidden" })}>
      <MarcaPata t={90} style={abs(30, 110)} />
      <div style={abs(65, 56)}>
        <Cao t={260} recorte />
      </div>
      <BotaoRedondo x={24} y={56}>
        <Icone n="voltar" t={20} e={2.2} />
      </BotaoRedondo>
      <BotaoRedondo x={264} y={56}>
        <Icone n="compartilhar" t={19} />
      </BotaoRedondo>
      <BotaoRedondo x={320} y={56}>
        <span style={{ fontSize: 22, fontWeight: 700, lineHeight: "24px", marginTop: -8 }}>⋯</span>
      </BotaoRedondo>
      <Onda />
    </div>
    <div style={abs(24, 318, { fontSize: 40, lineHeight: "46px", letterSpacing: -1.2, fontWeight: 500 })}>{DADOS.pet.nome}</div>
    <div style={abs(24, 378, { width: 342, display: "flex", gap: 10 })}>
      {[
        [DADOS.pet.sexo, "Sexo", cor.lilasClaro, cor.lilas],
        [DADOS.pet.idade, "Idade", cor.amareloClaro, cor.amarelo],
        [DADOS.pet.peso, "Peso", cor.verdeClaro, cor.verde],
      ].map(([v, r, f, c]) => (
        <div key={r} style={{ flex: 1, borderRadius: 24, padding: "12px 0", textAlign: "center", background: f }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: c }}>{r}</div>
        </div>
      ))}
    </div>
    <div style={abs(24, 460, { display: "flex", gap: 6, alignItems: "center" })}>
      {[
        ["Vacinas em dia", cor.verdeClaro],
        ["Peso em dia", cor.amareloClaro],
      ].map(([t, f]) => (
        <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "6px 10px", background: f }}>
          <Icone n="escudo" t={14} e={2} />
          <span style={{ fontSize: 12, fontWeight: 700 }}>{t}</span>
        </div>
      ))}
      <span style={{ fontSize: 18, fontWeight: 700, color: cor.apoio, padding: "0 4px" }}>›</span>
    </div>
    <div style={abs(24, 508, { width: 342, display: "flex", gap: 22, borderBottom: `1.5px solid ${cor.borda}` })}>
      {["Vacinas", "Peso", "Consultas"].map((a, i) => (
        <div key={a} style={{ padding: "8px 0", marginBottom: -1.5, borderBottom: `3px solid ${i === 0 ? cor.azul : "transparent"}`, fontSize: 16, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? cor.texto : cor.apoio }}>
          {a}
        </div>
      ))}
    </div>
    {DADOS.vacinas.map((v, i) => (
      <div key={v.nome} style={abs(24, 566 + i * 78, { width: 342, height: 68, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, background: cor.fundo, borderRadius: 24, padding: "0 14px 0 12px" })}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: i % 2 ? cor.lilasClaro : cor.azul, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n="vacina" t={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{v.nome}</div>
          <div style={{ fontSize: 13, color: cor.apoio }}>Aplicada em {v.aplicada}</div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, background: cor.branco, borderRadius: 999, padding: "6px 12px" }}>{v.proxima}</div>
      </div>
    ))}
  </div>
);

/* ── Início ──────────────────────────────────────────────────────────────── */

/** Chips de pets do herói do Início (também usados no destaque ampliado). */
export const ChipsPets: React.FC = () => (
  <div style={{ display: "flex", gap: 8 }}>
    <div style={{ height: 40, borderRadius: 20, display: "flex", alignItems: "center", gap: 8, paddingLeft: 5, paddingRight: 14, background: cor.texto }}>
      <Avatar t={30} style={{ border: `0px solid ${cor.branco}` }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: cor.branco }}>{DADOS.pet.nome}</span>
    </div>
    <div style={{ height: 40, borderRadius: 20, display: "flex", alignItems: "center", gap: 8, paddingLeft: 5, paddingRight: 14, background: cor.branco }}>
      <Avatar especie="gato" t={30} />
      <span style={{ fontSize: 13, fontWeight: 700 }}>{DADOS.outroPet}</span>
    </div>
    <div style={{ width: 40, height: 40, borderRadius: 20, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icone n="cruz" t={16} e={2.6} />
    </div>
  </div>
);

const ATALHOS: { nome: string; fundo: string; icone: NomeIcone; c: string }[] = [
  { nome: "SOS", fundo: cor.emergencia, icone: "cruz", c: cor.branco },
  { nome: "Lembretes", fundo: cor.lilasClaro, icone: "sino", c: cor.lilas },
  { nome: "Carteirinha", fundo: cor.rosaClaro, icone: "carteirinha", c: cor.rosa },
  { nome: "Remédios", fundo: cor.rosaClaro, icone: "capsula", c: cor.rosa },
];

/** Posição do atalho Carteirinha (para o toque). */
export const PONTO_CARTEIRINHA = { x: 24 + 2 * 78 + 36, y: 334 + 34 };

export const TelaInicio: React.FC<{ apertado?: number; chipsFora?: number }> = ({ apertado = 0, chipsFora = 0 }) => (
  <div style={fundoTela}>
    <div style={abs(0, 0, { width: 390, height: 236, background: cor.azul, overflow: "hidden" })}>
      <div style={abs(24, 50, { height: 44, borderRadius: 22, background: cor.branco, display: "flex", alignItems: "center", gap: 6, padding: "0 14px" })}>
        <Icone n="local" t={18} />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{DADOS.cidade}</span>
      </div>
      <BotaoRedondo x={268} y={50} t={44}>
        <Icone n="sino" t={20} />
        <div style={abs(25, 9, { width: 10, height: 10, borderRadius: 5, background: "#D93B5A", border: `2px solid ${cor.branco}`, boxSizing: "border-box" })} />
      </BotaoRedondo>
      <BotaoRedondo x={322} y={50} t={44}>
        <Icone n="pessoa" t={20} />
      </BotaoRedondo>
      <div style={abs(24, 108, { fontSize: 13, lineHeight: "18px", fontWeight: 600, color: cor.azulEscuro })}>{DADOS.saudacao}</div>
      <div style={abs(24, 126, { fontSize: 34, lineHeight: "36px", letterSpacing: -1, fontWeight: 500 })}>Como está o {DADOS.pet.nome}?</div>
      <div style={abs(24, 172, { opacity: 1 - chipsFora })}>
        <ChipsPets />
      </div>
      <Onda altura={30} />
    </div>

    {/* Próxima vacina */}
    <div style={abs(24, 236, { width: 342, height: 86, boxSizing: "border-box", background: cor.branco, borderRadius: 28, display: "flex", alignItems: "center", gap: 12, padding: "0 14px 0 20px", boxShadow: "0 12px 17px rgba(17,17,17,0.10)" })}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: cor.rosa }}>Próxima vacina</div>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.2, marginTop: 2 }}>{DADOS.proximaVacina.texto}</div>
        <div style={{ marginTop: 8 }}>
          <Barra fracao={DADOS.proximaVacina.fracao} c={cor.rosa} fundo={cor.rosaClaro} altura={6} />
        </div>
      </div>
      <div style={{ height: 44, padding: "0 18px", borderRadius: 22, background: cor.texto, color: cor.branco, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center" }}>Registrar</div>
    </div>

    {/* Atalhos */}
    <div style={abs(24, 334, { display: "flex", gap: 6, alignItems: "flex-start" })}>
      {ATALHOS.map((a, i) => {
        const s = i === 2 ? 1 - apertado * 0.08 : 1;
        return (
          <div key={a.nome} style={{ width: 72, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, transform: `scale(${s})` }}>
            <div style={{ width: 68, height: 68, borderRadius: 24, background: a.fundo, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone n={a.icone} t={26} c={a.c} e={i === 0 ? 2.6 : 2} />
            </div>
            <span style={{ fontSize: 13, fontWeight: i === 0 ? 800 : 700, color: i === 0 ? cor.emergencia : cor.texto }}>{a.nome}</span>
          </div>
        );
      })}
      <div style={{ width: 1, height: 60, background: cor.borda, margin: "10px 8px 0" }} />
      <div style={{ width: 66, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, paddingTop: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: 18, background: cor.rosaClaro, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n="calculadora" t={20} c={cor.rosa} e={2} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: cor.apoio }}>Calcular</span>
      </div>
    </div>

    {/* Hoje */}
    <div style={abs(24, 438, { width: 342, display: "flex", justifyContent: "space-between", alignItems: "baseline" })}>
      <span style={{ fontSize: 16, fontWeight: 700 }}>Hoje</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: cor.apoio }}>Ver todos ›</span>
    </div>
    {[
      { t: DADOS.remedio.nome, q: `${DADOS.pet.nome} · hoje, 20:00`, i: "capsula" as NomeIcone },
      { t: "Escovar os dentes", q: `${DADOS.pet.nome} · hoje, 21:00`, i: "sino" as NomeIcone },
    ].map((l, i) => (
      <div key={l.t} style={abs(24, 466 + i * 64, { width: 342, height: 56, boxSizing: "border-box", borderRadius: 24, background: cor.rosaClaro, display: "flex", alignItems: "center", gap: 10, padding: "0 8px 0 12px" })}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n={l.i} t={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{l.t}</div>
          <div style={{ fontSize: 12, color: "#4A5568" }}>{l.q}</div>
        </div>
        <div style={{ height: 40, borderRadius: 20, background: cor.branco, display: "flex", alignItems: "center", gap: 6, padding: "0 16px 0 12px" }}>
          <Icone n="check" t={18} e={2.4} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Feito</span>
        </div>
      </div>
    ))}

    {/* Carteirinha do pet */}
    <div style={abs(24, 600, { width: 342, boxSizing: "border-box", borderRadius: 28, padding: 12, background: `linear-gradient(135deg, ${cor.azul}, ${cor.lilasClaro})` })}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar t={46} style={{ background: cor.branco }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Carteirinha do {DADOS.pet.nome}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, background: cor.branco, borderRadius: 999, padding: "3px 9px" }}>{DADOS.proximaVacina.selo}</span>
            <span style={{ fontSize: 11, fontWeight: 700, background: cor.verdeClaro, color: cor.verde, borderRadius: 999, padding: "3px 9px" }}>Antirrábica ok</span>
          </div>
        </div>
        <Icone n="seta" t={16} e={2} />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {[
          ["camera", "Escanear"],
          ["capsula", "Remédios"],
          ["compartilhar", "Enviar"],
        ].map(([n, t]) => (
          <div key={t} style={{ flex: 1, height: 44, borderRadius: 22, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Icone n={n as NomeIcone} t={16} e={1.9} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
    <MenuInferior ativo={0} />
  </div>
);

/* ── Carteirinha ─────────────────────────────────────────────────────────── */

/** Bloco "Vacinas" da Carteirinha (também usado no destaque ampliado). */
export const BlocoVacinas: React.FC<{ largura?: number }> = ({ largura = 342 }) => (
  <div style={{ width: largura, boxSizing: "border-box", background: cor.azulClaro, borderRadius: 26, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 17, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone n="vacina" t={18} />
      </div>
      <span style={{ fontSize: 16, fontWeight: 700 }}>Vacinas</span>
    </div>
    <div>
      <div style={{ display: "flex", gap: 6, padding: "6px 0", fontSize: 11, fontWeight: 700, color: cor.azulEscuro }}>
        <span style={{ flex: 1.3 }}>Vacina</span>
        <span style={{ flex: 1 }}>Aplicada</span>
        <span style={{ flex: 1 }}>Próxima</span>
      </div>
      {DADOS.vacinas.map((v, i) => (
        <div key={v.nome} style={{ display: "flex", gap: 6, padding: "6px 0", fontSize: 14, fontWeight: 500, borderTop: i > 0 ? "1px solid #C9E3F2" : undefined }}>
          <span style={{ flex: 1.3 }}>{v.nome}</span>
          <span style={{ flex: 1 }}>{v.aplicada}</span>
          <span style={{ flex: 1 }}>{v.proxima}</span>
        </div>
      ))}
    </div>
  </div>
);

export const POS_VACINAS = { x: 24, y: 368, w: 342 };

export const TelaCarteirinha: React.FC<{ vacinasFora?: number }> = ({ vacinasFora = 0 }) => (
  <div style={fundoTela}>
    <div style={abs(0, 0, { width: 390, height: 176, background: cor.azul, overflow: "hidden" })}>
      <BotaoRedondo x={24} y={56}>
        <Icone n="voltar" t={20} e={2.2} />
      </BotaoRedondo>
      <BotaoRedondo x={320} y={56} fundo={cor.texto}>
        <Icone n="compartilhar" t={20} c={cor.branco} />
      </BotaoRedondo>
      <div style={abs(24, 112, { fontSize: 32, lineHeight: "34px", letterSpacing: -0.96, fontWeight: 500 })}>Carteirinha</div>
      <Onda />
    </div>
    <div style={abs(24, 176, { width: 342, boxSizing: "border-box", background: cor.branco, border: "1.5px solid #E6EAF0", borderRadius: 28, overflow: "hidden", boxShadow: "0 10px 30px rgba(17,17,17,0.08)" })}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: `linear-gradient(135deg, ${cor.azul}, ${cor.lilasClaro})` }}>
        <Avatar t={76} style={{ background: cor.branco }} />
        <div>
          <div style={{ fontSize: 28, lineHeight: "30px", letterSpacing: -0.8, fontWeight: 700 }}>{DADOS.pet.nome}</div>
          <div style={{ fontSize: 13, color: "#2B3A4A", marginTop: 2 }}>{DADOS.pet.especie}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 14px 14px" }}>
        {[
          ["Idade", DADOS.pet.idade, cor.amareloClaro, cor.amarelo],
          ["Sexo", DADOS.pet.sexo, cor.lilasClaro, cor.lilas],
          ["Peso", DADOS.pet.peso, cor.verdeClaro, cor.verde],
        ].map(([r, v, f, c]) => (
          <div key={r} style={{ flex: 1, borderRadius: 18, padding: "8px 10px", background: f }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: c }}>{r}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 1 }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
    <div style={abs(POS_VACINAS.x, POS_VACINAS.y, { opacity: 1 - vacinasFora })}>
      <BlocoVacinas />
    </div>
    <div style={abs(24, 572, { width: 342, boxSizing: "border-box", background: cor.amareloClaro, borderRadius: 26, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 17, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n="capsula" t={18} />
        </div>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Remédios em uso</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{DADOS.remedio.nome}</div>
          <div style={{ fontSize: 12, color: cor.amarelo }}>
            {DADOS.remedio.dose} · {DADOS.remedio.frequencia}
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, background: cor.branco, borderRadius: 999, padding: "5px 12px" }}>
          Dia {DADOS.remedio.dia} de {DADOS.remedio.total}
        </span>
      </div>
    </div>
    <div style={abs(24, 690, { width: 342, height: 90, borderRadius: 26, background: cor.verdeClaro, padding: "14px 16px", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 10 })}>
      <div style={{ width: 34, height: 34, borderRadius: 17, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone n="coracao" t={18} />
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, marginTop: 7 }}>Saúde e cuidados</span>
    </div>
    <div style={abs(0, 736, { width: 390, height: 108, background: cor.branco, padding: "12px 20px 0", boxSizing: "border-box" })}>
      <BotaoPrimario titulo="Compartilhar carteirinha" icone={<Icone n="compartilhar" t={22} e={2} />} />
    </div>
  </div>
);

/* ── Medicamentos ────────────────────────────────────────────────────────── */

/**
 * Cartão do remédio em andamento. `dada` 0→1 confirma a dose das 20:00
 * (pílula branca "· próxima" vira preta "dado" com o check azul).
 */
export const CartaoRemedio: React.FC<{ dada?: number; apertado?: number }> = ({ dada = 0, apertado = 0 }) => {
  const r = DADOS.remedio;
  const virou = dada >= 0.5;
  return (
    <div style={{ width: 350, boxSizing: "border-box", borderRadius: 30, border: "1.5px solid #F3DC8E", background: cor.amareloClaro, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n="capsula" t={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{r.nome}</div>
          <div style={{ fontSize: 12, color: cor.amarelo, marginTop: 2 }}>
            {r.dose} · {r.frequencia}
          </div>
        </div>
        <div style={{ background: cor.branco, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
          Dia {r.dia} de {r.total}
        </div>
      </div>
      <Barra fracao={r.dia / r.total} c={cor.texto} fundo={cor.branco} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, height: 44, borderRadius: 22, background: cor.texto, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Check />
          <span style={{ fontSize: 14, fontWeight: 600, color: cor.branco }}>{r.doses[0]} dado</span>
        </div>
        <div
          style={{
            flex: 1,
            height: 44,
            borderRadius: 22,
            background: virou ? cor.texto : cor.branco,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transform: `scale(${1 - apertado * 0.06})`,
            boxShadow: virou ? undefined : `0 0 0 ${2 * (1 - dada * 2)}px rgba(17,17,17,0.08)`,
          }}
        >
          {virou ? <Check entrada={Math.min(1, (dada - 0.5) * 2)} /> : null}
          <span style={{ fontSize: 14, fontWeight: virou ? 600 : 700, color: virou ? cor.branco : cor.texto }}>{virou ? `${r.doses[1]} dado` : `${r.doses[1]} · próxima`}</span>
        </div>
      </div>
    </div>
  );
};

const Check: React.FC<{ entrada?: number }> = ({ entrada = 1 }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" style={{ display: "block" }}>
    <path d="M5 12l5 5 9-10" fill="none" stroke={cor.azul} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={24} strokeDashoffset={24 * (1 - entrada)} />
  </svg>
);

export const POS_REMEDIO = { x: 20, y: 262, w: 350 };
/** Centro da pílula da dose das 20:00 (para o toque). */
export const PONTO_DOSE = { x: 20 + 16 + 159 + 8 + 79, y: 262 + 16 + 48 + 12 + 8 + 12 + 22 };

export const TelaRemedios: React.FC<{ dada?: number; apertado?: number; cartaoFora?: number }> = ({ dada = 0, apertado = 0, cartaoFora = 0 }) => {
  const s = DADOS.suplemento;
  return (
    <div style={fundoTela}>
      <div style={abs(0, 0, { width: 390, height: 220, background: cor.azul, overflow: "hidden" })}>
        <BotaoRedondo x={24} y={56}>
          <Icone n="voltar" t={20} e={2.2} />
        </BotaoRedondo>
        <BotaoRedondo x={320} y={56} fundo={cor.texto}>
          <span style={{ color: cor.branco, fontSize: 26, lineHeight: "30px", marginTop: -3 }}>+</span>
        </BotaoRedondo>
        <div style={abs(24, 112)}>
          <div style={{ fontSize: 14, lineHeight: "20px", fontWeight: 500, color: cor.azulEscuro }}>{DADOS.pet.nome}</div>
          <div style={{ fontSize: 32, lineHeight: "34px", letterSpacing: -0.96, fontWeight: 500 }}>Medicamentos</div>
        </div>
        <Onda />
      </div>
      <div style={abs(20, 230, { fontSize: 16, fontWeight: 700 })}>Em andamento</div>
      <div style={abs(POS_REMEDIO.x, POS_REMEDIO.y, { opacity: 1 - cartaoFora })}>
        <CartaoRemedio dada={dada} apertado={apertado} />
      </div>
      <div style={abs(20, 432, { width: 350, boxSizing: "border-box", borderRadius: 30, border: "1.5px solid #F5BFD9", background: cor.rosaClaro, padding: 16, display: "flex", flexDirection: "column", gap: 12 })}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: cor.branco, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone n="capsula" t={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{s.nome}</div>
            <div style={{ fontSize: 12, color: cor.rosa, marginTop: 2 }}>
              {s.dose} · {s.frequencia}
            </div>
          </div>
          <div style={{ background: cor.branco, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>Dia {s.dia}</div>
        </div>
        <Barra fracao={1} c={cor.texto} fundo={cor.branco} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 150, height: 44, borderRadius: 22, background: cor.texto, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Check />
            <span style={{ fontSize: 14, fontWeight: 600, color: cor.branco }}>{s.doses[0]} dado</span>
          </div>
        </div>
      </div>
      <div style={abs(0, 724, { width: 390, height: 120, background: cor.branco, padding: "12px 20px 0", boxSizing: "border-box" })}>
        <BotaoPrimario titulo="Adicionar remédio" icone={<span style={{ fontSize: 28, lineHeight: "32px", marginTop: -3 }}>+</span>} />
      </div>
    </div>
  );
};

/** Notificação da dose (notificacoes/doses.ts: "Hora do remédio do Rex"). */
export const AvisoDose: React.FC = () => (
  <div style={{ width: 366, boxSizing: "border-box", borderRadius: 24, background: "rgba(246,247,249,0.97)", padding: "12px 14px", display: "flex", gap: 11, alignItems: "center", boxShadow: "0 14px 34px rgba(17,17,17,0.18)" }}>
    <SeloMarca t={38} style={{ filter: "none" }} />
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Hora do remédio do {DADOS.pet.nome}</span>
        <span style={{ fontSize: 12, color: cor.apoio }}>agora</span>
      </div>
      <div style={{ fontSize: 14, color: "#2B3A4A", marginTop: 1 }}>
        {DADOS.remedio.nome} · {DADOS.remedio.dose}
      </div>
    </div>
  </div>
);

/* ── Mapa ────────────────────────────────────────────────────────────────── */

type Categoria = "clinica" | "petshop" | "banho_tosa" | "creche" | "hotelzinho";

/** IlustracaoLugar.tsx (viewBox 48). */
const Ilustracao: React.FC<{ c: Categoria; t: number }> = ({ c, t }) => (
  <svg width={t} height={t} viewBox="0 0 48 48" style={{ display: "block" }}>
    {c === "clinica" ? (
      <>
        <rect width={48} height={48} fill="#CFE8FB" />
        <rect y={34} width={48} height={14} fill="#B9D9A8" />
        <rect x={9} y={14} width={30} height={24} rx={2} fill="#fff" />
        <rect x={9} y={14} width={30} height={5} fill="#7CC8F0" />
        <path d="M24 22v8M20 26h8" stroke="#E5484D" strokeWidth={3} strokeLinecap="round" />
        <rect x={21} y={31} width={6} height={7} fill="#9AD6F8" />
      </>
    ) : c === "banho_tosa" ? (
      <>
        <rect width={48} height={48} fill="#E0F1FA" />
        <circle cx={14} cy={14} r={5} fill="#fff" />
        <circle cx={34} cy={10} r={3.5} fill="#fff" />
        <circle cx={38} cy={22} r={4.5} fill="#fff" />
        <ellipse cx={24} cy={38} rx={16} ry={6} fill="#7CC8F0" />
        <ellipse cx={24} cy={31} rx={9} ry={8} fill="#EDB878" />
        <circle cx={24} cy={25} r={7} fill="#EDB878" />
        <circle cx={21} cy={24} r={1.3} fill="#2A211C" />
        <circle cx={27} cy={24} r={1.3} fill="#2A211C" />
        <ellipse cx={24} cy={27.5} rx={2} ry={1.4} fill="#2A211C" />
        <circle cx={18} cy={20} r={3} fill="#fff" />
        <circle cx={30} cy={19} r={3.4} fill="#fff" />
      </>
    ) : c === "petshop" ? (
      <>
        <rect width={48} height={48} fill="#FFF0C9" />
        <rect y={36} width={48} height={12} fill="#D9C79A" />
        <rect x={8} y={16} width={32} height={22} fill="#fff" />
        <path d="M6 16h36l-3-8H9z" fill="#E88F45" />
        <path d="M12 8l-3 8M20 8l-2 8M28 8l1 8M36 8l2 8" stroke="#fff" strokeWidth={2.4} />
        <rect x={13} y={22} width={12} height={10} rx={1.5} fill="#CFE8FB" />
        <rect x={29} y={24} width={6} height={14} fill="#8A6A4A" />
      </>
    ) : c === "creche" ? (
      <>
        <rect width={48} height={48} fill="#D8F2E3" />
        <rect y={30} width={48} height={18} fill="#9ACD8E" />
        <circle cx={40} cy={9} r={5} fill="#FFD966" />
        <ellipse cx={24} cy={29} rx={9} ry={7} fill="#EDB878" />
        <circle cx={24} cy={21} r={8} fill="#EDB878" />
        <path d="M16 17c-4 2-4 9-2 11M32 17c4 2 4 9 2 11" stroke="#B97A3C" strokeWidth={4} strokeLinecap="round" fill="none" />
        <circle cx={21} cy={20} r={1.4} fill="#2A211C" />
        <circle cx={27} cy={20} r={1.4} fill="#2A211C" />
        <ellipse cx={24} cy={24} rx={2.2} ry={1.6} fill="#2A211C" />
      </>
    ) : (
      <>
        <rect width={48} height={48} fill="#EADCFB" />
        <rect y={36} width={48} height={12} fill="#C9B1EA" />
        <path d="M6 24L24 9l18 15z" fill="#B3478B" />
        <rect x={10} y={24} width={28} height={14} fill="#fff" />
        <rect x={14} y={27} width={7} height={7} fill="#FFD966" />
        <rect x={27} y={27} width={7} height={7} fill="#FFD966" />
        <rect x={21} y={30} width={6} height={8} fill="#7A5A9A" />
      </>
    )}
  </svg>
);

/** PinLugar.tsx: círculo com a ilustração e a pontinha; maior e azul quando selecionado. */
const Pin: React.FC<{ c: Categoria; x: number; y: number; entrada: number; selecionado: number }> = ({ c, x, y, entrada, selecionado }) => {
  const tam = 49 + 15 * selecionado;
  const borda = 3.5 + 1.5 * selecionado;
  const miolo = tam - borda * 2;
  const fundo = selecionado > 0.5 ? cor.azul : cor.branco;
  return (
    <div style={{ position: "absolute", left: x - tam / 2, top: y - tam - 8, display: "flex", flexDirection: "column", alignItems: "center", transformOrigin: "50% 100%", transform: `translateY(${(1 - entrada) * -26}px) scale(${0.3 + 0.7 * entrada})`, opacity: Math.min(1, entrada * 2.5), zIndex: selecionado > 0 ? 5 : 1 }}>
      <div style={{ width: tam, height: tam, borderRadius: tam, padding: borda, boxSizing: "border-box", background: fundo, boxShadow: "0 2px 4px rgba(17,17,17,0.25)" }}>
        <div style={{ width: miolo, height: miolo, borderRadius: miolo, overflow: "hidden" }}>
          <Ilustracao c={c} t={miolo} />
        </div>
      </div>
      <div style={{ marginTop: -2, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: `10px solid ${fundo}` }} />
    </div>
  );
};

/** Fundo do mapa no estilo claro do app: quadras, ruas, um parque e água. */
const Ruas: React.FC = () => (
  <svg style={abs(0, 0)} width={390} height={844} viewBox="0 0 390 844">
    <rect width={390} height={844} fill="#EEF0EC" />
    <path d="M-20 700 C 80 640, 120 760, 230 720 S 380 640, 420 690 L420 860 L-20 860Z" fill="#CFE6F2" />
    <rect x={226} y={330} width={118} height={86} rx={16} fill="#D6EBCF" />
    <rect x={36} y={470} width={90} height={74} rx={14} fill="#D6EBCF" />
    {[
      "M-10 300 L 400 260",
      "M-10 452 L 400 430",
      "M-10 600 L 400 590",
      "M70 180 L 110 860",
      "M200 180 L 190 860",
      "M330 180 L 300 860",
    ].map((d) => (
      <path key={d} d={d} stroke="#FFFFFF" strokeWidth={12} fill="none" strokeLinecap="round" />
    ))}
    {["M-10 380 L 400 352", "M140 180 L 152 860", "M260 180 L 246 860"].map((d) => (
      <path key={d} d={d} stroke="#FFFFFF" strokeWidth={6} fill="none" />
    ))}
  </svg>
);

export const PINOS: { c: Categoria; x: number; y: number }[] = [
  { c: "clinica", x: 238, y: 330 },
  { c: "petshop", x: 96, y: 300 },
  { c: "banho_tosa", x: 322, y: 444 },
  { c: "creche", x: 86, y: 470 },
  { c: "hotelzinho", x: 214, y: 516 },
];
export const PONTO_PINO = { x: PINOS[0].x, y: PINOS[0].y - 30 };

/** Card do lugar selecionado (sem nota, sem horário: só nome, categoria, distância e ações). */
export const FichaLugar: React.FC = () => (
  <div style={{ width: 350, boxSizing: "border-box", background: cor.branco, borderRadius: 32, padding: 16, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 2px 8px rgba(42,33,28,0.06)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, padding: 3, boxSizing: "border-box", background: cor.azul }}>
        <div style={{ width: 50, height: 50, borderRadius: 25, overflow: "hidden" }}>
          <Ilustracao c="clinica" t={50} />
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, lineHeight: "24px", fontWeight: 700 }}>{DADOS.lugar.nome}</div>
        <div style={{ fontSize: 14, lineHeight: "20px", color: cor.apoio }}>
          {DADOS.lugar.categoria} · {DADOS.lugar.distancia}
        </div>
      </div>
      <Icone n="seta" t={20} e={2} />
    </div>
    <div style={{ display: "flex" }}>
      <span style={{ borderRadius: 999, padding: "5px 12px", background: cor.lilasClaro, color: cor.lilas, fontSize: 12, fontWeight: 500 }}>{DADOS.lugar.categoria}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 28, background: cor.fundo, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone n="telefone" t={22} e={1.9} />
      </div>
      <div style={{ flex: 1, height: 56, borderRadius: 999, background: cor.texto, display: "flex", alignItems: "center", gap: 8, paddingLeft: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: cor.azul, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n="rota" t={20} e={2} />
        </div>
        <span style={{ flex: 1, textAlign: "center", marginRight: 50, fontSize: 16, fontWeight: 700, color: cor.branco }}>Traçar rota</span>
      </div>
    </div>
  </div>
);

export const POS_FICHA = { x: 20, y: 538, w: 350 };

export const TelaMapa: React.FC<{ pinos: number[]; selecionado: number; card: number; cardFora?: number; pulso: number }> = ({ pinos, selecionado, card, cardFora = 0, pulso }) => (
  <div style={{ ...fundoTela, background: "#EEF0EC" }}>
    <Ruas />
    {/* Ponto do usuário */}
    <div style={abs(162 - 40, 410 - 40, { width: 80, height: 80, borderRadius: 80, background: "rgba(154,214,248,0.35)", transform: `scale(${0.4 + pulso * 0.6})`, opacity: 1 - pulso })} />
    <div style={abs(162 - 11, 410 - 11, { width: 22, height: 22, borderRadius: 22, background: "#2F8FD8", border: `4px solid ${cor.branco}`, boxSizing: "border-box", boxShadow: "0 2px 6px rgba(17,17,17,0.25)" })} />
    {PINOS.map((p, i) => (
      <Pin key={p.c} c={p.c} x={p.x} y={p.y} entrada={pinos[i] ?? 0} selecionado={i === 0 ? selecionado : 0} />
    ))}

    {/* Topo: busca, região, abas e filtros */}
    <div style={abs(0, 0, { width: 390, boxSizing: "border-box", padding: "59px 16px 8px", background: cor.branco, borderRadius: "0 0 20px 20px", boxShadow: "0 2px 8px rgba(42,33,28,0.06)", display: "flex", flexDirection: "column", gap: 6, zIndex: 10 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 54, height: 54, borderRadius: 27, background: cor.branco, boxShadow: "0 2px 8px rgba(42,33,28,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone n="voltar" t={20} e={2.2} />
        </div>
        <div style={{ flex: 1, height: 54, borderRadius: 999, background: cor.branco, boxShadow: "0 2px 8px rgba(42,33,28,0.08)", display: "flex", alignItems: "center", gap: 8, padding: "0 16px" }}>
          <Icone n="busca" t={18} c={cor.apoio} e={2} />
          <span style={{ fontSize: 16, fontWeight: 500, color: cor.apoio }}>Buscar lugares pet</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Icone n="local" t={15} c={cor.azulEscuro} />
          <span style={{ fontSize: 14, fontWeight: 500, color: cor.apoio }}>Perto de você · 3 km</span>
        </div>
        <div style={{ display: "flex", padding: 4, borderRadius: 999, background: cor.fundo }}>
          <span style={{ padding: "8px 12px", borderRadius: 999, background: cor.texto, color: cor.branco, fontSize: 14, fontWeight: 500 }}>Lugares</span>
          <span style={{ padding: "8px 12px", fontSize: 14, fontWeight: 500, color: cor.apoio }}>Eventos</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, height: 52, alignItems: "center", whiteSpace: "nowrap" }}>
        {["Todos", "Clínicas", "Petshops", "Banho e tosa"].map((t, i) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, minHeight: 44, boxSizing: "border-box", padding: "0 12px", borderRadius: 999, border: `1px solid ${i === 0 ? cor.texto : cor.borda}`, background: i === 0 ? cor.texto : cor.branco, flexShrink: 0 }}>
            {i === 0 ? <Icone n="check" t={15} c={cor.branco} /> : null}
            <span style={{ fontSize: 14, fontWeight: 500, color: i === 0 ? cor.branco : cor.texto }}>{t}</span>
          </div>
        ))}
      </div>
    </div>

    {/* Botão "meu local" some quando o card abre */}
    <div style={abs(318, 650, { width: 52, height: 52, borderRadius: 26, background: cor.branco, boxShadow: "0 6px 16px rgba(42,33,28,0.14)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - Math.min(1, card * 2) })}>
      <Icone n="mira" t={22} e={2} />
    </div>

    <div style={abs(POS_FICHA.x, POS_FICHA.y + (1 - card) * 260, { opacity: Math.min(1, card * 3) * (1 - cardFora), zIndex: 15 })}>
      <FichaLugar />
    </div>
    <MenuInferior ativo={2} />
  </div>
);
