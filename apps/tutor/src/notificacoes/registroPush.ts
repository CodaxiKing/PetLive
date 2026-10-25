/** Serializa registro/renovação/logout para não registrar a conta anterior após sair. */
export type RegistroPush = { tutor: string; token: string };
type Dependencias = {
  permitido: () => Promise<boolean>;
  obterToken: () => Promise<string>;
  ler: () => Promise<RegistroPush | null>;
  salvar: (registro: RegistroPush | null) => Promise<void>;
  registrar: (registro: RegistroPush) => Promise<void>;
  desativar: (registro: RegistroPush) => Promise<void>;
};

export function criarRegistroPush(d: Dependencias) {
  let tutor: string | null = null;
  let versao = 0;
  let pausado = false;
  let fila: Promise<unknown> = Promise.resolve();
  function executar<T>(acao: () => Promise<T>): Promise<T> {
    const proxima = fila.then(acao);
    fila = proxima.catch(() => undefined);
    return proxima;
  }
  function sincronizar() {
    const conta = tutor;
    const inicio = versao;
    const vigente = () => conta !== null && tutor === conta && inicio === versao && !pausado;
    return executar(async () => {
      if (!vigente()) return;
      const anterior = await d.ler();
      const permitido = await d.permitido();
      if (!vigente()) return;
      if (!permitido) {
        if (anterior?.tutor === conta) {
          await d.desativar(anterior);
          await d.salvar(null);
        }
        return;
      }
      const token = await d.obterToken();
      if (!vigente()) return;
      if (anterior?.tutor === conta && anterior.token !== token) {
        await d.desativar(anterior);
      }
      if (!vigente()) return;
      const registro = { tutor: conta!, token };
      // Guarda a tentativa antes da rede: uma resposta perdida pode esconder
      // um registro bem-sucedido; o logout precisa conseguir revogá-lo também.
      await d.salvar(registro);
      if (!vigente()) return;
      // Também renova registros idênticos: o provedor pode tê-los desativado.
      await d.registrar(registro);
    });
  }
  return {
    definirConta(conta: string | null) {
      if (conta !== tutor) { tutor = conta; versao++; pausado = false; }
      return sincronizar();
    },
    sincronizar,
    prepararSaida(conta: string) {
      pausado = true;
      versao++;
      return executar(async () => {
        try {
          if (tutor !== conta) throw new Error('A conta mudou. Tente novamente.');
          const registro = await d.ler();
          if (registro?.tutor === conta) {
            await d.desativar(registro);
            await d.salvar(null);
          }
        } catch (erro) {
          pausado = false;
          throw erro;
        }
      });
    },
    retomar() { pausado = false; },
  };
}
