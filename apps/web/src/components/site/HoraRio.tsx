"use client";

import { useEffect, useState } from "react";

/** Hora local do Rio, atualizada a cada 30 s (só no navegador). */
export function HoraRio() {
  const [hora, setHora] = useState<string | null>(null);

  useEffect(() => {
    const formato = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const atualizar = () => setHora(formato.format(new Date()));
    atualizar();
    const id = window.setInterval(atualizar, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return <span className="tabular-nums">{hora ? `${hora} agora` : "Horário de Brasília"}</span>;
}
