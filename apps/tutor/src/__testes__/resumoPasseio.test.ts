import { describe, expect, it, vi } from 'vitest';
import { GravadorPasseio } from '../passeios/gravador';
import { RepositorioPasseios } from '../passeios/repositorio';
import { novoPasseio, pausarPasseio } from '../passeios/passeio';
import { anotacaoPasseio, geometriaPasseio, limitesMapaPasseio, ritmoPasseio } from '../passeios/resumo';

const inicio = Date.parse('2026-10-24T12:00:00Z');
const pausado = () => ({ ...pausarPasseio(novoPasseio('passeio-a', 'tutor-a', 'pet-a', 'Mia', inicio), inicio + 600000), distanciaM: 1000 });

async function ambiente() {
  let salvo = JSON.stringify([pausado()]);
  const storage = { getItem: vi.fn(async () => salvo), setItem: vi.fn(async (_chave: string, valor: string) => { salvo = valor; }) };
  const repo = new RepositorioPasseios('tutor-a', storage);
  const fotos = { salvar: vi.fn().mockResolvedValue(undefined), remover: vi.fn().mockResolvedValue(undefined), apagarTodas: vi.fn().mockResolvedValue(undefined) };
  const gravador = new GravadorPasseio(repo, { observar: vi.fn() }, () => inicio + 3600000, () => 'foto-nova', fotos);
  await gravador.carregar();
  return { storage, repo, fotos, gravador };
}

describe('resumo do passeio', () => {
  it('calcula ritmo pelo tempo ativo e trata distância insuficiente sem divisão por zero', () => {
    expect(ritmoPasseio(pausado())).toBe('10:00 min/km');
    expect(ritmoPasseio({ ...pausado(), duracaoMs: 359600, distanciaM: 1000 })).toBe('6:00 min/km');
    expect(ritmoPasseio({ ...pausado(), distanciaM: 0 })).toContain('Sem distância');
    expect(anotacaoPasseio('  Bom passeio!  ')).toBe('Bom passeio!');
    expect(() => anotacaoPasseio('a'.repeat(1001))).toThrow('1.000');
  });
  it('desenha só os trechos contínuos e enquadra coordenadas na linha de data', () => {
    const pontos = [
      { lat: -22, lng: 179.999, precisao: 5, instante: inicio, trecho: 0 },
      { lat: -22.0001, lng: -179.999, precisao: 5, instante: inicio + 10000, trecho: 0 },
      { lat: -22.1, lng: -179.99, precisao: 5, instante: inicio + 20000, trecho: 1 },
    ];
    const geo = geometriaPasseio(pontos);
    expect(geo.geometry.coordinates).toHaveLength(1);
    expect(geo.geometry.coordinates[0]).toHaveLength(2);
    expect(Math.abs(geo.geometry.coordinates[0][1][0] - geo.geometry.coordinates[0][0][0])).toBeLessThan(0.01);
    expect(geo.properties).toEqual({});
    const bounds = limitesMapaPasseio(pontos)!;
    expect(bounds[2] - bounds[0]).toBeLessThan(0.1);
    expect(limitesMapaPasseio([])).toBeNull();
    const polo = limitesMapaPasseio([{ ...pontos[0], lat: 90 }])!;
    expect(polo[1]).toBeLessThan(polo[3]); expect(polo[3]).toBeLessThanOrEqual(85);
  });
  it('salva após revisão e preserva o horário em que o passeio foi pausado', async () => {
    const a = await ambiente();
    expect(await a.gravador.salvarResumo('passeio-a', '  Passeio no parque  ', 'file:///cache/foto.jpg')).toBe(true);
    expect(a.fotos.salvar).toHaveBeenCalledWith('foto-nova', 'file:///cache/foto.jpg');
    expect((await a.repo.carregar())[0]).toMatchObject({ status: 'concluido', anotacao: 'Passeio no parque', fotoId: 'foto-nova', fim: inicio + 600000, duracaoMs: 600000 });
  });
  it('remove a cópia nova se falhar a escrita do resumo, preservando o passeio pausado', async () => {
    const a = await ambiente();
    a.storage.setItem.mockRejectedValueOnce(new Error('Sem espaço'));
    expect(await a.gravador.salvarResumo('passeio-a', 'Nota', 'file:///cache/foto.jpg')).toBe(false);
    expect(a.fotos.remover).toHaveBeenCalledWith('foto-nova');
    expect((await a.repo.carregar())[0]).toMatchObject({ status: 'pausado' });
    expect(a.gravador.snapshot().erro).toBe('Sem espaço');
  });
  it('não conclui se a cópia da foto falhar e permite salvar sem foto depois', async () => {
    const a = await ambiente();
    a.fotos.salvar.mockRejectedValueOnce(new Error('Foto indisponível'));
    expect(await a.gravador.salvarResumo('passeio-a', '', 'file:///cache/foto.jpg')).toBe(false);
    expect((await a.repo.carregar())[0].status).toBe('pausado');
    expect(await a.gravador.salvarResumo('passeio-a', '', undefined)).toBe(true);
  });
  it('edita anotação sem apagar foto existente e permite removê-la explicitamente', async () => {
    const a = await ambiente();
    await a.gravador.salvarResumo('passeio-a', '', 'file:///cache/foto.jpg');
    await a.gravador.salvarResumo('passeio-a', 'Nova nota', undefined);
    expect((await a.repo.carregar())[0].fotoId).toBe('foto-nova');
    await a.gravador.salvarResumo('passeio-a', 'Nova nota', null);
    expect((await a.repo.carregar())[0].fotoId).toBeNull();
    expect(a.fotos.remover).toHaveBeenCalledWith('foto-nova');
    await a.gravador.apagar(); expect(a.fotos.apagarTodas).toHaveBeenCalled();
  });
  it('recusa campos inválidos sem concluir nem alterar registros antigos', async () => {
    const a = await ambiente();
    expect(await a.gravador.salvarResumo('passeio-a', 'a'.repeat(1001), undefined)).toBe(false);
    expect(await a.gravador.salvarResumo('passeio-a', '', '')).toBe(false);
    expect((await a.repo.carregar())[0].status).toBe('pausado');
  });
});
