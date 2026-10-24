import { dataParaIso } from './types';

export function dadosFotoCartao(titulo: string, data: string) {
  const realizadoEm = dataParaIso(data), nome = titulo.trim() || 'Cartão de vacina';
  const instante = realizadoEm ? Date.parse(`${realizadoEm}T12:00:00Z`) : NaN;
  if (!realizadoEm || !Number.isFinite(instante) || new Date(instante).toISOString().slice(0, 10) !== realizadoEm) throw new Error('Informe uma data válida em DD/MM/AAAA antes de fotografar.');
  if (nome.length < 2 || nome.length > 80) throw new Error('O nome do documento deve ter de 2 a 80 caracteres.');
  return { titulo: nome, realizadoEm };
}
export type FotoCartao = { uri: string; width: number; height: number };
export function tamanhoFotoCartao(tamanhos: string[]) {
  const validos = tamanhos.flatMap((valor) => {
    const partes = /^(\d+)x(\d+)$/.exec(valor);
    if (!partes) return [];
    const w = Number(partes[1]), h = Number(partes[2]);
    return w >= 720 && h >= 720 ? [{ valor, area: w * h }] : [];
  }).sort((a, b) => a.area - b.area);
  return validos.filter((v) => v.area <= 4000000).at(-1)?.valor ?? validos[0]?.valor;
}
export function validarFotoCartao(foto: FotoCartao, tamanhoBytes: number) {
  if (!foto.uri.startsWith('file://') || !Number.isFinite(foto.width) || !Number.isFinite(foto.height)
    || foto.width < 720 || foto.height < 720) throw new Error('A foto precisa ter resolução suficiente para ler o cartão. Refaça a captura.');
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0 || tamanhoBytes > 10 * 1024 * 1024) throw new Error('A foto deve ter até 10 MB. Refaça a captura.');
  return foto;
}
