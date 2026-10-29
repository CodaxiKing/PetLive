"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";

type Especie = "cao" | "gato";
type Dose = { nome: string; dias: number; reforco: string };

/**
 * O calendário sugerido do app (supabase/migrations/…_calendario_vacinas.sql):
 * dias de vida na primeira dose e o intervalo do reforço, por espécie.
 */
const CALENDARIO: Record<Especie, Dose[]> = {
  cao: [
    { nome: "Vermífugo", dias: 30, reforco: "a cada 3 meses" },
    { nome: "V10", dias: 45, reforco: "reforço em 30 dias" },
    { nome: "V4 (Gêmea)", dias: 45, reforco: "reforço em 30 dias" },
    { nome: "Gripe canina", dias: 60, reforco: "anual" },
    { nome: "Giárdia", dias: 90, reforco: "anual" },
    { nome: "Antirrábica", dias: 120, reforco: "anual" },
  ],
  gato: [
    { nome: "Vermífugo", dias: 30, reforco: "a cada 3 meses" },
    { nome: "V4 Felina", dias: 45, reforco: "reforço em 30 dias" },
    { nome: "V5 Felina", dias: 45, reforco: "reforço em 30 dias" },
    { nome: "Leucemia felina", dias: 60, reforco: "anual" },
    { nome: "Antirrábica", dias: 120, reforco: "anual" },
  ],
};

const DIA = 86_400_000;

function paraIso(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function deIso(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function curta(data: Date) {
  return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}/${String(data.getFullYear()).slice(2)}`;
}

/**
 * O que o visitante faz na página: escolhe cão ou gato, informa o
 * nascimento e vê o calendário de vacinas do próprio pet.
 */
/** A data de hoje (aaaa-mm-dd) só existe no navegador; no servidor é null. */
function useHoje() {
  return useSyncExternalStore(
    () => () => {},
    () => paraIso(new Date()),
    () => null,
  );
}

export function CalendarioVacinas() {
  const [especie, setEspecie] = useState<Especie>("cao");
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const hojeIso = useHoje();
  const idCampo = useId();
  const idNota = useId();

  const hoje = hojeIso ? deIso(hojeIso) : null;
  // Até o visitante escolher, um filhote de 40 dias serve de exemplo.
  const nascimento = escolhido ?? (hoje ? paraIso(new Date(hoje.getTime() - 40 * DIA)) : "");

  const linhas = useMemo(() => {
    const base = nascimento && hojeIso ? deIso(nascimento) : null;
    const zero = hojeIso ? deIso(hojeIso) : null;
    const contas = CALENDARIO[especie].map((dose) => {
      if (!base || !zero) return { dose, data: null as Date | null, faltam: null as number | null };
      const data = new Date(base.getTime() + dose.dias * DIA);
      return { dose, data, faltam: Math.round((data.getTime() - zero.getTime()) / DIA) };
    });
    const proxima = contas.findIndex((c) => c.faltam !== null && c.faltam >= 0);
    return contas.map(({ dose, data, faltam }, i) => {
      if (faltam === null || !data) return { ...dose, data: null as string | null, situacao: `aos ${dose.dias} dias` };
      const situacao =
        faltam < 0 ? "já passou" : faltam === 0 ? "hoje" : i === proxima ? `próxima · ${faltam} dias` : `em ${faltam} dias`;
      return { ...dose, data: curta(data), situacao };
    });
  }, [especie, nascimento, hojeIso]);

  return (
    <div className="grid min-h-[88svh] items-center gap-10 py-16 lg:grid-cols-2 lg:gap-16 lg:py-24">
      {/* A carteirinha preenchida, sobre o azul da marca. */}
      <div data-revelar className="flex aspect-square w-full items-center justify-center rounded-[var(--raio-g)] bg-[var(--ceu)] p-[clamp(16px,4vw,48px)]">
        <div data-ui className="w-full max-w-[520px] rounded-[var(--raio)] bg-[var(--papel)] p-6 md:p-8" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[22px] font-bold">Vacinas sugeridas</p>
            <p className="t-pequeno text-[var(--apagado)]">{especie === "cao" ? "Cão" : "Gato"}</p>
          </div>
          <table className="mt-4 w-full border-collapse text-[16px]">
            <caption className="sr-only">Calendário sugerido de vacinas</caption>
            <thead>
              <tr className="t-pequeno text-left text-[var(--apagado)]">
                <th scope="col" className="pb-2 font-medium">Vacina</th>
                <th scope="col" className="pb-2 text-right font-medium">1ª dose</th>
                <th scope="col" className="pb-2 text-right font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.nome} className={"border-t border-[#E6EAF0]" /* taste-skill-ignore: tabela dentro do fragmento data-ui */}>
                  <td className="py-2.5">
                    <span className="font-semibold">{l.nome}</span>
                    <span className="t-pequeno block text-[var(--apagado)]">{l.reforco}</span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{l.data ?? "—"}</td>
                  <td className={`py-2.5 text-right tabular-nums ${l.situacao.startsWith("próxima") || l.situacao === "hoje" ? "font-bold" : "text-[var(--apagado)]"}`}>
                    {l.situacao}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* O texto e os controles. */}
      <div className="flex h-full flex-col justify-between gap-10">
        <div role="tablist" aria-label="Espécie" className="flex gap-6 text-[17px]" data-revelar style={{ ["--ordem" as string]: 1 }}>
          {(["cao", "gato"] as const).map((e) => (
            <button
              key={e}
              type="button"
              role="tab"
              aria-selected={especie === e}
              onClick={() => setEspecie(e)}
              className={`min-h-11 border-b-4 font-semibold transition-colors ${especie === e ? "border-[var(--tinta)] text-[var(--tinta)]" : "border-transparent text-[var(--apagado)] hover:text-[var(--tinta)]"}`}
            >
              {e === "cao" ? "Cão" : "Gato"}
            </button>
          ))}
        </div>

        <div data-revelar style={{ ["--ordem" as string]: 2 }}>
          <h2 id="calendario-titulo" className="t-titulo max-w-[14ch]">O calendário do seu pet</h2>
          <p className="t-corpo mt-6 max-w-[38ch]">
            Informe quando ele nasceu e veja as vacinas que o PetLive sugere, com a data de cada primeira dose. No app, cada uma
            vira um lembrete.
          </p>
          <label htmlFor={idCampo} className="t-pequeno mt-8 block font-semibold">
            Data de nascimento
          </label>
          <input
            id={idCampo}
            type="date"
            value={nascimento}
            max={hoje ? paraIso(hoje) : undefined}
            onChange={(ev) => setEscolhido(ev.target.value)}
            aria-describedby={idNota}
            className="campo mt-2 max-w-[280px] tabular-nums"
          />
          <p id={idNota} className="t-pequeno mt-3 max-w-[42ch] text-[var(--apagado)]">
            É uma sugestão do calendário do app. Confirme as datas com o veterinário.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2" data-revelar style={{ ["--ordem" as string]: 3 }}>
          <a href="#baixar" className="botao min-h-[72px] w-full">
            Baixar o app
          </a>
          <a href="#recursos" className="flex min-h-[72px] items-center justify-center rounded-full bg-[var(--tom)] px-4 font-bold transition-colors hover:bg-[var(--ceu-claro)]">
            Ver os recursos
          </a>
        </div>
      </div>
    </div>
  );
}
