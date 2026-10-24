import type { ArmazenamentoPasseio } from './repositorio';

function metaValida(meta: unknown): meta is number | null {
  return meta === null || (typeof meta === 'number' && Number.isFinite(meta) && meta >= 0.1 && meta <= 999.9
    && Math.abs(meta * 10 - Math.round(meta * 10)) < 0.00000001);
}

export function interpretarMeta(texto: string): number | null {
  const valor = texto.trim();
  if (!valor) return null;
  if (!/^\d{1,3}([,.]\d)?$/.test(valor)) throw new Error('Informe uma meta de 0,1 a 999,9 km, com até uma casa decimal.');
  const meta = Number(valor.replace(',', '.'));
  if (!metaValida(meta)) throw new Error('Informe uma meta de 0,1 a 999,9 km. Deixe vazio para remover.');
  return meta;
}

export class RepositorioMetaPasseios {
  readonly chave: string;
  constructor(tutorId: string, private armazenamento: ArmazenamentoPasseio) {
    if (!tutorId) throw new Error('Entre na sua conta para definir a meta.');
    this.chave = `petlive:passeios:meta:v1:${tutorId}`;
  }
  async carregar(): Promise<number | null> {
    const texto = await this.armazenamento.getItem(this.chave);
    if (texto === null) return null;
    const meta: unknown = JSON.parse(texto);
    if (!metaValida(meta)) throw new Error('Não foi possível ler a meta salva. Os dados foram preservados.');
    return meta;
  }
  async salvar(meta: number | null) {
    if (!metaValida(meta)) throw new Error('Meta inválida. Informe de 0,1 a 999,9 km.');
    await this.armazenamento.setItem(this.chave, JSON.stringify(meta));
  }
}
