/** Preparação de disponibilidade por horário, BUSINESS.md 6. Sem criar reservas. */
type Periodo = { inicio: number; fim: number };
type Reserva = Periodo & { id: string; vagas: number };
export type ConsultaHorarios = {
  /** Instantes Unix em milissegundos, materializados no fuso da loja pelo servidor. */
  dia: Periodo;
  agora: number;
  aberturas: Periodo[];
  folgas: Periodo[];
  /** Apenas reservas que bloqueiam o recurso, incluindo seu intervalo de limpeza. */
  reservas: Reserva[];
  duracaoMinutos: number;
  intervaloMinutos: number;
  capacidade: number;
  vagasSolicitadas: number;
};
export type HorarioLivre = { inicio: number; fim: number; ocupadoAte: number; vagasLivres: number };
export type ResultadoHorarios =
  | { valido: true; horarios: HorarioLivre[] }
  | { valido: false; motivo: 'dados_invalidos' | 'limite_de_dados' };

const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
function registro(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function periodo(v: unknown): boolean {
  return registro(v) && inteiro(v.inicio) && inteiro(v.fim) && v.fim > v.inicio;
}
function consulta(v: unknown): v is ConsultaHorarios {
  if (!registro(v) || !periodo(v.dia) || !inteiro(v.agora) ||
    !inteiro(v.duracaoMinutos) || v.duracaoMinutos === 0 || !inteiro(v.intervaloMinutos) ||
    !inteiro(v.capacidade) || v.capacidade === 0 || !inteiro(v.vagasSolicitadas) || v.vagasSolicitadas === 0 ||
    !Array.isArray(v.aberturas) || !Array.isArray(v.folgas) || !Array.isArray(v.reservas)) return false;
  if (!v.aberturas.every(periodo) || !v.folgas.every(periodo)) return false;
  const ids = new Set<string>();
  for (const r of v.reservas) {
    if (!registro(r) || !periodo(r) || typeof r.id !== 'string' || !r.id.trim() || ids.has(r.id) || !inteiro(r.vagas) || r.vagas === 0) return false;
    ids.add(r.id);
  }
  return Number.isSafeInteger((v.duracaoMinutos + v.intervaloMinutos) * 60000);
}
function unir(lista: Periodo[], dia: Periodo): Periodo[] {
  const ordenada = lista.map(p => ({ inicio: Math.max(p.inicio,dia.inicio), fim: Math.min(p.fim,dia.fim) }))
    .filter(p => p.fim > p.inicio).sort((a,b) => a.inicio-b.inicio || a.fim-b.fim);
  const resultado: Periodo[] = [];
  for (const p of ordenada) {
    const ultimo = resultado[resultado.length-1];
    if (ultimo && p.inicio <= ultimo.fim) ultimo.fim = Math.max(ultimo.fim,p.fim);
    else resultado.push(p);
  }
  return resultado;
}
function ocupacoes(reservas: Reserva[], dia: Periodo) {
  const eventos = new Map<number,number>();
  const adicionar = (instante: number, variacao: number) => {
    const total = (eventos.get(instante) ?? 0)+variacao;
    if (!Number.isSafeInteger(total)) return false;
    eventos.set(instante,total);
    return true;
  };
  for (const r of reservas) {
    const inicio = Math.max(r.inicio,dia.inicio), fim = Math.min(r.fim,dia.fim);
    if (inicio >= fim) continue;
    if (!adicionar(inicio,r.vagas) || !adicionar(fim,-r.vagas)) return null;
  }
  const partes: (Periodo & { usadas: number })[] = [];
  let usadas = 0, anterior = dia.inicio;
  for (const [instante,variacao] of [...eventos].sort((a,b) => a[0]-b[0])) {
    if (usadas && instante > anterior) partes.push({ inicio: anterior, fim: instante, usadas });
    usadas += variacao;
    if (!Number.isSafeInteger(variacao) || !Number.isSafeInteger(usadas) || usadas < 0) return null;
    anterior = instante;
  }
  return usadas === 0 ? partes : null;
}

/**
 * Intervalos semiabertos [início,fim); o intervalo de limpeza ocupa capacidade.
 * Grade alinhada à abertura, com passo duração+intervalo. Não assume dias de 24 h.
 * Não é autorização de reserva: o banco deve reconferir vagas sob transação.
 */
export function calcularHorariosLivres(valor: unknown): ResultadoHorarios {
  if (registro(valor) && [valor.aberturas,valor.folgas,valor.reservas].some(v => Array.isArray(v) && v.length > 10000))
    return { valido: false, motivo: 'limite_de_dados' };
  if (!consulta(valor)) return { valido: false, motivo: 'dados_invalidos' };
  const { dia,agora,capacidade,vagasSolicitadas } = valor;
  const aberturas = unir(valor.aberturas,dia), folgas = unir(valor.folgas,dia);
  const passo = (valor.duracaoMinutos+valor.intervaloMinutos)*60000;
  const duracao = valor.duracaoMinutos*60000;
  // Limite explícito; nunca devolve uma lista silenciosamente truncada.
  const candidatos = aberturas.reduce((n,p) => n+Math.floor((p.fim-p.inicio)/passo),0);
  if (candidatos > 2000) return { valido: false, motivo: 'limite_de_dados' };
  const segmentos = ocupacoes(valor.reservas,dia);
  if (!segmentos) return { valido: false, motivo: 'dados_invalidos' };
  if (vagasSolicitadas > capacidade) return { valido: true, horarios: [] };
  const horarios: HorarioLivre[] = [];
  for (const abertura of aberturas) {
    for (let inicio = abertura.inicio; inicio <= abertura.fim-passo; inicio += passo) {
      const ocupadoAte = inicio+passo;
      if (inicio < agora || folgas.some(f => f.inicio < ocupadoAte && f.fim > inicio)) continue;
      let usadas = 0;
      for (const s of segmentos) {
        if (s.inicio >= ocupadoAte) break;
        if (s.fim > inicio) usadas = Math.max(usadas,s.usadas);
      }
      const vagasLivres = Math.max(0,capacidade-usadas);
      if (vagasLivres >= vagasSolicitadas) horarios.push({ inicio,fim: inicio+duracao,ocupadoAte,vagasLivres });
    }
  }
  return { valido: true, horarios };
}
