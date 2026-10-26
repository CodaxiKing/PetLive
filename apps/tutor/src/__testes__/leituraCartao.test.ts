import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lerCartao, linhasDaLeitura, marcarJaCadastradas, salvarRevisao, tipoVacina, validarRevisao, type LinhaRevisao } from '../saude/leituraCartao';

const m = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn(), from: vi.fn(), base64: vi.fn() }));
vi.mock('expo-file-system', () => ({ File: class { base64 = m.base64; } }));
vi.mock('../lib/supabase', () => ({ supabase: { functions: { invoke: m.invoke }, from: m.from } }));

beforeEach(() => {
  vi.clearAllMocks();
  m.base64.mockResolvedValue('AAAA');
  m.from.mockReturnValue({ insert: m.insert });
  m.insert.mockResolvedValue({ error: null });
});

const linha = (p: Partial<LinhaRevisao> = {}): LinhaRevisao => ({
  incluir: true, nome: 'V10', aplicada: '12/09/2025', proxima: '12/09/2026', lote: 'A1', conferir: false, jaCadastrada: false, ...p,
});

describe('leitura do cartão de vacina', () => {
  it('envia a foto em base64 e descarta datas inválidas e linhas sem nome', async () => {
    m.invoke.mockResolvedValue({
      data: {
        legivel: true,
        restantes: 7,
        vacinas: [
          { nome: ' V10 ', aplicada_em: '2025-09-12', proxima_dose: '2026-13-40', lote: ' L9 ', veterinario: null, confianca: 'alta' },
          { nome: '', aplicada_em: null, proxima_dose: null, lote: null, veterinario: null, confianca: 'alta' },
          { nome: 'Antirrábica', aplicada_em: 'ontem', proxima_dose: null, lote: null, veterinario: null, confianca: 'qualquer' },
        ],
      },
      error: null,
    });
    const leitura = await lerCartao('rex', 'file:///cartao.jpg');
    expect(m.invoke).toHaveBeenCalledWith('scan-vaccine-card', { body: { pet_id: 'rex', imagem: 'AAAA', tipo: 'image/jpeg' } });
    expect(leitura.vacinas).toEqual([
      { nome: 'V10', aplicada_em: '2025-09-12', proxima_dose: null, lote: 'L9', veterinario: null, confianca: 'alta' },
      { nome: 'Antirrábica', aplicada_em: null, proxima_dose: null, lote: null, veterinario: null, confianca: 'baixa' },
    ]);
    expect(leitura.restantes).toBe(7);
  });

  it('mostra a explicação do servidor quando a leitura é recusada', async () => {
    m.invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ erro: 'Você já fez as 10 leituras deste mês.' }) } } });
    await expect(lerCartao('rex', 'file:///c.jpg')).rejects.toThrow('10 leituras');
  });

  it('pede conferência quando falta data ou houve dúvida', () => {
    const linhas = linhasDaLeitura({
      legivel: true,
      restantes: 1,
      vacinas: [
        { nome: 'V10', aplicada_em: '2025-09-12', proxima_dose: null, lote: null, veterinario: null, confianca: 'alta' },
        { nome: 'Giárdia', aplicada_em: null, proxima_dose: null, lote: null, veterinario: null, confianca: 'alta' },
      ],
    });
    expect(linhas.map((l) => [l.aplicada, l.conferir])).toEqual([['12/09/2025', false], ['', true]]);
  });

  it('não salva sem data aplicada, com data futura ou sem nada marcado', () => {
    expect(validarRevisao([linha({ aplicada: '' })])).toMatch('aplicada');
    expect(validarRevisao([linha({ aplicada: '01/01/2999' })])).toMatch('futuro');
    expect(validarRevisao([linha({ incluir: false })])).toMatch('Marque');
    expect(validarRevisao([linha(), linha({ incluir: false, aplicada: '' })])).toBeNull();
  });

  it('grava só as vacinas marcadas, com datas em ISO', async () => {
    await expect(salvarRevisao('rex', [linha(), linha({ incluir: false, nome: 'Gripe' })])).resolves.toBe(1);
    expect(m.insert).toHaveBeenCalledWith([
      { pet_id: 'rex', nome: 'V10', aplicada_em: '2025-09-12', proxima_dose: '2026-09-12', lote: 'A1', observacao: 'Lida da foto do cartão' },
    ]);
  });

  it('separa o que o pet já tem: mesmo tipo e mesma data; outra data é dose nova', () => {
    expect(tipoVacina('V10 (múltipla)')).toBe(tipoVacina('v-10'));
    const [igual, reforco] = marcarJaCadastradas(
      [linha({ nome: 'V10 (múltipla)' }), linha({ aplicada: '12/09/2026' })],
      [{ nome: 'V10', aplicada_em: '2025-09-12' }],
    );
    expect([igual.jaCadastrada, igual.incluir, reforco.jaCadastrada]).toEqual([true, false, false]);
    expect(validarRevisao([igual])).toMatch('Marque');
  });
});
