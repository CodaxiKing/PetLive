/** Linha da tabela public.medications. */
export interface Remedio {
  id: string
  pet_id: string
  nome: string
  /** Ex.: "1/4 de comprimido", "2 ml". */
  dose: string
  /** Ex.: "a cada 8 horas", "2x ao dia". */
  frequencia: string
  /** Horários previstos, 'HH:MM'. */
  horarios: string[]
  /** Início do tratamento, 'YYYY-MM-DD'. */
  inicio: string
  /** Fim previsto, 'YYYY-MM-DD'. Null = até parar. */
  fim: string | null
  ativo: boolean
  observacao: string | null
  criado_em: string
}

/** Formulário de criação. Datas em 'DD/MM/AAAA'. */
export interface RemedioForm {
  nome: string
  dose: string
  frequencia: string
  /** Horários digitados como "08:00, 20:00". */
  horarios: string
  inicio: string
  fim: string
  observacao: string
}

export const REMEDIO_FORM_VAZIO: RemedioForm = {
  nome: '',
  dose: '',
  frequencia: '',
  horarios: '',
  inicio: '',
  fim: '',
  observacao: '',
}

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA'. */
export function dataParaExibicao(iso: string | null | undefined): string {
  if (!iso) return ''
  const [data] = String(iso).split('T')
  const [a, m, d] = data.split('-')
  if (!a || !m || !d) return String(iso)
  return `${d}/${m}/${a}`
}

/** 'DD/MM/AAAA' -> 'YYYY-MM-DD'. Null se inválida. */
export function dataParaIso(bruto: string): string | null {
  const apenas = bruto.replace(/\D/g, '')
  if (apenas.length !== 8) return null
  const d = apenas.slice(0, 2)
  const m = apenas.slice(2, 4)
  const a = apenas.slice(4, 8)
  if (Number(d) < 1 || Number(d) > 31 || Number(m) < 1 || Number(m) > 12 || Number(a) < 1900) {
    return null
  }
  return `${a}-${m}-${d}`
}

export function hojeComoCampo(): string {
  const hoje = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(hoje.getDate())}/${p(hoje.getMonth() + 1)}/${hoje.getFullYear()}`
}

/**
 * Converte "08:00, 20:00" (ou "0800 2000") em horários 'HH:MM' válidos.
 * Ignora trechos que não forem hora reconhecível.
 */
export function parseHorarios(bruto: string): string[] {
  return bruto
    .split(/[,\s;]+/)
    .map((pedaco) => {
      const limpo = pedaco.replace(/\D/g, '')
      if (limpo.length === 4) {
        const h = Number(limpo.slice(0, 2))
        const min = Number(limpo.slice(2, 4))
        if (h < 24 && min < 60) return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      }
      if (limpo.length === 3) {
        const h = Number(limpo.slice(0, 1))
        const min = Number(limpo.slice(1, 3))
        if (h < 24 && min < 60) return `0${h}:${String(min).padStart(2, '0')}`
      }
      return null
    })
    .filter((h): h is string => h !== null)
}

/**
 * Normaliza horários vindos do Postgres em 'HH:MM' ordenados.
 * O PostgREST aceita '08:00' no insert e devolve '08:00:00' na leitura
 * (segundos inteiros não servem: a coluna é time[]).
 */
export function normalizarHorarios(bruto: (string | number)[] | null | undefined): string[] {
  return (bruto ?? [])
    .map((h) => (typeof h === 'number' ? segundosParaHorario(h) : String(h).slice(0, 5)))
    .filter((h) => /^\d{2}:\d{2}$/.test(h))
    .sort()
}

/** Segundos desde meia-noite -> 'HH:MM'. */
export function segundosParaHorario(segundos: number): string {
  const h = Math.floor(segundos / 3600) % 24
  const m = Math.floor((segundos % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Payload de insert em public.medications. */
export function formParaRegistro(form: RemedioForm, petId: string) {
  return {
    pet_id: petId,
    nome: form.nome.trim(),
    dose: form.dose.trim(),
    frequencia: form.frequencia.trim(),
    horarios: parseHorarios(form.horarios),
    inicio: dataParaIso(form.inicio),
    fim: dataParaIso(form.fim),
    observacao: form.observacao.trim() || null,
  }
}

/** Conta quantos dias de tratamento faltam. Null = sem fim definido. */
export function diasRestantes(fimIso: string | null): number | null {
  if (!fimIso) return null
  const [a, m, d] = fimIso.split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}
