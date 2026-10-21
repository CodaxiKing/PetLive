/** A promessa, ou null se ela não responder no prazo. */
export function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const prazo = setTimeout(() => resolve(null), ms);
    promessa.then(
      (valor) => {
        clearTimeout(prazo);
        resolve(valor);
      },
      () => {
        clearTimeout(prazo);
        resolve(null);
      },
    );
  });
}
