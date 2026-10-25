import { describe, expect, it, vi } from 'vitest';
import { criarRegistroPush, type RegistroPush } from './registroPush';

function montar() {
  let salvo: RegistroPush | null = null;
  const d = {
    permitido: vi.fn(async () => true),
    obterToken: vi.fn(async () => 'token-1'),
    ler: vi.fn(async () => salvo),
    salvar: vi.fn(async (r: RegistroPush | null) => { salvo = r; }),
    registrar: vi.fn(async (_r: RegistroPush) => {}),
    desativar: vi.fn(async (_r: RegistroPush) => {}),
  };
  return { d, registro: criarRegistroPush(d), salvo: () => salvo };
}
function barreira() {
  let liberar!: () => void;
  const promessa = new Promise<void>((r) => { liberar = r; });
  return { promessa, liberar };
}

describe('registro de push por conta', () => {
  it('não obtém token sem permissão ou sem conta', async () => {
    const { d, registro } = montar();
    await registro.definirConta(null);
    d.permitido.mockResolvedValue(false);
    await registro.definirConta('a');
    expect(d.obterToken).not.toHaveBeenCalled();
    expect(d.registrar).not.toHaveBeenCalled();
  });
  it('renova e desativa o token anterior quando ele muda', async () => {
    const { d, registro, salvo } = montar();
    await registro.definirConta('a');
    d.obterToken.mockResolvedValue('token-2');
    await registro.sincronizar();
    expect(d.desativar).toHaveBeenCalledWith({ tutor: 'a', token: 'token-1' });
    expect(salvo()).toEqual({ tutor: 'a', token: 'token-2' });
  });
  it('revoga o registro ao detectar permissão removida', async () => {
    const { d, registro, salvo } = montar();
    await registro.definirConta('a');
    d.permitido.mockResolvedValue(false);
    await registro.sincronizar();
    expect(d.desativar).toHaveBeenCalledOnce();
    expect(salvo()).toBeNull();
  });
  it('descarta token obtido para a conta que saiu durante a consulta', async () => {
    const { d, registro } = montar();
    const trava = barreira();
    const iniciou = barreira();
    d.obterToken.mockImplementationOnce(async () => { iniciou.liberar(); await trava.promessa; return 'antigo'; });
    const primeira = registro.definirConta('a');
    await iniciou.promessa;
    const segunda = registro.definirConta('b');
    trava.liberar();
    await Promise.all([primeira, segunda]);
    expect(d.registrar.mock.calls).toEqual([[{ tutor: 'b', token: 'token-1' }]]);
  });
  it('aguarda RPC em andamento antes de revogar no logout e impede novo registro', async () => {
    const { d, registro, salvo } = montar();
    const trava = barreira();
    const iniciou = barreira();
    d.registrar.mockImplementationOnce(async () => { iniciou.liberar(); await trava.promessa; });
    const primeira = registro.definirConta('a');
    await iniciou.promessa;
    const saida = registro.prepararSaida('a');
    const renovacao = registro.sincronizar();
    expect(d.desativar).not.toHaveBeenCalled();
    trava.liberar();
    await Promise.all([primeira, saida, renovacao]);
    expect(d.desativar).toHaveBeenCalledWith({ tutor: 'a', token: 'token-1' });
    expect(d.registrar).toHaveBeenCalledOnce();
    expect(salvo()).toBeNull();
  });
  it('guarda token para revogação quando a resposta de registro se perde', async () => {
    const { d, registro, salvo } = montar();
    d.registrar.mockRejectedValueOnce(new Error('rede'));
    await expect(registro.definirConta('a')).rejects.toThrow('rede');
    expect(salvo()).toEqual({ tutor: 'a', token: 'token-1' });
    await registro.prepararSaida('a');
    expect(d.desativar).toHaveBeenCalledOnce();
  });
  it('falha de revogação impede saída e permite tentar novamente', async () => {
    const { d, registro } = montar();
    await registro.definirConta('a');
    d.desativar.mockRejectedValueOnce(new Error('offline'));
    await expect(registro.prepararSaida('a')).rejects.toThrow('offline');
    await registro.prepararSaida('a');
    expect(d.desativar).toHaveBeenCalledTimes(2);
  });
});
