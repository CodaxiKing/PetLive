import type { EventoDetalhe } from './eventos';

type EventoAcao = Pick<EventoDetalhe, 'id' | 'titulo' | 'inicio_em' | 'fim_em' | 'local_nome' | 'descricao'>;

export function linkEvento(id: string): string {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new Error('Evento inválido. Atualize a ficha.');
  return `petlive://eventos/${id}`;
}

export function dadosAgendaEvento(evento: EventoAcao) {
  const startDate = new Date(evento.inicio_em);
  const endDate = new Date(evento.fim_em);
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) {
    throw new Error('As datas do evento estão inválidas. Atualize a ficha.');
  }
  return { title: evento.titulo, startDate, endDate, location: evento.local_nome,
    notes: `${evento.descricao}\n\nVer no PetLive: ${linkEvento(evento.id)}\nConfira a ficha para saber de alterações ou cancelamento.`,
    timeZone: 'America/Sao_Paulo', allDay: false };
}

export function mensagemCompartilharEvento(evento: EventoAcao): string {
  const dados = dadosAgendaEvento(evento);
  const formato = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  return `${evento.titulo}\n${formato.format(dados.startDate)} até ${formato.format(dados.endDate)} (Brasília)\n${evento.local_nome}\n\nAbra no app PetLive: ${linkEvento(evento.id)}`;
}

export function mensagemResultadoAgenda(acao: string): string {
  if (acao === 'canceled' || acao === 'deleted') return 'Inclusão na agenda cancelada.';
  const resultado = acao === 'saved' ? 'Evento salvo na agenda.' : 'Confira no aplicativo de agenda se o evento foi salvo.';
  return `${resultado} Alterações e cancelamentos no PetLive não atualizam essa cópia.`;
}
