import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limparStorageConta } from '../functions/lgpd-delete/limpar-storage.mjs';

const uid = '11111111-1111-4111-8111-111111111111';
const outro = '22222222-2222-4222-8222-222222222222';
function servidor(iniciais) {
  const objetos = new Map(Object.entries(iniciais).map(([k, v]) => [k, new Set(v)]));
  const removidos = [];
  const storage = { from(nome) {
    const arquivos = objetos.get(nome) ?? new Set();
    return {
      async list(pasta, { offset, limit }) {
        const filhos = new Map();
        for (const arquivo of arquivos) {
          if (!arquivo.startsWith(`${pasta}/`)) continue;
          const resto = arquivo.slice(pasta.length + 1);
          const name = resto.split('/')[0];
          filhos.set(name, resto.includes('/') ? { name, id: null, metadata: null } : { name, id: arquivo, metadata: {} });
        }
        return { data: [...filhos.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(offset, offset + limit), error: null };
      },
      async remove(paths) {
        assert.ok(paths.length <= 1000);
        for (const path of paths) { assert.ok(path.startsWith(`${uid}/`)); arquivos.delete(path); removidos.push([nome, path]); }
        return { error: null };
      },
    };
  } };
  return { objetos, removidos, storage };
}

test('limpa fotos, documentos de saúde aninhados e ONG sem tocar outra conta', async () => {
  const s = servidor({ pets: [`${uid}/foto.jpg`, `${outro}/foto.jpg`], anexos: [`${uid}/saude/pet/exame.jpg`], 'ong-documentos': [`${uid}/estatuto.pdf`] });
  await limparStorageConta(s.storage, uid);
  assert.equal(s.removidos.length, 3);
  assert.deepEqual([...s.objetos.get('pets')], [`${outro}/foto.jpg`]);
  await limparStorageConta(s.storage, uid);
  assert.equal(s.removidos.length, 3);
});
test('pagina mais de mil arquivos e pastas sem pular ao remover', async () => {
  const arquivos = Array.from({ length: 1001 }, (_, i) => `${uid}/${String(i).padStart(4, '0')}/foto.jpg`);
  arquivos.push(...Array.from({ length: 1001 }, (_, i) => `${uid}/plano-${i}.jpg`));
  const s = servidor({ pets: arquivos });
  await limparStorageConta(s.storage, uid);
  assert.equal(s.removidos.length, 2002);
  assert.equal(s.objetos.get('pets').size, 0);
});

test('descobre buckets novos e limpa perfil, eventos, avistamentos e comunidade da própria conta', async () => {
  const nomes = ['perfis', 'eventos', 'avistamentos', 'comunidade', 'bucket-novo'];
  const s = servidor(Object.fromEntries(nomes.map(nome => [nome, [`${uid}/foto.jpg`, `${outro}/foto.jpg`]])));
  s.storage.listBuckets = async () => ({ data: nomes.map(id => ({ id })), error: null });
  let renovacoes = 0;
  await limparStorageConta(s.storage, uid, async () => { renovacoes++; });
  assert.equal(s.removidos.length, nomes.length);
  for (const nome of nomes) assert.deepEqual([...s.objetos.get(nome)], [`${outro}/foto.jpg`]);
  assert.ok(renovacoes >= 1 + nomes.length * 3);
});
test('recusa UID ou nomes que escapem da pasta e resposta incompleta', async () => {
  await assert.rejects(limparStorageConta({}, '../outra'), /inválido/);
  for (const data of [null, [{ name: '../outro', id: 'x' }], [{ name: '..', id: null, metadata: null }], [{ name: 'x' }]]) {
    const storage = { from: () => ({ list: async () => ({ data }), remove: async () => assert.fail('Não deve remover') }) };
    await assert.rejects(limparStorageConta(storage, uid));
  }
});
test('propaga erro de lista e de remoção para impedir conclusão da conta', async () => {
  for (const etapa of ['list', 'remove']) {
    const s = servidor({ pets: [`${uid}/foto.jpg`] });
    const from = s.storage.from;
    s.storage.from = (nome) => ({ ...from(nome), [etapa]: async () => ({ error: new Error('indisponível') }) });
    await assert.rejects(limparStorageConta(s.storage, uid), /indisponível/);
  }
});
test('detecta remove sem efeito e permite retomar depois da falha', async () => {
  const s = servidor({ pets: [`${uid}/foto.jpg`] });
  const from = s.storage.from;
  s.storage.from = (nome) => ({ ...from(nome), remove: async () => ({ error: null }) });
  await assert.rejects(limparStorageConta(s.storage, uid), /ainda contém/);
  s.storage.from = from;
  await limparStorageConta(s.storage, uid);
  assert.equal(s.objetos.get('pets').size, 0);
});
test('profundidade excessiva falha sem apagar dados', async () => {
  const s = servidor({ pets: [`${uid}/${'pasta/'.repeat(22)}foto.jpg`] });
  await assert.rejects(limparStorageConta(s.storage, uid), /profundidade/);
  assert.equal(s.removidos.length, 0);
});
