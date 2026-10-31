import type { TipoLembrete } from '../lembretes/types'

/**
 * Quando cada tipo de lembrete avisa, sem horário para escolher: os avisos
 * saem com a antecedência que o cuidado pede, contada a partir da hora do
 * próprio lembrete. Vale no celular (notificação local) e no servidor
 * (aviso_lembrete_push e antecedencias_aviso), que usam a mesma tabela.
 */
export const ANTECEDENCIAS_MIN: Record<TipoLembrete, number[]> = {
  vacina: [24 * 60, 2 * 60],
  vermifugo: [24 * 60, 2 * 60],
  consulta: [24 * 60, 2 * 60],
  banho_tosa: [2 * 60],
  outro: [2 * 60],
}

/** Remédio: o aviso de cada dose sai 10 minutos antes do horário. */
export const ANTECEDENCIA_REMEDIO_MIN = 10

/** "1 dia antes", "2 horas antes", "10 minutos antes", "Na hora". */
export function textoAntecedencia(minutos: number): string {
  if (minutos <= 0) return 'Na hora'
  if (minutos % (24 * 60) === 0) {
    const dias = minutos / (24 * 60)
    return dias === 1 ? '1 dia antes' : `${dias} dias antes`
  }
  if (minutos % 60 === 0) {
    const horas = minutos / 60
    return horas === 1 ? '1 hora antes' : `${horas} horas antes`
  }
  return minutos === 1 ? '1 minuto antes' : `${minutos} minutos antes`
}

/** "1 dia antes e 2 horas antes". */
export function textoAntecedencias(lista: number[]): string {
  const textos = [...lista].sort((a, b) => b - a).map(textoAntecedencia)
  if (textos.length <= 1) return textos[0] ?? 'Na hora'
  return `${textos.slice(0, -1).join(', ')} e ${textos[textos.length - 1].replace(/^N/, 'n')}`
}

/**
 * Quando os avisos do lembrete tocam, só os que ainda estão no futuro.
 * Lembrete em cima da hora ou atrasado, sem nenhum aviso pela frente: avisa
 * em 1 minuto, para o tutor ter o retorno na hora.
 */
export function momentosDoAviso(tipo: TipoLembrete, proximaEm: string, agora = Date.now()): Date[] {
  const alvo = Date.parse(proximaEm)
  if (Number.isNaN(alvo)) return []
  const futuros = (ANTECEDENCIAS_MIN[tipo] ?? [0])
    .map((min) => alvo - min * 60_000)
    .filter((t) => t > agora)
    .sort((a, b) => a - b)
  return futuros.length ? futuros.map((t) => new Date(t)) : [new Date(agora + 60_000)]
}

/** Aviso da dose de remédio: 10 minutos antes, ou logo, se a dose já está perto. */
export function momentoAvisoDose(dose: Date, agora = Date.now()): Date {
  return new Date(Math.max(dose.getTime() - ANTECEDENCIA_REMEDIO_MIN * 60_000, agora + 5_000))
}
