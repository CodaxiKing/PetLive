import type { Passeio } from './passeio';

export type PasseioRemoto = { id: string; versao: number; dados: Passeio };
export type BasePasseios = Record<string, PasseioRemoto>;
export type NuvemPasseios = {
  listar(): Promise<PasseioRemoto[]>;
  salvar(dados: Passeio, versao: number): Promise<PasseioRemoto>;
};

/** Fotos continuam no aparelho: não publica caminhos ou identificadores de arquivos locais. */
export function dadosNuvem(p: Passeio): Passeio {
  return { id: p.id, tutorId: p.tutorId, petId: p.petId, nomePet: p.nomePet, status: p.status,
    inicio: p.inicio, atualizadoEm: p.atualizadoEm, fim: p.fim, ativoDesde: p.ativoDesde,
    duracaoMs: p.duracaoMs, distanciaM: p.distanciaM, trecho: p.trecho,
    pontos: p.pontos.map((ponto) => ({ lat: ponto.lat, lng: ponto.lng, instante: ponto.instante, precisao: ponto.precisao, trecho: ponto.trecho })),
    anotacao: p.anotacao ?? '' };
}
const igual = (a: Passeio, b: Passeio) => JSON.stringify(dadosNuvem(a)) === JSON.stringify(dadosNuvem(b));

/** O repositório local é a fila durável: falhas de rede não retiram nenhum registro dela. */
export async function sincronizarPasseios(locais: Passeio[], base: BasePasseios, tutorId: string, nuvem: NuvemPasseios) {
  if (locais.some((p) => p.tutorId !== tutorId || p.status === 'gravando')) throw new Error('Pause a gravação antes de sincronizar.');
  const remotos = await nuvem.listar();
  if (remotos.some((r) => r.dados.tutorId !== tutorId || r.id !== r.dados.id)) throw new Error('A conta mudou durante a sincronização.');
  const porId = new Map(remotos.map((r) => [r.id, r]));
  const envios: { p: Passeio; versao: number }[] = [];
  for (const p of locais) {
    const remoto = porId.get(p.id), anterior = base[p.id];
    if (remoto && igual(p, remoto.dados)) continue; // Resposta perdida de envio anterior.
    if (remoto && anterior && igual(p, anterior.dados)) continue; // Só a nuvem mudou.
    if ((remoto?.versao ?? 0) !== (anterior?.versao ?? 0)) {
      throw new Error('Este passeio foi alterado em outro aparelho. Os dados locais foram preservados. Exporte seus dados; depois, para recuperar a cópia da nuvem, apague apenas os passeios deste aparelho e sincronize novamente.');
    }
    envios.push({ p, versao: remoto?.versao ?? 0 });
  }
  const previstos = new Map([...porId].map(([id, r]) => [id, r.dados]));
  envios.forEach(({ p }) => previstos.set(p.id, p));
  if ([...previstos.values()].filter((p) => p.status !== 'concluido').length > 1) {
    throw new Error('Há passeios pausados em aparelhos diferentes. Finalize o passeio local e tente novamente. Nenhum registro local foi substituído.');
  }
  for (const { p, versao } of envios) {
    const salvo = await nuvem.salvar(dadosNuvem(p), versao);
    if (salvo.dados.tutorId !== tutorId || salvo.id !== p.id) throw new Error('Resposta de sincronização inválida.');
    porId.set(p.id, salvo);
  }
  const fotos = new Map(locais.map((p) => [p.id, p.fotoId]));
  const passeios = [...porId.values()].map((r) => ({ ...r.dados, fotoId: fotos.get(r.id) }))
    .sort((a, b) => a.inicio - b.inicio || a.id.localeCompare(b.id));
  if (passeios.filter((p) => p.status !== 'concluido').length > 1) {
    throw new Error('Há passeios pausados em aparelhos diferentes. Finalize o passeio local e tente novamente. Nenhum registro local foi substituído.');
  }
  return { passeios, base: Object.fromEntries([...porId].map(([id, r]) => [id, r])) as BasePasseios };
}
