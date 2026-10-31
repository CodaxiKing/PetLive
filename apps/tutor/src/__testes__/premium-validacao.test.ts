import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Validação da task P-CJgTU (APP-CLIENTE · Premium · F2).
 *
 * Critério de aceite: não há botão, link ou chamada no app que direcione o
 * tutor a pagar o Premium fora das lojas (Apple App Store / Google Play)
 * onde a política proíbe esse direcionamento para bens digitais/assinaturas.
 *
 * A integração atual prevê compras pelas lojas, sem adesão comprovada a
 * programas regionais alternativos. Este teste protege essa configuração;
 * não afirma que pagamentos externos sejam universalmente proibidos.
 */

const RAIZ_APP = join(__dirname, '..', '..', 'app');

// Arquivos do app que já referenciam o Premium ou são candidatos a telas de
// assinatura no futuro. Adicionar aqui à medida que novas telas Premium forem
// criadas.
const ARQUIVOS_PREMIUM = [
  join(RAIZ_APP, 'premium.tsx'),
  join(RAIZ_APP, 'premium', 'assinatura.tsx'),
  join(RAIZ_APP, 'premium', 'cancelar.tsx'),
  join(RAIZ_APP, '(app)', 'perfil.tsx'),
  join(RAIZ_APP, 'despesas', 'index.tsx'),
  join(RAIZ_APP, 'pet', '[id]', 'qualidade-de-vida.tsx'),
  join(RAIZ_APP, 'pet', '[id]', 'viagem.tsx'),
];

// Padrões que indicam direcionamento a pagamento externo para o Premium.
// Links da Apple (apps.apple.com) e do Google (play.google.com) são as próprias
// lojas e, portanto, não são proibidos.
const PADROES_PAGAMENTO_EXTERNO = [
  /https?:\/\/(?!apps\.apple\.com|play\.google\.com)[^\s"'<>]+/gi, // qualquer link http/https externo
  /asaas/gi,
  /pix\.com\.br/gi,
  /pagseguro/gi,
  /stripe/gi,
  /mercadopago/gi,
  /paypal/gi,
];

function lerConteudo(caminho: string): string {
  return readFileSync(caminho, 'utf-8');
}

describe('Validação P-CJgTU — Premium sem pagamento externo às lojas', () => {
  it('nenhuma tela de Premium contém link externo de pagamento (fora Apple/Google)', () => {
    for (const caminho of ARQUIVOS_PREMIUM) {
      const conteudo = lerConteudo(caminho);

      for (const padrao of PADROES_PAGAMENTO_EXTERNO) {
        const matches = conteudo.match(padrao);
        // toBeNull não aceita mensagem; reportamos o arquivo no próprio nome do teste via expect.
        if (matches) {
          throw new Error(
            `Arquivo ${caminho.split('app/')[1]} contém referência a pagamento externo: ${matches.join(', ')}`,
          );
        }
      }
    }
  });

  it('o Premium é comprado e restaurado só pela loja de apps, nunca por Pix', () => {
    const conteudo = lerConteudo(join(RAIZ_APP, '(app)', 'perfil.tsx'));
    const premium = lerConteudo(join(RAIZ_APP, 'premium.tsx'));

    expect(conteudo).toContain("router.push('/premium')");
    // Compra e restauração pela loja (RevenueCat); a Apple exige o botão de restaurar.
    expect(premium).toContain('comprarNaLoja');
    expect(premium).toContain('restaurarNaLoja');
    // Nenhum caminho de pagamento do app (Pix) nas telas do Premium.
    for (const caminho of ARQUIVOS_PREMIUM) {
      expect(lerConteudo(caminho)).not.toMatch(/pagamento\/pix|gerarPix|create-pix-charge/);
    }
    // Não deve conter window.open, Linking.openURL ou expo-web-browser para pagamento externo.
    expect(conteudo).not.toMatch(/Linking\.openURL\("https/);
    expect(conteudo).not.toMatch(/WebBrowser\.openAsync\("https/);
  });
});
