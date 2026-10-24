import type { Categoria } from './despesas';

export type ItemRelatorio = { id: string; data: string; categoria: Categoria; valor_centavos: number; anotacao: string | null; pet_nome: string };
export type RelatorioDespesas = { mes: string; pet_nome: string; itens: ItemRelatorio[] };
const rotulos: Record<Categoria, string> = { racao: 'Ração', veterinario: 'Veterinário', banho_tosa: 'Banho e tosa', remedios: 'Remédios', acessorios: 'Acessórios', hotel_creche: 'Hotel e creche', outros: 'Outros' };
const dinheiro = (n: number) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso: string) => iso.split('-').reverse().join('/');
export function mesValido(mes: string) { return /^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/.test(mes) && mes <= '9999-11'; }
export function conferirRelatorio(valor: unknown, mes: string): RelatorioDespesas {
  const r = valor as RelatorioDespesas | null;
  if (!r || r.mes !== mes || typeof r.pet_nome !== 'string' || !Array.isArray(r.itens) || r.itens.length > 5000 || r.itens.some((i) =>
    !i || typeof i.id !== 'string' || typeof i.pet_nome !== 'string' || typeof i.data !== 'string' || !i.data.startsWith(`${mes}-`) ||
    !Object.hasOwn(rotulos, i.categoria) || !Number.isSafeInteger(i.valor_centavos) || i.valor_centavos < 1 || i.valor_centavos > 100000000 ||
    (i.anotacao !== null && typeof i.anotacao !== 'string'))) throw new Error('O relatório recebido está incompleto. Tente novamente.');
  return r;
}
/** Quoting CSV não neutraliza fórmulas em planilhas: prefixar textos perigosos. */
function celula(texto: string) {
  const seguro = /^[\s\u0000-\u001f]*[=+\-@]/u.test(texto) || /^[\t\r\n]/u.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}
export function despesasCsv(r: RelatorioDespesas) {
  const linhas = [['Data', 'Pet', 'Categoria', 'Valor (R$)', 'Anotação'], ...r.itens.map((i) =>
    [data(i.data), i.pet_nome, rotulos[i.categoria], (i.valor_centavos / 100).toFixed(2).replace('.', ','), i.anotacao ?? ''])];
  return '\uFEFF' + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}
const html = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export function despesasHtml(r: RelatorioDespesas) {
  const total = r.itens.reduce((s, i) => s + i.valor_centavos, 0);
  const categorias = Object.entries(rotulos).map(([categoria, rotulo]) => {
    const valor = r.itens.filter((i) => i.categoria === categoria).reduce((s, i) => s + i.valor_centavos, 0);
    return valor ? `<li>${rotulo}: ${dinheiro(valor)}</li>` : '';
  }).join('');
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Despesas — PetLive</title><style>
    @page{size:A4;margin:18mm}body{font:12px sans-serif;color:#17212f}h1{font-size:24px}h2{font-size:17px}
    table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{padding:8px 5px;border-bottom:1px solid #ddd;text-align:left;overflow-wrap:anywhere}
    thead{display:table-header-group}tr{break-inside:avoid}th:nth-child(1){width:15%}th:nth-child(4){width:16%}.nota{color:#526070}
    </style></head><body><h1>Despesas do pet</h1><p>PetLive · ${html(r.mes.split('-').reverse().join('/'))} · ${html(r.pet_nome)}</p>
    <p class="nota">Inclui despesas compartilhadas com todos os pets. Valores registrados pelo tutor; este relatório não é um comprovante de pagamento.</p>
    <h2>Total: ${dinheiro(total)}</h2><p>${r.itens.length} registro(s)</p><ul>${categorias}</ul>
    <table><thead><tr><th>Data</th><th>Pet</th><th>Categoria</th><th>Valor</th><th>Anotação</th></tr></thead><tbody>${r.itens.map((i) =>
      `<tr><td>${html(data(i.data))}</td><td>${html(i.pet_nome)}</td><td>${rotulos[i.categoria]}</td><td>${dinheiro(i.valor_centavos)}</td><td>${html(i.anotacao ?? '')}</td></tr>`).join('')}
    </tbody></table>${r.itens.length ? '' : '<p>Nenhuma despesa registrada neste período.</p>'}</body></html>`;
}
