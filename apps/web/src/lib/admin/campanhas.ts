/** Datas do formulário seguem o fuso do navegador de quem agenda. */
export function horarioLocal(data: Date): string {
  if (!Number.isFinite(data.getTime())) throw new Error("Informe uma data válida para o envio.");
  const n = (valor: number) => String(valor).padStart(2, "0");
  return `${data.getFullYear()}-${n(data.getMonth() + 1)}-${n(data.getDate())}T${n(data.getHours())}:${n(data.getMinutes())}`;
}

export function amanha9h(agora = new Date()): string {
  const data = new Date(agora);
  data.setDate(data.getDate() + 1);
  data.setHours(9, 0, 0, 0);
  return horarioLocal(data);
}

/** Não aceita datas normalizadas silenciosamente pelo JS (31/02, salto de DST). */
export function horarioEnvio(valor: string, agora = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
    throw new Error("Informe a data e o horário do envio.");
  }
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime()) || horarioLocal(data) !== valor) {
    throw new Error("Informe uma data e um horário válidos para o envio.");
  }
  if (data.getTime() <= agora.getTime()) throw new Error("Escolha um horário futuro para o envio.");
  return data.toISOString();
}

/** A mesma operação não pode iniciar de novo até a primeira terminar. */
export function criarTravaCampanha() {
  let ocupada = false;
  return async (acao: () => Promise<void>): Promise<boolean> => {
    if (ocupada) return false;
    ocupada = true;
    try {
      await acao();
      return true;
    } finally {
      ocupada = false;
    }
  };
}
