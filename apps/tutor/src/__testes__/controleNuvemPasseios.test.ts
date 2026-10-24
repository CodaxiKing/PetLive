import { describe, expect, it, vi } from 'vitest';
import { GravadorPasseio } from '../passeios/gravador';
import { concluirPasseio, novoPasseio, type Passeio } from '../passeios/passeio';
import { RepositorioPasseios } from '../passeios/repositorio';

async function ambiente() {
  const p = concluirPasseio(novoPasseio('a', 'tutor', 'pet', 'Luna', 1000), 2000);
  let conteudo = JSON.stringify([p]);
  const storage = { getItem: vi.fn(async () => conteudo), setItem: vi.fn(async (_k: string, valor: string) => { conteudo = valor; }) };
  const repo = new RepositorioPasseios('tutor', storage);
  const fotos = { salvar: vi.fn(), remover: vi.fn(), apagarTodas: vi.fn() };
  const gravador = new GravadorPasseio(repo, { observar: vi.fn() }, () => 3000, () => 'novo', fotos);
  await gravador.carregar();
  return { p, repo, gravador, fotos };
}

describe('fila do gravador com a nuvem', () => {
  it('só anuncia sucesso após validar e persistir os dados restaurados', async () => {
    const { p, repo, gravador } = await ambiente();
    expect(await gravador.sincronizar(async (_locais, salvar) => {
      const lista = [{ ...p, anotacao: 'restaurada' }]; await salvar(lista); return lista;
    })).toBe(true);
    expect((await repo.carregar())[0].anotacao).toBe('restaurada');
    expect(gravador.snapshot().aviso).toContain('sincronizados');
  });
  it('falhas de rede ou resposta de outra conta não substituem os dados locais', async () => {
    const { p, repo, gravador } = await ambiente();
    expect(await gravador.sincronizar(async () => { throw new Error('offline'); })).toBe(false);
    expect(await repo.carregar()).toEqual([p]);
    expect(await gravador.sincronizar(async (_locais, salvar) => {
      const lista = [{ ...p, tutorId: 'outro' }]; await salvar(lista); return lista;
    })).toBe(false);
    expect(await repo.carregar()).toEqual([p]);
  });
  it('edição durante sincronização fica bloqueada e não disputa a escrita do retorno', async () => {
    const { p, gravador } = await ambiente();
    let resolver!: (p: Passeio[]) => void;
    const operacao = gravador.sincronizar(async (_locais, salvar) => {
      const lista = await new Promise<Passeio[]>((r) => { resolver = r; }); await salvar(lista); return lista;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(await gravador.salvarResumo('a', 'edição tardia', undefined)).toBe(false);
    resolver([p]); expect(await operacao).toBe(true);
    expect(gravador.snapshot().passeios[0].anotacao).toBeUndefined();
  });
  it('falha na exclusão remota mantém fotos e registros locais para nova tentativa', async () => {
    const { p, repo, gravador, fotos } = await ambiente();
    expect(await gravador.apagar(async () => { throw new Error('offline'); })).toBe(false);
    expect(await repo.carregar()).toEqual([p]); expect(fotos.apagarTodas).not.toHaveBeenCalled();
  });
});
