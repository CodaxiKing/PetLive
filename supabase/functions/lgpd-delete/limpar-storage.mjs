// Inventariar antes de remover evita pular arquivos ao paginar uma pasta mutável.
// Não contém credenciais nem depende do runtime Deno, para teste isolado.
export async function limparStorageConta(storage, userId, renovar = async () => {}) {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Identificador de conta inválido.');
  }
  let nomes = ['pets', 'anexos', 'ong-documentos', 'perfis', 'eventos', 'avistamentos', 'comunidade'];
  if (typeof storage.listBuckets === 'function') {
    nomes = [];
    for (let offset = 0; ; offset += 100) {
      await renovar();
      const { data, error } = await storage.listBuckets({ limit: 100, offset });
      if (error) throw error;
      if (!Array.isArray(data) || data.some((b) => typeof b.id !== 'string' || !b.id)) throw new Error('Inventário de buckets incompleto.');
      nomes.push(...data.map((b) => b.id));
      if (nomes.length > 10000) throw new Error('Limite de buckets; revisar pedido.');
      if (data.length < 100) break;
    }
  }
  for (const nomeBucket of new Set(nomes)) {
    const bucket = storage.from(nomeBucket);
    async function inventariar() {
      const arquivos = [];
      const pastas = [{ caminho: userId, nivel: 0 }];
      let entradas = 0;
      while (pastas.length) {
        const { caminho, nivel } = pastas.pop();
        if (nivel > 20) throw new Error('Limite de profundidade do Storage; revisar pedido.');
        for (let offset = 0; ; offset += 1000) {
          await renovar();
          const { data, error } = await bucket.list(caminho, {
            limit: 1000, offset, sortBy: { column: 'name', order: 'asc' },
          });
          if (error) throw error;
          if (!Array.isArray(data)) throw new Error('Listagem do Storage incompleta.');
          entradas += data.length;
          if (entradas > 100000) throw new Error('Limite de inventário do Storage; revisar pedido.');
          for (const item of data) {
            if (typeof item.name !== 'string' || !item.name ||
                item.name === '.' || item.name === '..' || /[/\\]/.test(item.name)) {
              throw new Error('Caminho inesperado no Storage.');
            }
            const filho = `${caminho}/${item.name}`;
            if (item.id === null && item.metadata === null) {
              pastas.push({ caminho: filho, nivel: nivel + 1 });
            } else if (typeof item.id === 'string' && item.id) {
              arquivos.push(filho);
            } else {
              throw new Error('Entrada inesperada no Storage.');
            }
          }
          if (data.length < 1000) break;
        }
      }
      return arquivos;
    }
    const arquivos = await inventariar();
    for (let i = 0; i < arquivos.length; i += 1000) {
      await renovar();
      const { error } = await bucket.remove(arquivos.slice(i, i + 1000));
      if (error) throw error;
    }
    // Também detecta sucesso sem remoção e arquivos criados durante a limpeza.
    if ((await inventariar()).length) throw new Error('Storage ainda contém arquivos; repetir limpeza.');
  }
}
