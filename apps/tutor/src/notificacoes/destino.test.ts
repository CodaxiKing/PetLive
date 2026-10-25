import { describe, expect, it } from 'vitest';
import { destinoNotificacao } from './destino';

describe('destino de notificação', () => {
  it('aceita as rotas dos lembretes, doses e fichas', () => {
    for (const url of ['/lembretes', '/pet/123-abc/medicamentos', '/pet/123-abc/compartilhar']) {
      expect(destinoNotificacao({ url })).toBe(url);
    }
  });
  it('recusa URL externa, caminho ambíguo, objeto ou conteúdo inválido', () => {
    for (const url of ['https://exemplo.com', '//exemplo.com', '/\\exemplo.com', '/pet/../login', '/pet/%2f', '/pet\n', {}, null]) {
      expect(destinoNotificacao({ url })).toBeNull();
    }
    expect(destinoNotificacao({})).toBeNull();
  });
});
