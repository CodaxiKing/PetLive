import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FotosPasseioLocal } from '../passeios/fotos';
import { compartilharExportacao } from '../privacidade/arquivoExportacao';
import { concluirPasseio, novoPasseio } from '../passeios/passeio';

const m = vi.hoisted(() => ({
  arquivos: new Map<string, { bytes: Uint8Array; tamanho: number; texto?: string }>(), pastas: new Set<string>(),
  share: vi.fn(), disponivel: vi.fn(), falharCopia: false,
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => 'exportacao-1' }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-sharing', () => ({ shareAsync: m.share, isAvailableAsync: m.disponivel }));
vi.mock('expo-file-system', () => {
  const caminho = (partes: (string | { uri: string })[]) => partes.map((p) => typeof p === 'string' ? p : p.uri).join('/');
  class Directory {
    uri: string;
    constructor(...partes: (string | { uri: string })[]) { this.uri = caminho(partes); }
    get exists() { return m.pastas.has(this.uri); }
    create() { m.pastas.add(this.uri); }
    delete() { m.pastas.delete(this.uri); for (const chave of m.arquivos.keys()) if (chave.startsWith(`${this.uri}/`)) m.arquivos.delete(chave); }
  }
  class File {
    uri: string;
    constructor(...partes: (string | { uri: string })[]) { this.uri = caminho(partes); }
    get exists() { return m.arquivos.has(this.uri); }
    get size() { return m.arquivos.get(this.uri)?.tamanho ?? 0; }
    create() { m.arquivos.set(this.uri, { bytes: new Uint8Array(), tamanho: 0, texto: '' }); }
    write(texto: string, opcoes?: { append?: boolean }) {
      const valor = (opcoes?.append ? m.arquivos.get(this.uri)?.texto ?? '' : '') + texto;
      m.arquivos.set(this.uri, { texto: valor, bytes: new Uint8Array(), tamanho: valor.length });
    }
    copy(destino: File) {
      const dados = m.arquivos.get(this.uri);
      if (!dados) throw new Error('Arquivo ausente');
      m.arquivos.set(destino.uri, { ...dados, bytes: dados.bytes.slice() });
      if (m.falharCopia) throw new Error('Falha de cópia');
    }
    delete() { m.arquivos.delete(this.uri); }
    open() { return { readBytes: async (n: number) => m.arquivos.get(this.uri)!.bytes.slice(0, n), close: vi.fn() }; }
    async base64() { return Buffer.from(m.arquivos.get(this.uri)!.bytes).toString('base64'); }
  }
  return { Directory, File, Paths: { document: 'file:///documentos', cache: 'file:///cache' }, FileMode: { ReadOnly: 'r' } };
});
beforeEach(() => {
  m.arquivos.clear(); m.pastas.clear(); m.falharCopia = false; vi.clearAllMocks();
  m.disponivel.mockResolvedValue(true); m.share.mockResolvedValue(undefined);
  m.arquivos.set('file:///cache/escolhida', { bytes: Uint8Array.from([137, 80, 78, 71]), tamanho: 4 });
});

describe('fotos persistentes do passeio', () => {
  it('copia a foto para a conta e a mantém depois de remover o arquivo temporário', async () => {
    const a = new FotosPasseioLocal('tutor-a'); await a.salvar('foto-a', 'file:///cache/escolhida');
    m.arquivos.delete('file:///cache/escolhida');
    expect(m.arquivos.has(a.uri('foto-a'))).toBe(true);
    expect(a.uri('foto-a')).not.toBe(new FotosPasseioLocal('tutor-b').uri('foto-a'));
    await a.apagarTodas(); expect(m.arquivos.has(a.uri('foto-a'))).toBe(false);
  });
  it('remove arquivo parcial quando falha a cópia e recusa arquivos grandes ou endereços externos', async () => {
    const a = new FotosPasseioLocal('tutor-a'); m.falharCopia = true;
    await expect(a.salvar('foto-a', 'file:///cache/escolhida')).rejects.toThrow('cópia');
    expect(m.arquivos.has(a.uri('foto-a'))).toBe(false);
    m.arquivos.set('file:///grande', { bytes: new Uint8Array(), tamanho: 6 * 1024 * 1024 });
    await expect(a.salvar('foto-b', 'file:///grande')).rejects.toThrow('5 MB');
    await expect(a.salvar('foto-b', 'https://example.com/foto.jpg')).rejects.toThrow('local');
    expect(() => a.uri('../outra-conta')).toThrow('inválido');
  });
});

describe('exportação JSON com fotos', () => {
  it('anexa somente imagens referenciadas da conta e usa o tipo real dos bytes', async () => {
    const fotos = new FotosPasseioLocal('tutor-a'); await fotos.salvar('foto-a', 'file:///cache/escolhida');
    await new FotosPasseioLocal('tutor-b').salvar('foto-b', 'file:///cache/escolhida');
    const p = { ...concluirPasseio(novoPasseio('p-a', 'tutor-a', 'pet-a', 'Mia', 1000), 2000), fotoId: 'foto-a' };
    const verificar = vi.fn().mockResolvedValue(undefined);
    await compartilharExportacao({ passeios_locais: [p] }, 'tutor-a', [p], verificar);
    const uri = m.share.mock.calls[0][0];
    const json = JSON.parse(m.arquivos.get(uri)!.texto!);
    expect(json.fotos_passeios).toEqual([{ foto_id: 'foto-a', tipo: 'image/png', base64: Buffer.from([137, 80, 78, 71]).toString('base64') }]);
    expect(verificar).toHaveBeenCalledOnce();
    expect(m.share).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: 'application/json' }));
  });
  it('não compartilha quando a conta muda durante a preparação e remove o arquivo incompleto', async () => {
    await expect(compartilharExportacao({}, 'tutor-a', [], async () => { throw new Error('Conta mudou'); })).rejects.toThrow('Conta mudou');
    expect(m.share).not.toHaveBeenCalled();
    expect(m.arquivos.has('file:///cache/petlive-dados-exportacao-1.json')).toBe(false);
  });
  it('gera JSON válido sem fotos e informa uma referência de foto ausente', async () => {
    await compartilharExportacao({}, 'tutor-a', [], async () => undefined);
    expect(JSON.parse(m.arquivos.get(m.share.mock.calls[0][0])!.texto!)).toEqual({ fotos_passeios: [] });
    const p = { ...concluirPasseio(novoPasseio('p', 'tutor-a', 'pet', 'Mia', 1000), 2000), fotoId: 'ausente' };
    await expect(compartilharExportacao({}, 'tutor-a', [p], async () => undefined)).rejects.toThrow('não está disponível');
  });
});
