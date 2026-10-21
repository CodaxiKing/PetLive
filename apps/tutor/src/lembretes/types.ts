import { somarMeses } from '../lib/datas'

export type TipoLembrete = 'vacina' | 'vermifugo' | 'consulta' | 'banho_tosa' | 'outro'
export type Repeticao = 'nao' | 'diario' | 'semanal' | 'mensal' | 'anual' | 'customizado'

/** Linha da tabela public.reminders. */
export interface Lembrete {
  id: string
  tutor_id: string
  pet_id: string | null
  tipo: TipoLembrete
  titulo: string
  /** Próxima ocorrência, ISO com horário. */
  proxima_em: string
  repetir: Repeticao | null
  intervalo_dias: number | null
  ativo: boolean
  /** "Avisar 1 dia antes": quando falso, não dispara notificação. */
  aviso_antes: boolean
  /** 'rotina' quando veio da tela Rotina de cuidados. */
  origem?: 'manual' | 'rotina'
  rotina_item?: 'antipulgas' | 'vermifugo' | 'banho' | 'dentes' | 'aniversario' | null
  criado_em: string
}

/** Formulário de criação. Data em 'DD/MM/AAAA' e hora em 'HH:MM'. */
export interface LembreteForm {
  tipo: TipoLembrete
  titulo: string
  pet_id: string | null
  data: string
  hora: string
  repetir: Repeticao
  intervalo_dias: string
  aviso_antes: boolean
}

export const LEMBRETE_FORM_VAZIO: LembreteForm = {
  tipo: 'outro',
  titulo: '',
  pet_id: null,
  data: '',
  hora: '09:00',
  repetir: 'nao',
  intervalo_dias: '',
  aviso_antes: true,
}

export const TIPOS: { valor: TipoLembrete; rotulo: string; cor: string; fundo: string }[] = [
  { valor: 'vacina', rotulo: 'Vacina', cor: '#5B3C8F', fundo: '#EBDDFB' },
  { valor: 'vermifugo', rotulo: 'Vermífugo', cor: '#25683F', fundo: '#DDF3E6' },
  { valor: 'consulta', rotulo: 'Consulta', cor: '#1D5F86', fundo: '#E3F3FC' },
  { valor: 'banho_tosa', rotulo: 'Banho e tosa', cor: '#7A5F0A', fundo: '#FFF1C9' },
  { valor: 'outro', rotulo: 'Outro', cor: '#5E6878', fundo: '#EEF1F5' },
]

export const REPETICOES: { valor: Repeticao; rotulo: string }[] = [
  { valor: 'nao', rotulo: 'Uma vez' },
  { valor: 'diario', rotulo: 'Diário' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'anual', rotulo: 'Anual' },
  { valor: 'customizado', rotulo: 'A cada X dias' },
]

export const ROTULO_TIPO: Record<TipoLembrete, string> = {
  vacina: 'Vacina',
  vermifugo: 'Vermífugo',
  consulta: 'Consulta',
  banho_tosa: 'Banho e tosa',
  outro: 'Outro',
}

/** Placeholder do título conforme o tipo (protótipo Lembrete.dc.html). */
export const PLACEHOLDER_TITULO: Record<TipoLembrete, string> = {
  vacina: 'Ex.: Vacina V10',
  vermifugo: 'Ex.: Vermífugo Quantum',
  consulta: 'Ex.: Check-up anual',
  banho_tosa: 'Ex.: Banho e tosa',
  outro: 'Ex.: Cortar unhas',
}

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA'. */
export function dataParaExibicao(iso: string | null | undefined): string {
  if (!iso) return ''
  const [data] = String(iso).split('T')
  const [a, m, d] = data.split('-')
  if (!a || !m || !d) return String(iso)
  return `${d}/${m}/${a}`
}

/** 'DD/MM/AAAA' + 'HH:MM' -> ISO local 'YYYY-MM-DDTHH:MM:SS'. */
export function campoParaIso(data: string, hora: string): string | null {
  const apenasData = data.replace(/\D/g, '')
  if (apenasData.length !== 8) return null
  const [h, min] = hora.split(':')
  const d = apenasData.slice(0, 2)
  const m = apenasData.slice(2, 4)
  const a = apenasData.slice(4, 8)
  return `${a}-${m}-${d}T${(h ?? '09').padStart(2, '0')}:${(min ?? '00').padStart(2, '0')}:00`
}

/** ISO -> par data/hora para preencher o formulário. */
export function isoParaCampo(iso: string): { data: string; hora: string } {
  const [data, hora] = String(iso).split('T')
  const [a, m, d] = data.split('-')
  return {
    data: a && m && d ? `${d}/${m}/${a}` : '',
    hora: hora ? hora.slice(0, 5) : '09:00',
  }
}

/** Rotulo de proximidade, em dias. */
export function rotuloProximidade(iso: string): { texto: string; urgencia: Urgencia } {
  const [data] = iso.split('T')
  const [a, m, d] = data.split('-').map(Number)
  const alvo = new Date(a, m - 1, d)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  alvo.setHours(0, 0, 0, 0)
  const dias = Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000)

  if (dias < 0) return { texto: `atrasado ${Math.abs(dias)}d`, urgencia: 'vencido' }
  if (dias === 0) return { texto: 'hoje', urgencia: 'hoje' }
  if (dias === 1) return { texto: 'amanhã', urgencia: 'perto' }
  if (dias <= 7) return { texto: `em ${dias} dias`, urgencia: 'perto' }
  if (dias <= 30) return { texto: `em ${dias} dias`, urgencia: 'mes' }
  return { texto: `em ${dias} dias`, urgencia: 'longe' }
}

export type Urgencia = 'vencido' | 'hoje' | 'perto' | 'mes' | 'longe'

export function corUrgencia(u: Urgencia): { fundo: string; texto: string } {
  switch (u) {
    case 'vencido':
      return { fundo: '#FDECEC', texto: '#C62828' }
    case 'hoje':
      return { fundo: '#FFF1C9', texto: '#7A5F0A' }
    case 'perto':
      return { fundo: '#FFF1C9', texto: '#7A5F0A' }
    case 'mes':
      return { fundo: '#E3F3FC', texto: '#1D5F86' }
    default:
      return { fundo: '#EEF1F5', texto: '#5E6878' }
  }
}

/** Payload de insert em public.reminders. */
export function formParaRegistro(form: LembreteForm, tutorId: string) {
  const iso = campoParaIso(form.data, form.hora)
  return {
    tutor_id: tutorId,
    pet_id: form.pet_id,
    tipo: form.tipo,
    titulo: form.titulo.trim(),
    proxima_em: iso,
    repetir: form.repetir,
    intervalo_dias: form.repetir === 'customizado' ? Number(form.intervalo_dias) || null : null,
    aviso_antes: form.aviso_antes,
  }
}

/** Calcula a próxima ocorrência a partir da repetição. */
export function proximaOcorrencia(iso: string, repetir: Repeticao, intervaloDias: number): string {
  const [data, hora] = iso.split('T')
  const [a, m, d] = data.split('-').map(Number)
  let alvo = new Date(a, m - 1, d)

  if (repetir === 'diario') alvo.setDate(alvo.getDate() + 1)
  else if (repetir === 'semanal') alvo.setDate(alvo.getDate() + 7)
  // Dia 31 no mês seguinte sem 31 cai no último dia (como o servidor faz).
  else if (repetir === 'mensal') alvo = somarMeses(alvo, 1)
  else if (repetir === 'anual') alvo = somarMeses(alvo, 12)
  else if (repetir === 'customizado' && intervaloDias > 0) alvo.setDate(alvo.getDate() + intervaloDias)

  const p = (n: number) => String(n).padStart(2, '0')
  return `${alvo.getFullYear()}-${p(alvo.getMonth() + 1)}-${p(alvo.getDate())}T${hora ?? '09:00:00'}`
}
