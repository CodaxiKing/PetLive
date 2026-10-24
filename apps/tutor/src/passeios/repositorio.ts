import { amostraValida, type Passeio } from './passeio';

export type ArmazenamentoPasseio = { getItem(chave: string): Promise<string | null>; setItem(chave: string, valor: string): Promise<void> };

/** Dados locais separados por conta. Falha/corrupção nunca vira uma lista vazia gravável. */
export class RepositorioPasseios {
  readonly chave: string;
  constructor(readonly tutorId: string, private armazenamento: ArmazenamentoPasseio) {
    if (!tutorId) throw new Error('Entre na sua conta para gravar passeios.');
    this.chave = `petlive:passeios:v1:${tutorId}`;
  }
  async carregar(): Promise<Passeio[]> {
    const texto = await this.armazenamento.getItem(this.chave);
    if (texto === null) return [];
    const dados: unknown = JSON.parse(texto);
    if (!Array.isArray(dados) || !dados.every((p) => this.valido(p))) throw new Error('Os passeios salvos não puderam ser lidos. Os dados foram preservados.');
    if (dados.filter((p: Passeio) => p.status !== 'concluido').length > 1) throw new Error('Há mais de um passeio em aberto. Os dados foram preservados.');
    return dados as Passeio[];
  }
  async salvar(passeios: Passeio[]) {
    if (!passeios.every((p) => this.valido(p))) throw new Error('Não foi possível validar o passeio antes de salvar.');
    await this.armazenamento.setItem(this.chave, JSON.stringify(passeios));
  }
  private valido(valor: unknown): valor is Passeio {
    if (!valor || typeof valor !== 'object') return false;
    const p = valor as Passeio;
    return p.tutorId === this.tutorId && typeof p.id === 'string' && typeof p.petId === 'string' && typeof p.nomePet === 'string'
      && ['gravando', 'pausado', 'concluido'].includes(p.status)
      && [p.inicio, p.atualizadoEm, p.duracaoMs, p.distanciaM, p.trecho].every((n) => Number.isFinite(n) && n >= 0)
      && (p.fim === null || Number.isFinite(p.fim))
      && (p.status === 'gravando' ? Number.isFinite(p.ativoDesde) && p.ativoDesde !== null : p.ativoDesde === null)
      && Array.isArray(p.pontos) && p.pontos.length <= 10000
      && p.pontos.every((ponto) => amostraValida(ponto) && Number.isInteger(ponto.trecho) && ponto.trecho >= 0);
  }
}
