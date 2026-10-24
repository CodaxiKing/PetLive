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
 * Como o Premium ainda não foi implementado (bloco 5, Fase 2), este teste
 * cobre as telas que já fazem referência ao Premium e serve de trava contra
 * regressão: se alguém adicionar um link de pagamento externo (Pix, cartão,
 * Asaas, site próprio) para assinatura Premium, o teste falha.
 */

const RAIZ_APP = join(__dirname, '..', '..', 'app');

// Arquivos do app que já referenciam o Premium ou são candidatos a telas de
// assinatura no futuro. Adicionar aqui à medida que novas telas Premium forem
// criadas.
const ARQUIVOS_PREMIUM = [
  join(RAIZ_APP, 'premium.tsx'),
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

  it('o perfil abre a consulta do plano e a tela informa a indisponibilidade de compras', () => {
    const conteudo = lerConteudo(join(RAIZ_APP, '(app)', 'perfil.tsx'));

    // O botão atual chama Alert.alert com texto informativo, não abre link externo.
    expect(conteudo).toContain("router.push('/premium')");
    expect(lerConteudo(join(RAIZ_APP, 'premium.tsx'))).toContain('A compra e a restauração de assinaturas ainda não estão disponíveis');
    // Não deve conter window.open, Linking.openURL ou expo-web-browser para pagamento externo.
    expect(conteudo).not.toMatch(/Linking\.openURL\("https/);
    expect(conteudo).not.toMatch(/WebBrowser\.openAsync\("https/);
  });
});
