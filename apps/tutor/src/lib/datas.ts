/** Último dia do mês (mes de 0 a 11). */
function ultimoDia(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/**
 * Data no dia pedido, ou no último dia do mês se ele não tiver esse dia
 * (31 em novembro vira 30; 29/02 fora de ano bissexto vira 28/02). É o mesmo
 * que o Postgres faz com interval '1 month', e o servidor e o app concordam.
 */
export function diaNoMes(ano: number, mes: number, dia: number, horas = 0, minutos = 0): Date {
  // new Date normaliza o mês fora de 0..11 (ex.: 12 = janeiro do ano seguinte).
  const base = new Date(ano, mes, 1);
  return new Date(base.getFullYear(), base.getMonth(), Math.min(dia, ultimoDia(base.getFullYear(), base.getMonth())), horas, minutos);
}

/** Soma meses mantendo o dia (ou o último dia do mês, se faltar). */
export function somarMeses(data: Date, meses: number): Date {
  const resultado = diaNoMes(data.getFullYear(), data.getMonth() + meses, data.getDate());
  resultado.setHours(data.getHours(), data.getMinutes(), data.getSeconds(), data.getMilliseconds());
  return resultado;
}
