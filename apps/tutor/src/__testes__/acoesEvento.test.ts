import { describe, expect, it } from 'vitest';
import { dadosAgendaEvento, linkEvento, mensagemCompartilharEvento, mensagemResultadoAgenda } from '../mapa/acoesEvento';

const evento = {
  id: '10000000-0000-4000-8000-000000000001', titulo: 'Passeio no parque',
  inicio_em: '2027-03-10T23:30:00-03:00', fim_em: '2027-03-11T01:30:00-03:00',
  local_nome: 'Parque público', descricao: 'Encontro de tutores com seus pets.',
};
describe('compartilhamento e agenda de eventos', () => {
  it('usa o esquema do app e rejeita rotas injetadas', () => {
    expect(linkEvento(evento.id)).toBe(`petlive://eventos/${evento.id}`);
    expect(() => linkEvento('../privacidade?token=segredo')).toThrow();
  });
  it('preserva o instante e a duração ao atravessar meia-noite', () => {
    const dados = dadosAgendaEvento(evento);
    expect(dados.startDate.toISOString()).toBe('2027-03-11T02:30:00.000Z');
    expect(dados.endDate.getTime() - dados.startDate.getTime()).toBe(7200000);
    expect(dados.location).toBe(evento.local_nome);
    expect(dados.timeZone).toBe('America/Sao_Paulo');
  });
  it('recusa datas inválidas e fim anterior ao início', () => {
    expect(() => dadosAgendaEvento({ ...evento, inicio_em: 'inválido' })).toThrow();
    expect(() => dadosAgendaEvento({ ...evento, fim_em: '2027-03-10T20:00:00-03:00' })).toThrow();
  });
  it('compartilha datas em Brasília, local e link, sem campos privados', () => {
    const mensagem = mensagemCompartilharEvento({ ...evento, email: 'privado@example.invalid' } as typeof evento);
    expect(mensagem).toContain('23:30');
    expect(mensagem).toContain('01:30');
    expect(mensagem).toContain('Brasília');
    expect(mensagem).toContain(evento.local_nome);
    expect(mensagem).not.toContain('privado@example.invalid');
  });
  it('não afirma que o Android salvou quando só informou fechamento do formulário', () => {
    expect(mensagemResultadoAgenda('done')).toContain('Confira');
    expect(mensagemResultadoAgenda('saved')).toContain('Evento salvo');
    expect(mensagemResultadoAgenda('canceled')).toBe('Inclusão na agenda cancelada.');
  });
});
