import { describe, expect, it } from 'vitest';
import { conferirRelatorio, despesasCsv, despesasHtml, mesValido, type RelatorioDespesas } from '../despesas/relatorio';
const relatorio: RelatorioDespesas = { mes: '2026-10', pet_nome: 'Mia <script>', itens: [
  { id: 'a', data: '2026-10-01', categoria: 'racao', valor_centavos: 1990, pet_nome: 'Mia', anotacao: '=HYPERLINK("https://exemplo")' },
  { id: 'b', data: '2026-10-02', categoria: 'remedios', valor_centavos: 10, pet_nome: 'Todos os pets', anotacao: 'linha; "dois"\n<três>' },
] };
describe('relatório de despesas', () => {
  it('confere mês, linhas completas, valores inteiros e categorias conhecidas', () => {
    expect(conferirRelatorio(relatorio, '2026-10')).toBe(relatorio);
    for (const r of [null, { ...relatorio, mes: '2026-09' }, { ...relatorio, itens: null },
      ...[{ valor_centavos: 1.5 }, { valor_centavos: -1 }, { categoria: 'constructor' }, { data: '2026-09-01' }, { anotacao: {} }].map((v) => ({ ...relatorio, itens: [{ ...relatorio.itens[0], ...v }] }))]) {
      expect(() => conferirRelatorio(r, '2026-10')).toThrow('incompleto');
    }
    expect(mesValido('2026-13')).toBe(false); expect(mesValido('2026-1')).toBe(false); expect(mesValido('2026-01')).toBe(true);
  });
  it('gera CSV com BOM, separador brasileiro, centavos exatos e escapes', () => {
    const csv = despesasCsv(relatorio);
    expect(csv.startsWith('\uFEFF"Data";"Pet"')).toBe(true);
    expect(csv).toContain('"01/10/2026";"Mia";"Ração";"19,90"');
    expect(csv).toContain('"linha; ""dois""\n<três>"');
    expect(csv).toContain('"\'=HYPERLINK(""https://exemplo"")"');
    expect(csv).not.toContain('recibo');
  });
  it('neutraliza fórmulas também em nomes e após espaços ou tabulação', () => {
    for (const valor of ['=1+1', '+cmd', '-1', '@SUM(1)', '  =1', '\t=1', '\n=1']) {
      const r = { ...relatorio, itens: [{ ...relatorio.itens[0], pet_nome: valor, anotacao: valor }] };
      expect(despesasCsv(r)).toContain(`"'${valor}"`);
    }
  });
  it('gera HTML sem executar marcação e soma valores e categorias em centavos', () => {
    const pdf = despesasHtml(relatorio);
    expect(pdf).toContain('Mia &lt;script&gt;'); expect(pdf).not.toContain('<três>');
    expect(pdf).toContain('&lt;três&gt;'); expect(pdf).toMatch(/20,00/); expect(pdf).toMatch(/Ração:.*19,90/);
    expect(pdf).toContain('table-header-group');
    expect(despesasHtml({ ...relatorio, itens: [] })).toContain('Nenhuma despesa registrada');
  });
});
