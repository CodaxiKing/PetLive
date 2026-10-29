"use client";

import { useId, useState } from "react";
import { URL_APP_STORE, URL_GOOGLE_PLAY } from "@/components/BotoesLojas";

/**
 * A primeira tela do app já aberta: o nome do pet e a espécie. O botão
 * leva à loja quando o app estiver publicado; antes disso fica "Em breve".
 */
export function NovoPet() {
  const [nome, setNome] = useState("Rex");
  const [especie, setEspecie] = useState<"cao" | "gato">("cao");
  const idNome = useId();
  const loja = URL_GOOGLE_PLAY || URL_APP_STORE;
  const quem = nome.trim() || "seu pet";

  return (
    <div data-ui className="w-full max-w-[440px] rounded-[var(--raio-g)] bg-[var(--papel)] p-6 shadow-[0_24px_60px_rgba(17,17,17,0.22)] md:p-8">
      <p className="text-[22px] font-bold">Novo pet</p>
      <label htmlFor={idNome} className="t-pequeno mt-6 block font-semibold">
        Nome
      </label>
      <input
        id={idNome}
        value={nome}
        onChange={(e) => setNome(e.target.value.slice(0, 24))}
        autoComplete="off"
        className="mt-2 min-h-[52px] w-full rounded-[var(--raio-p)] bg-[var(--tom)] px-4 text-[17px]"
      />
      <p className="t-pequeno mt-5 font-semibold" id={`${idNome}-especie`}>
        Espécie
      </p>
      <div role="radiogroup" aria-labelledby={`${idNome}-especie`} className="mt-2 grid grid-cols-2 rounded-full bg-[var(--tom)] p-1">
        {(["cao", "gato"] as const).map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={especie === e}
            onClick={() => setEspecie(e)}
            className={`min-h-11 rounded-full text-[16px] font-semibold transition-colors ${especie === e ? "bg-[var(--tinta)] text-[var(--papel)]" : "hover:bg-[var(--ceu-claro)]"}`}
          >
            {e === "cao" ? "Cão" : "Gato"}
          </button>
        ))}
      </div>
      {loja ? (
        <a href={loja} target="_blank" rel="noopener noreferrer" className="botao mt-7 w-full">
          Cadastrar {quem} no app
        </a>
      ) : (
        <span aria-disabled="true" className="botao mt-7 w-full">
          Em breve nas lojas
        </span>
      )}
      <p className="t-pequeno mt-3 text-[var(--apagado)]">
        {loja ? "Abre a loja de apps do seu celular." : `Assim que o app chegar às lojas, ${quem} entra por aqui.`}
      </p>
    </div>
  );
}
