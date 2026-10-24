import { describe, expect, it, vi } from 'vitest';
import { concluirPasseio, novoPasseio, pausarPasseio, type Passeio } from '../passeios/passeio';
import { dadosNuvem, sincronizarPasseios, type BasePasseios, type NuvemPasseios, type PasseioRemoto } from '../passeios/sincronizar';

const passeio = (id = 'a') => concluirPasseio(novoPasseio(id, 'tutor', 'pet', 'Luna', 1000), 2000);
const remoto = (p: Passeio, versao = 1): PasseioRemoto => ({ id: p.id, versao, dados: dadosNuvem(p) });
function nuvem(iniciais: PasseioRemoto[] = []) {
  const registros = new Map(iniciais.map((r) => [r.id, r]));
  return { registros, listar: vi.fn(async () => [...registros.values()]), salvar: vi.fn(async (p, versao) => {
    const salvo = remoto(p, versao + 1); registros.set(p.id, salvo); return salvo;
  }) } satisfies NuvemPasseios & { registros: Map<string, PasseioRemoto> };
}

describe('sincronização offline dos passeios', () => {
  it('envia dados locais e baixa registros de outro aparelho, preservando foto local', async () => {
    const p = { ...passeio(), fotoId: 'foto-local', anotacao: 'parque' }, cloud = nuvem([remoto(passeio('b'))]);
    const resultado = await sincronizarPasseios([p], {}, 'tutor', cloud);
    expect(cloud.salvar).toHaveBeenCalledWith(dadosNuvem(p), 0);
    expect(cloud.registros.get('a')!.dados).not.toHaveProperty('fotoId');
    expect(resultado.passeios.find((x) => x.id === 'a')!.fotoId).toBe('foto-local');
    expect(resultado.passeios.find((x) => x.id === 'b')!.fotoId).toBeUndefined();
    expect(resultado.base.a.versao).toBe(1);
  });
  it('reenvio após resposta perdida é idempotente mesmo sem base local', async () => {
    const p = passeio(), cloud = nuvem([remoto(p)]);
    await sincronizarPasseios([p], {}, 'tutor', cloud);
    expect(cloud.salvar).not.toHaveBeenCalled();
  });
  it('ordem das chaves JSONB do PostgreSQL não cria conflito falso no trajeto', async () => {
    const p = { ...passeio(), pontos: [{ lat: -22, lng: -43, instante: 1500, precisao: 5, trecho: 0 }] };
    const r = remoto({ ...p, pontos: [{ trecho: 0, precisao: 5, instante: 1500, lng: -43, lat: -22 }] });
    const cloud = nuvem([r]);
    await sincronizarPasseios([p], {}, 'tutor', cloud);
    expect(cloud.salvar).not.toHaveBeenCalled();
  });
  it('faz upload só da alteração local e importa encerramento automático remoto', async () => {
    const p = pausarPasseio(novoPasseio('a', 'tutor', 'pet', 'Luna', 1000), 2000);
    const base: BasePasseios = { a: remoto(p) };
    const cloud = nuvem([remoto(concluirPasseio(p, 2000), 2)]);
    const resultado = await sincronizarPasseios([p], base, 'tutor', cloud);
    expect(resultado.passeios[0].status).toBe('concluido');
    expect(cloud.salvar).not.toHaveBeenCalled();
    const editado = { ...resultado.passeios[0], anotacao: 'nova' };
    await sincronizarPasseios([editado], resultado.base, 'tutor', cloud);
    expect(cloud.salvar).toHaveBeenCalledWith(dadosNuvem(editado), 2);
  });
  it('conflito em dois aparelhos não sobrescreve nenhum dos registros', async () => {
    const p = passeio(), cloud = nuvem([remoto({ ...p, anotacao: 'remota' }, 2)]);
    const local = { ...p, anotacao: 'local' };
    await expect(sincronizarPasseios([local], { a: remoto(p) }, 'tutor', cloud)).rejects.toThrow('outro aparelho');
    expect(local.anotacao).toBe('local'); expect(cloud.salvar).not.toHaveBeenCalled();
  });
  it('falha parcial mantém fila local e permite repetir sem duplicar registros enviados', async () => {
    const locais = [passeio('a'), passeio('b')], cloud = nuvem();
    cloud.salvar.mockImplementationOnce(async (p) => { const r = remoto(p); cloud.registros.set(p.id, r); return r; });
    cloud.salvar.mockRejectedValueOnce(new Error('offline'));
    await expect(sincronizarPasseios(locais, {}, 'tutor', cloud)).rejects.toThrow('offline');
    expect(locais).toHaveLength(2);
    const resultado = await sincronizarPasseios(locais, {}, 'tutor', cloud);
    expect(resultado.passeios).toHaveLength(2); expect(cloud.registros.size).toBe(2);
  });
  it('bloqueia gravação ativa, conta trocada e dois passeios pausados', async () => {
    await expect(sincronizarPasseios([novoPasseio('a', 'tutor', 'pet', 'Luna', 1000)], {}, 'tutor', nuvem())).rejects.toThrow('Pause');
    await expect(sincronizarPasseios([], {}, 'outro', nuvem([remoto(passeio())]))).rejects.toThrow('conta');
    const pausado = (id: string) => pausarPasseio(novoPasseio(id, 'tutor', 'pet', 'Luna', 1000), 2000);
    const cloud = nuvem([remoto(pausado('b'))]);
    await expect(sincronizarPasseios([pausado('a')], {}, 'tutor', cloud)).rejects.toThrow('aparelhos diferentes');
    expect(cloud.salvar).not.toHaveBeenCalled();
  });
});
