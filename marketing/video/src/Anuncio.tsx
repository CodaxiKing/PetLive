import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { q } from "./base";
import { Gancho, Marca } from "./cenas/abertura";
import { Cta, EmBreve } from "./cenas/fechamento";
import { Cuidados, Emergencia, Lugares, Vacinas } from "./cenas/recursos";
import { CENAS, DURACAO_S, EFEITOS, MUSICA, NomeCena, VOLUME_MUSICA } from "./roteiro";
import { C, fontFamily } from "./theme";
import { Frases, TRANSICAO } from "./ui";

export const DURACAO_TOTAL = q(DURACAO_S);

const COMPONENTES: Record<NomeCena, React.FC> = {
  gancho: Gancho,
  marca: Marca,
  vacinas: Vacinas,
  lugares: Lugares,
  emergencia: Emergencia,
  cuidados: Cuidados,
  emBreve: EmBreve,
  cta: Cta,
};

/** Cor das palavras em destaque nas frases, combinando com a cena. */
const DESTAQUE: Record<NomeCena, string> = {
  gancho: "#FF8FA8",
  marca: C.azul,
  vacinas: C.azul,
  lugares: "#8FE0B0",
  emergencia: "#FF8FA8",
  cuidados: "#C9A8F5",
  emBreve: "#FFD66B",
  cta: C.azul,
};

const cenaEm = (s: number) => (Object.keys(CENAS) as NomeCena[]).find((n) => s >= CENAS[n].de && s < CENAS[n].ate) ?? "cta";

export const Anuncio: React.FC = () => {
  const nomes = Object.keys(CENAS) as NomeCena[];
  return (
    <AbsoluteFill style={{ fontFamily, background: C.noite }}>
      {nomes.map((n, i) => {
        const C_ = COMPONENTES[n];
        const de = q(CENAS[n].de);
        // Cada cena fica TRANSICAO quadros a mais, por baixo da entrada da próxima.
        const ate = i === nomes.length - 1 ? DURACAO_TOTAL : q(CENAS[n].ate) + TRANSICAO;
        return (
          <Sequence key={n} from={de} durationInFrames={ate - de} name={n}>
            <C_ />
          </Sequence>
        );
      })}
      <Frases corDestaque={(s) => DESTAQUE[cenaEm(s)]} />
      {MUSICA ? <Audio src={staticFile(MUSICA)} volume={VOLUME_MUSICA} /> : null}
      {EFEITOS.map((e, i) => (
        <Sequence key={i} from={q(e.em)} durationInFrames={q(2)} name={`som: ${e.som}`} layout="none">
          <Audio src={staticFile(`sfx/${e.som}.wav`)} volume={e.vol ?? 0.8} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
