export type Especie = 'cao' | 'gato'
export type Sexo = 'macho' | 'femea'

/** Linha da tabela public.pets. */
export interface Pet {
  id: string
  tutor_id: string
  nome: string
  especie: Especie
  raca: string | null
  nascimento: string | null
  sexo: Sexo | null
  peso_atual: number | null
  castrado: boolean | null
  foto_url: string | null
  cor_etiqueta: string | null
  /** Texto livre da carteirinha (alergias e condições, veterinário habitual, observações). */
  alergias?: string | null
  veterinario?: string | null
  observacoes?: string | null
  /** Partida registrada (modo memorial): fora da lista ativa, nada apagado. */
  em_memoria?: boolean
  ativo: boolean
  criado_em: string
}

/** Formulário de criação/edição. Datas em 'DD/MM/AAAA', peso em texto. */
export interface PetForm {
  nome: string
  especie: Especie
  raca: string
  sexo: Sexo
  nascimento: string
  peso: string
  castrado: boolean
}

export const FORM_VAZIO: PetForm = {
  nome: '',
  especie: 'cao',
  raca: '',
  sexo: 'macho',
  nascimento: '',
  peso: '',
  castrado: false,
}

/** 'YYYY-MM-DD' (vindo do banco) -> 'DD/MM/AAAA' (exibição). */
export function dataParaExibicao(iso: string | null | undefined): string {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
  if (!a || !m || !d) return String(iso)
  return `${d}/${m}/${a}`
}

/** 'DD/MM/AAAA' (digitado) -> 'YYYY-MM-DD' (banco). Null se inválida. */
export function dataParaIso(bruto: string): string | null {
  const apenas = bruto.replace(/\D/g, '')
  if (apenas.length !== 8) return null
  const d = apenas.slice(0, 2)
  const m = apenas.slice(2, 4)
  const a = apenas.slice(4, 8)
  const dia = Number(d)
  const mes = Number(m)
  const ano = Number(a)
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 1900) return null
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null
  return `${a}-${m}-${d}`
}

export function validarFormularioPet(form: PetForm): string | null {
  if (!form.nome.trim() || form.nome.trim().length > 60) return 'Informe um nome com até 60 caracteres.'
  if (form.nascimento.trim()) {
    const iso = dataParaIso(form.nascimento)
    if (!iso) return 'Informe uma data de nascimento válida no formato DD/MM/AAAA.'
    const hoje = new Date()
    const data = new Date(`${iso}T00:00:00`)
    if (data > hoje) return 'A data de nascimento não pode estar no futuro.'
  }
  if (form.peso.trim()) {
    const texto = form.peso.trim().replace(',', '.')
    const peso = Number(texto)
    if (!/^\d+(\.\d{1,2})?$/.test(texto) || peso <= 0 || peso > 999.99) return 'Informe um peso maior que zero, com até duas casas decimais.'
  }
  return null
}

/** Formulário -> payload de insert/update em public.pets. */
export function formParaRegistro(form: PetForm, tutorId: string) {
  return {
    tutor_id: tutorId,
    nome: form.nome.trim(),
    especie: form.especie,
    raca: form.raca.trim() || null,
    nascimento: dataParaIso(form.nascimento),
    sexo: form.sexo,
    peso_atual: form.peso.trim() ? Number(form.peso.trim().replace(',', '.')) : null,
    castrado: form.castrado,
  }
}

/** Linha do banco -> formulário. */
export function registroParaForm(pet: Pet): PetForm {
  return {
    nome: pet.nome,
    especie: pet.especie,
    raca: pet.raca ?? '',
    sexo: pet.sexo ?? 'macho',
    nascimento: dataParaExibicao(pet.nascimento),
    peso: pet.peso_atual != null ? String(pet.peso_atual).replace('.', ',') : '',
    castrado: pet.castrado ?? false,
  }
}

/** Idade humana a partir da nascimento ('YYYY-MM-DD'). */
export function idadeEmAnos(iso: string | null | undefined): string | null {
  if (!iso) return null
  const nasc = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(nasc.getTime())) return null

  const hoje = new Date()
  let anos = hoje.getFullYear() - nasc.getFullYear()
  let meses = hoje.getMonth() - nasc.getMonth()
  if (hoje.getDate() < nasc.getDate()) meses -= 1
  if (meses < 0) {
    anos -= 1
    meses += 12
  }

  if (anos < 0) return null
  if (anos === 0) return meses <= 1 ? 'menos de 1 mês' : `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  return anos === 1 ? '1 ano' : `${anos} anos`
}
