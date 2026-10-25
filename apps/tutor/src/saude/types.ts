/** Linha da tabela public.vaccinations. */
export interface Vacina {
  id: string
  pet_id: string
  nome: string
  /** Data da aplicação, 'YYYY-MM-DD'. */
  aplicada_em: string
  /** Próxima dose sugerida/agendada, 'YYYY-MM-DD'. */
  proxima_dose: string | null
  lote: string | null
  local: string | null
  observacao: string | null
  criado_em: string
  /** Quem registrou (guarda compartilhada). */
  criado_por?: string | null
}

/** Linha da tabela public.vaccine_schedule (calendário sugerido). */
export interface SugestaoVacina {
  id: string
  especie: 'cao' | 'gato'
  nome: string
  /** Idade mínima da primeira dose. Apesar do nome, a unidade é DIAS. */
  primeira_dose_dias: number
  /** Intervalo até a dose seguinte. DIAS. Null = dose única. */
  reforco_dias: number | null
  descricao: string | null
  ordem: number
}

/** Formulário de registro de vacina (datas em 'DD/MM/AAAA'). */
export interface VacinaForm {
  nome: string
  aplicada_em: string
  proxima_dose: string
  lote: string
  local: string
  observacao: string
}

export const VACINA_FORM_VAZIO: VacinaForm = {
  nome: '',
  aplicada_em: '',
  proxima_dose: '',
  lote: '',
  local: '',
  observacao: '',
}

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA'. */
export function dataParaExibicao(iso: string | null | undefined): string {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
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

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA' já formatado para o campo. */
export function hojeComoCampo(): string {
  const hoje = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(hoje.getDate())}/${p(hoje.getMonth() + 1)}/${hoje.getFullYear()}`
}

/** Soma dias a uma data 'YYYY-MM-DD' e devolve 'YYYY-MM-DD'. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, m - 1, d)
  data.setDate(data.getDate() + dias)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`
}

/** Dias entre uma data e hoje. Negativo = no futuro. */
export function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  alvo.setHours(0, 0, 0, 0)
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)
}

/** Rotulo curto de urgência para a próxima dose. */
export function rotuloDose(iso: string | null | undefined): {
  texto: string
  urgencia: 'vencida' | 'hoje' | 'perto' | 'ok' | 'nenhuma'
} {
  const dias = diasAte(iso)
  if (dias == null) return { texto: '—', urgencia: 'nenhuma' }
  if (dias < 0) return { texto: `vencida há ${Math.abs(dias)}d`, urgencia: 'vencida' }
  if (dias === 0) return { texto: 'hoje', urgencia: 'hoje' }
  if (dias <= 15) return { texto: `em ${dias} dias`, urgencia: 'perto' }
  return { texto: `em ${dias} dias`, urgencia: 'ok' }
}

/** Payload de insert em public.vaccinations. */
export function formParaRegistro(form: VacinaForm, petId: string) {
  return {
    pet_id: petId,
    nome: form.nome.trim(),
    aplicada_em: dataParaIso(form.aplicada_em),
    proxima_dose: dataParaIso(form.proxima_dose),
    lote: form.lote.trim() || null,
    local: form.local.trim() || null,
    observacao: form.observacao.trim() || null,
  }
}
