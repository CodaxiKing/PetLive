export function centavos(valor: string, permiteZero = false): number {
  const v = valor.trim();
  if (!/^\d{1,8}([,.]\d{1,2})?$/.test(v)) throw new Error('Informe o valor em reais, com até duas casas decimais e sem separador de milhar.');
  const [inteiro, decimal = ''] = v.replace(',', '.').split('.');
  const n = Number(inteiro) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n > 2147483647 || n < (permiteZero ? 0 : 1)) throw new Error('Valor fora do intervalo permitido.');
  return n;
}
export function reais(valor: number | null): string { return valor === null ? '' : (valor / 100).toFixed(2).replace('.', ','); }
export function inteiro(valor: string, minimo = 1, maximo = 2147483647): number {
  if (!/^\d+$/.test(valor)) throw new Error('Informe um número inteiro válido.');
  const n = Number(valor);
  if (!Number.isSafeInteger(n) || n < minimo || n > maximo) throw new Error('Número fora do intervalo permitido.');
  return n;
}
export function dataLocal(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) throw new Error('Data inválida.');
  const n = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())}T${n(d.getHours())}:${n(d.getMinutes())}`;
}
