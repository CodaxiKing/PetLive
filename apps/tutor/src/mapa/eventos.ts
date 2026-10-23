import { supabase } from '../lib/supabase';

export type EventoMapa = {
  id: string;
  titulo: string;
  tipo: 'adocao' | 'vacinacao' | 'passeio' | 'encontro' | 'palestra' | 'outro';
  descricao: string;
  inicio_em: string;
  fim_em: string;
  local_nome: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  foto_url: string | null;
  gratuito: boolean;
  preco_centavos: number | null;
  ingresso_url: string | null;
  vagas: number | null;
  confirmados: number;
  distancia_km: number | null;
};

export type EventoDetalhe = Omit<EventoMapa, 'distancia_km'> & {
  organizador: string;
  organizador_verificado: boolean;
  eu_vou: boolean;
};

export async function definirPresenca(eventoId: string, confirmar: boolean): Promise<EventoDetalhe> {
  const { data, error } = await supabase.rpc('evento_definir_presenca', { p_event_id: eventoId, p_confirmar: confirmar });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Evento indisponível. Atualize a ficha.');
  return data as EventoDetalhe;
}

export async function carregarEvento(eventoId: string): Promise<EventoDetalhe | null> {
  const { data, error } = await supabase.rpc('evento_detalhe', { p_event_id: eventoId });
  if (error) throw new Error(error.message);
  return data as EventoDetalhe | null;
}

/** Eventos publicados em pontos próprios, ordenados por proximidade/data. */
export async function eventosPorPerto(posicao: { lat: number; lng: number }, raioKm: number, filtro: 'hoje' | 'semana' | 'mes', tipo: EventoMapa['tipo'] | null): Promise<EventoMapa[]> {
  const inicio = new Date();
  const fim = new Date(inicio);
  if (filtro === 'hoje') fim.setHours(23, 59, 59, 999);
  else fim.setDate(fim.getDate() + (filtro === 'semana' ? 7 : 30));
  const { data, error } = await supabase.rpc('eventos_por_perto', {
    p_lat: posicao.lat,
    p_lng: posicao.lng,
    p_raio_km: raioKm,
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
    p_tipo: tipo,
    p_periodo: filtro,
    p_limite: 100,
  });
  if (error) throw error;
  return (data ?? []) as EventoMapa[];
}

export async function confirmarPresenca(eventoId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('evento_confirmar_presenca', { p_event_id: eventoId });
  if (error) throw error;
  return Boolean(data);
}

export function dataHoraEvento(inicio: string, fim: string): string {
  const dataInicio = new Date(inicio);
  const dataFim = new Date(fim);
  const dia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(dataInicio);
  const horaInicio = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(dataInicio);
  const horaFim = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(dataFim);
  return `${dia} · ${horaInicio}–${horaFim}`;
}

export const TIPO_EVENTO: Record<EventoMapa['tipo'], string> = {
  adocao: 'Adoção',
  vacinacao: 'Vacinação',
  passeio: 'Passeio',
  encontro: 'Encontro',
  palestra: 'Palestra',
  outro: 'Evento pet',
};

export type EventoMeu = Pick<EventoMapa, 'id' | 'titulo' | 'tipo' | 'inicio_em' | 'fim_em' | 'local_nome' | 'confirmados'> & {
  status: 'em_analise' | 'publicado' | 'ajuste_solicitado' | 'recusado' | 'cancelado' | 'encerrado' | 'oculto';
  motivo_status: string | null;
};

export type EventoEditavel = Omit<EventoMapa, 'confirmados' | 'distancia_km'> & {
  status: EventoMeu['status'];
  motivo_status: string | null;
};

export async function meusEventos(): Promise<EventoMeu[]> {
  const { data, error } = await supabase.rpc('meus_eventos');
  if (error) throw error;
  return (data ?? []) as EventoMeu[];
}

export async function cancelarEvento(eventoId: string): Promise<void> {
  const { error } = await supabase.rpc('evento_cancelar', { p_event_id: eventoId });
  if (error) throw error;
}

export async function carregarEventoEditavel(eventoId: string): Promise<EventoEditavel> {
  const { data, error } = await supabase.rpc('meu_evento_detalhe', { p_event_id: eventoId });
  if (error) throw error;
  if (!data) throw new Error('Evento não encontrado.');
  return data as EventoEditavel;
}

export async function atualizarEvento(eventoId: string, evento: Partial<EventoEditavel>): Promise<void> {
  const { error } = await supabase.rpc('evento_atualizar', { p_event_id: eventoId, p_evento: evento });
  if (error) throw error;
}

export async function denunciarEvento(eventoId: string, motivo: 'spam' | 'inadequado' | 'fraude' | 'local_privado' | 'informacao_falsa' | 'outro', detalhe?: string): Promise<void> {
  const { error } = await supabase.rpc('evento_denunciar', { p_event_id: eventoId, p_motivo: motivo, p_detalhe: detalhe ?? null });
  if (error) throw error;
}

export const STATUS_EVENTO: Record<EventoMeu['status'], string> = {
  em_analise: 'Em análise',
  publicado: 'Publicado',
  ajuste_solicitado: 'Ajustes solicitados',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  encerrado: 'Encerrado',
  oculto: 'Oculto para revisão',
};
