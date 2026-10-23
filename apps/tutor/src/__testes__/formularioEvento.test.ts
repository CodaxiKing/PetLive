import { describe, expect, it } from 'vitest';
import { validarFormularioEvento } from '../mapa/formularioEvento';

const base = {
  titulo: 'Passeio no parque', descricao: 'Um encontro em local público', local: 'Parque',
  inicio: '2027-03-10T10:00', fim: '2027-03-10T12:00',
  modoLocal: 'ponto' as 'ponto' | 'google', placeId: '', lat: '-22,9', lng: '-43,2',
  gratuito: true, preco: '', ingresso: '', vagas: '',
};
const agora = new Date('2027-03-01T10:00');

describe('formulário de eventos', () => {
  it('aceita coordenadas com vírgula, equador e vagas sem limite', () => {
    expect(validarFormularioEvento(base, agora)).toMatchObject({ latitude: -22.9, longitude: -43.2, numeroVagas: null });
    expect(validarFormularioEvento({ ...base, lat: '0', lng: '0' }, agora).latitude).toBe(0);
  });
  it('recusa coordenadas vazias e fora da faixa', () => {
    for (const lat of ['', ' ', 'NaN', '-91', '91']) expect(() => validarFormularioEvento({ ...base, lat }, agora)).toThrow();
    expect(() => validarFormularioEvento({ ...base, lng: '' }, agora)).toThrow();
  });
  it('exige um identificador para o modo Google', () => {
    expect(() => validarFormularioEvento({ ...base, modoLocal: 'google' }, agora)).toThrow();
    expect(() => validarFormularioEvento({ ...base, modoLocal: 'google', placeId: 'ChIJ-parque', lat: '', lng: '' }, agora)).not.toThrow();
  });
  it('recusa datas normalizadas, passadas, ordem inválida e duração excessiva', () => {
    for (const inicio of ['2027-02-31T10:00', '2027-02-01T10:00', '10/03/2027', '2027-03-10T25:00'])
      expect(() => validarFormularioEvento({ ...base, inicio }, agora)).toThrow();
    expect(() => validarFormularioEvento({ ...base, fim: base.inicio }, agora)).toThrow();
    expect(() => validarFormularioEvento({ ...base, fim: '2027-03-18T12:00' }, agora)).toThrow();
  });
  it('valida ingresso e vagas', () => {
    expect(validarFormularioEvento({ ...base, gratuito: false, preco: '25,50', ingresso: 'https://example.com', vagas: '20' }, agora)).toMatchObject({ precoCentavos: 2550, numeroVagas: 20 });
    for (const ingresso of ['https://', 'http://example.com', 'javascript:alert(1)'])
      expect(() => validarFormularioEvento({ ...base, gratuito: false, preco: '25', ingresso }, agora)).toThrow();
    for (const vagas of ['0', '1.5', '100001']) expect(() => validarFormularioEvento({ ...base, vagas }, agora)).toThrow();
  });
});
