import { describe, expect, it } from 'vitest';

// Teste do guarda que impede commitar chaves de API do Google
// (scripts/verificar-sem-chaves-commitadas.mjs). Carregado dinamicamente
// porque é um script .mjs fora de src/.
const carregar = async () => {
  const modulo = await import('../../../../scripts/verificar-sem-chaves-commitadas.mjs');
  return modulo;
};

describe('verificar-sem-chaves-commitadas', () => {
  it('detecta uma chave do Google Maps/Places (AIza...) no texto de um arquivo', async () => {
    const { analisarArquivo } = await carregar();
    const problemas = analisarArquivo(
      'apps/tutor/src/mapa/algo.tsx',
      'const CHAVE = "AIzaSyBCDEFGhIjklmnopQRSTuvwxyZ1234567890";',
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toContain('AIza');
    expect(problemas[0]).toContain('apps/tutor/src/mapa/algo.tsx');
  });

  it('não flagra arquivo sem chave', async () => {
    const { analisarArquivo } = await carregar();
    const problemas = analisarArquivo(
      'apps/tutor/src/mapa/MapaLugares.tsx',
      'export const MAPA_GOOGLE = false;',
    );
    expect(problemas).toEqual([]);
  });

  it('encontrarChavesGoogle ignora strings curtas que não são chave', async () => {
    const { encontrarChavesGoogle } = await carregar();
    expect(encontrarChavesGoogle('AIzaSyCurta')).toEqual([]);
    expect(encontrarChavesGoogle('não há chave aqui')).toEqual([]);
  });

  it('ignora placeholders vazios de .env.example', async () => {
    const { analisarArquivo } = await carregar();
    const problemas = analisarArquivo(
      'apps/web/.env.example',
      'NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY=\n',
    );
    expect(problemas).toEqual([]);
  });
});
