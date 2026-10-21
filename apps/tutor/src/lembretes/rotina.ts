import { diaNoMes } from '../lib/datas'
import { supabase } from '../lib/supabase'
import type { Pet } from '../pets/types'
import type { Lembrete, Repeticao, TipoLembrete } from './types'

/**
 * Rotina de cuidados (BUSINESS.md 5.21): lembretes recorrentes por pet,
 * gravados em `reminders` com origem = 'rotina'. Assim usam o mesmo push
 * agendado, a tela Avisos e o Não perturbe dos outros lembretes.
 */
export type ItemRotina = 'antipulgas' | 'vermifugo' | 'banho' | 'dentes' | 'aniversario'

type Definicao = {
  item: ItemRotina
  rotulo: (pet: Pet) => string
  titulo: (pet: Pet) => string
  tipo: TipoLembrete
  repetir: Repeticao
  intervaloDias: number | null
  /** Fundo do cartão no protótipo Rotina. */
  fundo: string
  /** Ligado por padrão quando o tutor abre a rotina pela primeira vez. */
  padrao: boolean
}

export const ITENS_ROTINA: Definicao[] = [
  {
    item: 'antipulgas',
    rotulo: () => 'Antipulgas e carrapatos',
    titulo: (pet) => `Antipulgas e carrapatos do ${pet.nome}`,
    tipo: 'outro',
    repetir: 'mensal',
    intervaloDias: null,
    fundo: '#E0F1FA',
    padrao: true,
  },
  {
    item: 'vermifugo',
    rotulo: () => 'Vermífugo',
    titulo: (pet) => `Vermífugo do ${pet.nome}`,
    tipo: 'vermifugo',
    repetir: 'customizado',
    intervaloDias: 90,
    fundo: '#EADCFB',
    padrao: true,
  },
  {
    item: 'banho',
    rotulo: () => 'Banho',
    titulo: (pet) => `Banho do ${pet.nome}`,
    tipo: 'banho_tosa',
    repetir: 'customizado',
    intervaloDias: 15,
    fundo: '#FFF0C9',
    padrao: true,
  },
  {
    item: 'dentes',
    rotulo: () => 'Escovar os dentes',
    titulo: (pet) => `Escovar os dentes do ${pet.nome}`,
    tipo: 'outro',
    repetir: 'customizado',
    intervaloDias: 2,
    fundo: '#F3F5F8',
    padrao: false,
  },
  {
    item: 'aniversario',
    rotulo: (pet) => `Aniversário do ${pet.nome}`,
    titulo: (pet) => `Amanhã é aniversário do ${pet.nome}!`,
    tipo: 'outro',
    repetir: 'anual',
    intervaloDias: null,
    fundo: '#FDE0E6',
    padrao: true,
  },
]

export type EscolhaRotina = {
  ligado: boolean
  /** Antipulgas: dia do mês (1 a 28, para existir em todo mês). */
  dia: number
}

export type EstadoRotina = {
  horario: string
  itens: Record<ItemRotina, EscolhaRotina>
  /** Linhas já gravadas, para manter a data das próximas ao salvar de novo. */
  existentes: Partial<Record<ItemRotina, Lembrete>>
}

const p2 = (n: number) => String(n).padStart(2, '0')

function isoLocal(data: Date, horario: string): string {
  return `${data.getFullYear()}-${p2(data.getMonth() + 1)}-${p2(data.getDate())}T${horario}:00`
}

function dataDoIso(iso: string): Date {
  const [data] = iso.split('T')
  const [a, m, d] = data.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/** Primeiro momento com o horário dado a partir de `dia` (hoje se ainda não passou). */
function aPartirDe(dia: Date, horario: string, agora: Date): Date {
  const [h, min] = horario.split(':').map(Number)
  const alvo = new Date(dia)
  alvo.setHours(h, min, 0, 0)
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1)
  return alvo
}

/** Próximo dia `diaDoMes` no horário dado. */
function proximoDiaDoMes(diaDoMes: number, horario: string, agora: Date): Date {
  const [h, min] = horario.split(':').map(Number)
  const alvo = diaNoMes(agora.getFullYear(), agora.getMonth(), diaDoMes, h, min)
  return alvo <= agora ? diaNoMes(agora.getFullYear(), agora.getMonth() + 1, diaDoMes, h, min) : alvo
}

/** Véspera do próximo aniversário, no horário dado. */
export function proximaVesperaAniversario(nascimento: string, horario: string, agora = new Date()): Date {
  const [, m, d] = nascimento.split('-').map(Number)
  const [h, min] = horario.split(':').map(Number)
  const vespera = (ano: number) => {
    const data = new Date(ano, m - 1, d, h, min)
    data.setDate(data.getDate() - 1)
    return data
  }
  const esteAno = vespera(agora.getFullYear())
  return esteAno > agora ? esteAno : vespera(agora.getFullYear() + 1)
}

/**
 * Próxima data do item. Item já gravado e ativo mantém a data (só troca o
 * horário); item novo começa: antipulgas no dia escolhido, dentes no
 * próximo horário, vermífugo e banho depois de um intervalo.
 */
export function proximaDoItem(
  definicao: Definicao,
  escolha: EscolhaRotina,
  pet: Pet,
  horario: string,
  existente: Lembrete | undefined,
  agora = new Date(),
): string | null {
  if (definicao.item === 'aniversario') {
    return pet.nascimento ? isoLocal(proximaVesperaAniversario(pet.nascimento, horario, agora), horario) : null
  }
  if (definicao.item === 'antipulgas') {
    const atual = existente?.ativo ? dataDoIso(existente.proxima_em) : null
    if (atual && atual.getDate() === escolha.dia) return isoLocal(atual, horario)
    return isoLocal(proximoDiaDoMes(escolha.dia, horario, agora), horario)
  }
  if (existente?.ativo) return isoLocal(dataDoIso(existente.proxima_em), horario)
  if (definicao.item === 'dentes') return isoLocal(aPartirDe(agora, horario, agora), horario)
  const inicio = new Date(agora)
  inicio.setDate(inicio.getDate() + (definicao.intervaloDias ?? 0))
  return isoLocal(inicio, horario)
}

/** Texto de baixo do cartão ("Todo mês, no dia 10"). */
export function descricaoItem(definicao: Definicao, escolha: EscolhaRotina, pet: Pet): string {
  switch (definicao.item) {
    case 'antipulgas':
      return `Todo mês, no dia ${escolha.dia}`
    case 'vermifugo':
      return 'A cada 3 meses'
    case 'banho':
      return 'A cada 15 dias'
    case 'dentes':
      return 'Dia sim, dia não'
    case 'aniversario': {
      if (!pet.nascimento) return 'Cadastre a data de nascimento do pet'
      const [, m, d] = pet.nascimento.split('-')
      return `${d}/${m} · aviso 1 dia antes`
    }
  }
}

/** Estado da tela a partir do que já está gravado para o pet. */
export async function carregarRotina(petId: string, horarioPadrao: string): Promise<EstadoRotina> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('pet_id', petId)
    .eq('origem', 'rotina')
  if (error) throw new Error(error.message)

  const linhas = (data ?? []) as Lembrete[]
  const existentes: EstadoRotina['existentes'] = {}
  for (const linha of linhas) if (linha.rotina_item) existentes[linha.rotina_item] = linha

  const itens = {} as EstadoRotina['itens']
  for (const definicao of ITENS_ROTINA) {
    const linha = existentes[definicao.item]
    itens[definicao.item] = {
      ligado: linha ? linha.ativo : definicao.padrao,
      dia:
        linha && definicao.item === 'antipulgas'
          ? dataDoIso(linha.proxima_em).getDate()
          : Math.min(new Date().getDate(), 28),
    }
  }

  const algumaAtiva = linhas.find((l) => l.ativo)
  const horario = algumaAtiva ? algumaAtiva.proxima_em.split('T')[1].slice(0, 5) : horarioPadrao
  return { horario, itens, existentes }
}

/** Grava todos os itens do pet de uma vez (um por pet e item). */
export async function salvarRotina(pet: Pet, estado: EstadoRotina): Promise<Lembrete[]> {
  const linhas = ITENS_ROTINA.map((definicao) => {
    const escolha = estado.itens[definicao.item]
    const existente = estado.existentes[definicao.item]
    const proxima = proximaDoItem(definicao, escolha, pet, estado.horario, existente)
    // Sem data possível (aniversário sem nascimento), o item fica desligado.
    const ativo = escolha.ligado && proxima !== null
    return {
      tutor_id: pet.tutor_id,
      pet_id: pet.id,
      origem: 'rotina',
      rotina_item: definicao.item,
      tipo: definicao.tipo,
      titulo: definicao.titulo(pet),
      proxima_em: proxima ?? existente?.proxima_em ?? new Date().toISOString(),
      repetir: definicao.repetir,
      intervalo_dias: definicao.intervaloDias,
      aviso_antes: true,
      ativo,
    }
  })

  const { data, error } = await supabase
    .from('reminders')
    .upsert(linhas, { onConflict: 'pet_id,rotina_item' })
    .select()
  if (error) throw new Error(error.message)
  return (data ?? []) as Lembrete[]
}
