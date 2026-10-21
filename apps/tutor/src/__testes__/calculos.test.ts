import { describe, expect, it } from 'vitest';
import {
  anosDesde,
  diferencaDaFaixa,
  faseDaVida,
  formatarKg,
  idadeHumana,
  lerNumero,
  pesoIdeal,
  porcaoDiaria,
  portePeloPeso,
} from '../ferramentas/calculos';

describe('porte pelo peso', () => {
  it('usa os limites 10, 25 e 45 kg', () => {
    expect(portePeloPeso(9.9)).toBe('pequeno');
    expect(portePeloPeso(10)).toBe('medio');
    expect(portePeloPeso(24.9)).toBe('medio');
    expect(portePeloPeso(25)).toBe('grande');
    expect(portePeloPeso(45)).toBe('gigante');
  });
});

describe('idade em anos humanos', () => {
  it('1º ano vale 15, 2º soma 9 e antes de 1 ano é proporcional', () => {
    expect(idadeHumana('cao', 'medio', 0)).toBe(0);
    expect(idadeHumana('cao', 'medio', 0.5)).toBe(8);
    expect(idadeHumana('cao', 'medio', 1)).toBe(15);
    expect(idadeHumana('gato', 'pequeno', 2)).toBe(24);
  });

  it('depois dos 2 anos cães maiores envelhecem mais rápido', () => {
    expect(idadeHumana('cao', 'pequeno', 5)).toBe(36);
    expect(idadeHumana('cao', 'grande', 5)).toBe(42);
    expect(idadeHumana('cao', 'gigante', 5)).toBe(45);
    expect(idadeHumana('gato', 'medio', 10)).toBe(56);
  });
});

describe('fase da vida', () => {
  it('gigante é filhote até 1 ano e meio', () => {
    expect(faseDaVida('cao', 'gigante', 1.2)).toBe('filhote');
    expect(faseDaVida('cao', 'grande', 1.2)).toBe('adulto');
  });

  it('idoso conforme o porte (cão) e aos 11 (gato)', () => {
    expect(faseDaVida('cao', 'medio', 7.9)).toBe('adulto');
    expect(faseDaVida('cao', 'medio', 8)).toBe('idoso');
    expect(faseDaVida('cao', 'pequeno', 9)).toBe('adulto');
    expect(faseDaVida('gato', 'pequeno', 11)).toBe('idoso');
  });
});

describe('porção diária de ração', () => {
  it('labrador de 30 kg castrado: 1.436 kcal, 390 g em 2 refeições', () => {
    expect(
      porcaoDiaria({ especie: 'cao', pesoKg: 30, fase: 'adulto', atividade: 'normal', castrado: true, anos: 4 }),
    ).toEqual({ gramasDia: 390, refeicoes: 2, gramasRefeicao: 195, kcalDia: 1436 });
  });

  it('atividade alta aumenta a porção do adulto', () => {
    expect(
      porcaoDiaria({ especie: 'cao', pesoKg: 10, fase: 'adulto', atividade: 'alta', castrado: false, anos: 3 }),
    ).toMatchObject({ gramasDia: 270, kcalDia: 992 });
  });

  it('filhote come 3 vezes e a atividade não muda a porção', () => {
    const base = { especie: 'gato' as const, pesoKg: 4, fase: 'filhote' as const, castrado: false, anos: 0.5 };
    const normal = porcaoDiaria({ ...base, atividade: 'normal' });
    expect(normal).toEqual({ gramasDia: 135, refeicoes: 3, gramasRefeicao: 45, kcalDia: 495 });
    expect(porcaoDiaria({ ...base, atividade: 'alta' })).toEqual(normal);
  });

  it('peso inválido não calcula', () => {
    const base = { especie: 'cao' as const, fase: 'adulto' as const, atividade: 'normal' as const, castrado: true, anos: 3 };
    expect(porcaoDiaria({ ...base, pesoKg: 0 })).toBeNull();
    expect(porcaoDiaria({ ...base, pesoKg: Number.NaN })).toBeNull();
    expect(porcaoDiaria({ ...base, pesoKg: 121 })).toBeNull();
  });
});

describe('peso ideal', () => {
  it('acha a raça mesmo com acento, hífen e texto a mais', () => {
    expect(pesoIdeal('cao', 'medio', 'Golden Retriever macho')).toEqual({
      faixa: [25, 34],
      origem: 'raca',
      raca: 'golden retriever',
    });
    expect(pesoIdeal('cao', 'pequeno', 'Lulu-da-Pomerânia').raca).toBe('lulu da pomerania');
  });

  it('prefere a raça mais específica (poodle toy, não poodle)', () => {
    expect(pesoIdeal('cao', 'pequeno', 'Poodle Toy').faixa).toEqual([2, 4]);
  });

  it('SRD usa o porte (cão) ou a média da espécie (gato)', () => {
    expect(pesoIdeal('cao', 'medio', 'SRD')).toEqual({ faixa: [10, 25], origem: 'porte' });
    expect(pesoIdeal('gato', 'medio', null)).toEqual({ faixa: [3.5, 5.5], origem: 'especie' });
  });

  it('diferença para a faixa: 0 dentro, positiva acima e negativa abaixo', () => {
    expect(diferencaDaFaixa(30, [25, 34])).toBe(0);
    expect(diferencaDaFaixa(36, [25, 34])).toBe(2);
    expect(diferencaDaFaixa(22, [25, 34])).toBe(-3);
  });
});

describe('formatação e leitura de números', () => {
  it('formata kg em pt-BR sem casa decimal à toa', () => {
    expect(formatarKg(12)).toBe('12');
    expect(formatarKg(12.25)).toBe('12,3');
    expect(formatarKg(3.04)).toBe('3');
  });

  it('lê vírgula ou ponto e recusa texto vazio', () => {
    expect(lerNumero('12,5')).toBe(12.5);
    expect(lerNumero('12.5 kg')).toBe(12.5);
    expect(lerNumero('')).toBeNaN();
    expect(lerNumero('abc')).toBeNaN();
  });

  it('idade a partir do nascimento', () => {
    const hoje = new Date('2026-10-21T12:00:00');
    expect(anosDesde('2023-10-21', hoje)).toBeCloseTo(3, 1);
    expect(anosDesde('2027-01-01', hoje)).toBeNull();
    expect(anosDesde(null, hoje)).toBeNull();
    expect(anosDesde('data errada', hoje)).toBeNull();
  });
});
