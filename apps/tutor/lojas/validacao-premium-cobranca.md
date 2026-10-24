# Premium: validação das regras de cobrança

Task: P-CJgTU · APP-CLIENTE · Premium · F2

Fontes oficiais consultadas em 24/10/2026.

Status: análise técnica concluída; integração, preços e homologação pendentes.

## Resultado para o PetLive

O Premium desbloqueia funcionalidades digitais. O caminho inicial já apresentado
em `app/premium.tsx` continua sendo assinatura pela loja do aparelho: Apple In-App
Purchase no iOS e Google Play Billing no Android distribuído pelo Play. Essa é a
direção da primeira integração, não uma proibição universal de alternativas.

Há alternativas regionais nas duas plataformas. Usá-las exige conferir
elegibilidade, adesão, contrato e implementação específicos. Não há evidência de
adesão do PetLive nos consoles. Não habilitar checkout externo apenas inserindo
um link no app. Esta análise não aprova preços, contrata provedores ou aceita
termos em nome do responsável.

## Fontes e condições verificadas

| Tema | Regra e aplicação |
| --- | --- |
| Apple: regra geral | 3.1.1 exige IAP para desbloquear funcionalidades; 3.1.2 trata de assinaturas e da informação clara sobre a oferta. O Premium é funcionalidade digital. [Diretrizes Apple](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase). |
| Apple: Brasil | Há alternativas na storefront brasileira no iPhone com iOS 26.5 ou posterior. Exigem entitlement e, conforme o fluxo, APIs específicas. Processador alternativo no app ou link acionável exigem oferecer IAP simultaneamente, com destaque adequado. Há avisos, controles para menores, relatórios e taxas. [Regras brasileiras](https://developer.apple.com/support/payment-options-on-the-app-store-in-brazil/). |
| Google: regra geral | Play Billing é exigido para recursos digitais, salvo exceções e programas aplicáveis. Preços no app devem corresponder aos da interface de cobrança do Play. [Política de pagamentos](https://support.google.com/googleplay/android-developer/answer/9858738?hl=pt-BR). |
| Google: Brasil | O Brasil participa do programa de escolha de faturamento para apps móveis/tablets que não sejam jogos. A alternativa é oferecida junto ao Play Billing, mediante adesão, requisitos e APIs de faturamento alternativo. Não equivale a autorização irrestrita para checkout externo. [User choice billing](https://support.google.com/googleplay/android-developer/answer/13821247). |
| Marketplace físico | Ração, banho e tosa presencial e atendimento veterinário presencial são diferentes do Premium digital. Apple 3.1.3(e) e seção 3 do Google distinguem essas transações das funcionalidades digitais. [Apple](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods), [Google](https://support.google.com/googleplay/android-developer/answer/9858738?hl=pt-BR). |

Não foi fixada uma comissão única ou presumida economia com checkout alternativo.
Recalcular custos com os contratos e programas efetivamente aceitos antes de adotar
uma alternativa.

## Correções da análise anterior

- A afirmação de que o Brasil não admite faturamento alternativo estava incorreta.
- Na Apple, 3.1.2 trata de assinaturas e 3.1.3(e), de bens/serviços físicos. A seção
  3.1.5 trata de criptomoedas. O mecanismo de restauração está na 3.1.1.
- Não há base nas fontes consultadas para exigir preços idênticos entre web,
  Apple e Google. Mostrar o preço real do canal, período e condições. A Apple
  admite preços diferentes nas alternativas brasileiras, sob suas regras.
- Adesão, restauração homologada e preços definidos não foram comprovados e não
  devem ser apresentados como entregues nesta validação documental.

## Código atual e próximos critérios técnicos

O perfil abre `/premium`. A tela consulta o plano e informa que compra e
restauração estão indisponíveis. As telas auditadas não oferecem checkout externo.
`src/__testes__/premium-validacao.test.ts` protege essa configuração atual; não
certifica elegibilidade regional nem conformidade de uma integração futura.

Para a integração planejada, os critérios técnicos propostos são:

1. Cadastrar produtos mensal/anual e obter preços localizados da loja. Não usar
   os placeholders de BUSINESS.md como valores reais.
2. Vincular a compra à conta PetLive e validar transação/token no servidor. O
   cliente não concede `profiles.plano = premium` por conta própria.
3. Processar notificações de forma idempotente: renovação, cancelamento,
   expiração e reembolso. Consultar validade, não somente um booleano.
4. Implementar restauração/sincronização e gerenciamento da assinatura. Contas
   PetLive diferentes não recebem benefícios silenciosamente da mesma compra.
5. Homologar compra, pendência, cancelamento, restauração e expiração com contas
   sandbox/licenciadas e registrar evidências antes de liberar cobrança.

Esses são critérios futuros, não funcionalidades declaradas prontas.

## Encerramento da análise e pendências relacionadas

| Entrega | Situação |
| --- | --- |
| Consulta oficial e classificação do Premium | Concluída |
| Alternativas brasileiras e condições identificadas | Concluída |
| Auditoria da configuração atual | Verificada pelos testes existentes |
| Direção da primeira integração | Mantido o fluxo pelas lojas já indicado no app |
| Produtos, preços, compra e restauração | Pendentes na task de tela Premium/assinatura |
| Validação de transações e notificações | Pendente na task backend de assinaturas/webhooks |
| Adesão a programas alternativos | Não realizada; exige decisão comercial e integração próprias |
| Homologação e publicação nas lojas | Pendentes nas tasks de assinatura/publicação |

Revalidar as fontes quando o checkout for implementado ou território/canal mudar.
A conclusão desta task é a análise das políticas, não o lançamento do Premium
nem a homologação de uma integração ainda inexistente.

## Consulta do benefício — 24/10/2026

Leituras de `profiles` que pedem `plano` (incluindo alias ou seleção completa)
não usam nem gravam autorização no cache offline. Uma resposta de perfil
antiga não confirma o Premium. Campos comuns do perfil sem o plano e leituras
de saúde continuam com o cache vinculado à conta.

Ao entrar novamente na tela ou pedir nova consulta, o estado anterior passa a
carregamento; a interface só confirma o plano após resposta atual reconhecida.
Perfil ausente, plano inesperado, erro ou sessão inválida não concedem benefício.
Essa proteção de interface não substitui autorização no backend nem validação
de transações das lojas, que continuam nas tasks de assinatura.

Validação automatizada: 126 testes passaram, incluindo falha de rede com cópia
antiga de Premium, seleções com alias/asterisco, HTTP 401, preservação das
vacinas offline e revalidação de estado. Roteiro no aparelho: consultar o plano
com internet, ativar modo avião e sair/retornar à tela Premium; deve apresentar
falha de consulta. Reconectar e tocar em Consultar novamente deve confirmar o
plano atual do servidor.
Compras e restauração seguem indisponíveis nesta versão.
