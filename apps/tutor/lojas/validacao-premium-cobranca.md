# Validação: cobrar o Premium dentro do app (Apple e Google)

**Task:** P-CJgTU — APP-CLIENTE · Premium · F2  
**Status:** em validação (aguarda aprovação do P.O.)  
**Data:** 22/10/2026  
**Local:** `apps/tutor/lojas/validacao-premium-cobranca.md`

---

## 1. Objetivo

Definir, com base nas diretrizes vigentes da Apple (App Store Review Guidelines) e do Google (Play Billing Policy), se o **Premium** do PetLive (assinatura digital vendida dentro do app do tutor) deve ser cobrado obrigatoriamente pela compra no app (In-App Purchase da Apple / Google Play Billing) ou se se encaixa em alguma exceção prevista pelas lojas.

O resultado desta validação define o fluxo de pagamento do bloco **5. Premium** (BUSINESS.md, seção 25) e deve ser aprovado pelo P.O antes de iniciar a implementação da próxima fase.

---

## 2. Diretrizes da Apple — resumo do que se aplica ao Premium

Fonte: **App Store Review Guidelines**, seções **3.1, 3.1.1 e 3.1.2**.

### 3.1 — Compras dentro do app

Apps que oferecem bens ou serviços digitais (conteúdo, funcionalidades, assinaturas) desbloqueados dentro do app devem usar o **In-App Purchase (IAP)** da Apple. A Apple retém sua comissão sobre essas transações. Não é permitido cobrar por conteúdo digital desbloqueado no app por meio externo ao IAP.

### 3.1.1 — Desbloquear recursos e funcionalidade

> "Se você quiser desbloquear recursos ou funcionalidades dentro do seu app, deve usar compras no aplicativo (In-App Purchase)."

O Premium do PetLive desbloqueia recursos dentro do app (vários pets, PDF da carteira, anexos, acesso da família, leitura do cartão de vacina por foto, entre outros na seção 10 do BUSINESS.md). Por ser um **bem digital consumido dentro do app**, se enquadra obrigatoriamente na 3.1.1: a assinatura Premium deve ser vendida via IAP da Apple.

### 3.1.2 — Bens e serviços físicos fora do app

> "Se seu app permite que as pessoas comprem bens físicos ou serviços que serão consumidos fora do app, você deve usar métodos de pagamento diferentes do IAP (por exemplo, Apple Pay ou cartão de crédito)."

Essa exceção vale para **produtos físicos ou serviços externos ao app** (ex.: ração, banho e tosa, consulta veterinária — marketplace da Fase 3). Não se aplica ao Premium, que é uma assinatura digital usada dentro do próprio app.

### Outras seções relevantes (contexto)

- **3.1.3 (Reader apps):** permite apps do tipo "leitor" (revistas, vídeos, músicas) assinados fora do app, desde que não haja botão/link de compra dentro do app. **Não se aplica ao PetLive**, que não é um app de leitor de mídia.
- **3.1.5 (Material comprado no app):** conteúdo comprado no app deve ser acessível em outros dispositivos do mesmo usuário — justifica o fluxo de "restaurar compras/assinatura".
- **3.2.2 (Aceite de termos externos):** não deve haver botões, links ou chamadas que direcione o usuário para comprar fora da App Store quando a política proíbe esse direcionamento.

---

## 3. Política de Faturamento do Google Play — resumo do que se aplica ao Premium

Fonte: **Play Billing Policy** (Google Play).

### Requisito geral

Apps distribuídos no Google Play que oferecem produtos ou assinaturas digitais dentro do app devem usar o **Google Play Billing** como forma de pagamento. O Google retém sua comissão sobre essas transações.

### Assinaturas digitais

Assinaturas de conteúdo digital ou funcionalidades desbloqueadas dentro do app (como o Premium do PetLive) devem ser vendidas pelo Google Play Billing. Não é permitido oferecer pagamento externo (Pix, cartão direto, boleto) para desbloquear assinatura digital dentro do app, exceto nos casos onde a faturamento alternativo é permitido por regulamento local (ex.: Coreia do Sul, União Europeia sob DMA com condições específicas) — **o Brasil não está entre esses casos para cobrança direta externa de assinatura digital de app**.

### Produtos físicos e serviços externos

Pagamentos por bens físicos ou serviços consumidos fora do app (ex.: marketplace Fase 3 — Pix pelo Asaas, pagar na loja) não são abrangidos pelo Play Billing e podem usar outros meios. Não se aplica ao Premium.

### Restauração de compras

O Google Play gerencia automaticamente o histórico de assinaturas da conta do Google. O app deve consultar a Play Billing Library para restaurar o status da assinatura quando o usuário entra em outro dispositivo com a mesma conta. Não é obrigatório um botão "Restaurar" explícito como na Apple, mas o app deve reativar o Premium ao sincronizar com o Google Play ao mudar de dispositivo.

---

## 4. Decisão: como cobrar o Premium

### Decisão

**O Premium deve ser cobrado obrigatoriamente via compra no app:**
- **Apple:** In-App Purchase (IAP), assinatura auto-renovável.
- **Google:** Google Play Billing, assinatura.

### Justificativa

1. O Premium é um **serviço digital consumido dentro do app** (desbloqueia recursos e funcionalidades do PetLive), portanto incide a regra da Apple **3.1.1** e a regra geral de faturamento do Google Play.
2. **Não se aplica exceção:** o PetLive não é um "reader app" (3.1.3 da Apple) e o Premium não é bem físico nem serviço externo ao app (3.1.2 da Apple / Play Billing exceção de bens físicos).
3. O Brasil não permite faturamento alternativo externo para assinatura digital de app sob as regras atuais do Google Play.
4. Usar o Asaas (Pix/cartão) para o Premium dentro do app, como proposto na seção 5.13 do BUSINESS.md ("pagos por Pix ou cartão pelo Asaas"), **reprovaria nas lojas** para o Premium digital. O Asaas permanece válido para o marketplace da Fase 3 (produtos físicos/serviços fora do app) e para pagamentos que não desbloqueiem recursos digitais do app.
5. Isso muda o bloco 5 (Premium): a assinatura é gerenciada pelas lojas (Apple App Store Connect / Google Play Console), com webhook de status de assinatura para o backend (Supabase) ativar o plano `premium` no `profiles.plano`.

---

## 5. Requisitos de interface — sem direcionamento a pagamento externo

Critério de aceite: **não há botão, link ou chamada no app que direcione o tutor a pagar o Premium fora das lojas onde a política proíbe esse direcionamento.**

### Verificação no código atual (apps/tutor)

| Arquivo | Trecho | Situação |
|---------|--------|----------|
| `app/(app)/perfil.tsx` | Botão "Premium" (linhas 209-225) chama `Alert.alert('Premium', 'O Premium chega na próxima fase...')` | **OK:** não direciona a pagamento externo; apenas avisa que ainda não existe. |
| `app/despesas/index.tsx` | Texto "No plano grátis você vê os últimos 3 meses. O histórico completo fica no Premium." (linha 150) | **OK:** informativo, sem link de compra. |
| `app/pet/[id]/qualidade-de-vida.tsx` | `Alert.alert('Resumo para o veterinário', 'O resumo em PDF faz parte do Premium...')` (linhas 93-94) | **OK:** informativo, sem link de compra. |
| `app/pet/[id]/viagem.tsx` | `Alert.alert('Checklist em PDF', 'O PDF faz parte do Premium...')` (linhas 120-121) | **OK:** informativo, sem link de compra. |

**Resultado da verificação:** não há botão, link ou chamada que direcione o tutor a pagar o Premium fora das lojas. Os avisos existentes apenas informam que o recurso faz parte do Premium, sem oferecer alternativa de pagamento externa.

### Regras a manter na implementação (bloco 5)

- A tela de assinatura (`/premium`) deve abrir o fluxo de IAP (Apple) / Play Billing (Google) e **não** deve conter link para site de pagamento externo, Pix direto ou cartão pelo Asaas para o Premium.
- Testes automatizados (seção 6) impedem regressão: nenhum link/botão de pagamento externo na tela Premium.

---

## 6. Fluxo de "restaurar compras/assinatura"

### Requisito das lojas

- **Apple:** diretriz 3.1.5 exige que compras feitas no app estejam acessíveis em outros dispositivos do mesmo usuário. O app deve oferecer mecanismo de "restaurar compras" (`restoreCompletedTransactions` do StoreKit / `expo-in-app-purchases`) para reativar a assinatura em outro aparelho.
- **Google:** a Play Billing Library consulta o histórico da conta do Google; ao entrar em outro dispositivo com a mesma conta, o app consulta as assinaturas ativas e reativa o Premium.

### Fluxo definido para o PetLive

1. Tutor entra no app em um novo aparelho com a mesma conta Apple/Google.
2. Na tela de assinatura/perfil, o app dispara a restauração de compras (Apple) ou consulta `queryPurchasesAsync` (Google).
3. Se houver assinatura ativa na loja, o backend do PetLive (ou o próprio app, via recibo da loja) confirma o status e define `profiles.plano = 'premium'`.
4. O Premium é reativado imediatamente no novo aparelho (pets ilimitados, PDF, anexos, família, etc.).
5. Se não houver assinatura ativa, o tutor continua no plano grátis.

### Teste com contas de teste

Critério de aceite: **testado com contas de teste da Apple e do Google.**

- **Apple:** usar conta de teste do App Store Connect (Sandbox). Assinar o Premium no dispositivo A, restaurar compras no dispositivo B com a mesma Apple ID de teste, verificar reativação do Premium.
- **Google:** usar licença de teste do Play Console (contas de teste de licenciamento). Assinar no dispositivo A, instalar no dispositivo B com a mesma Conta do Google de teste, verificar reativação do Premium.

> **Nota:** a execução dos testes com contas de teste requer contas de desenvolvedor Apple e Google configuradas (App Store Connect / Play Console) e será concluída antes do envio para revisão das lojas.

---

## 7. Compatibilidade de preços com o site/web

Critério de aceite: **os preços do Premium nas lojas são compatíveis com os divulgados no site/web e não induzem o usuário em erro.**

### Preços

Conforme BUSINESS.md seção 10, os preços do Premium estão como `[valor]` (mensal) e `[valor]` (anual) — ainda a definir. Quando definidos:

- O preço mensal e anual na App Store e no Google Play deve ser **o mesmo** (ou equivalente, considerando conversão de moeda e comissões) ao divulgado no site do PetLive (`petlive.app.br`) e no painel admin (seção 4.4 — "Planos e cupons: Preço do Premium").
- Não pode haver preço significativamente mais caro nas lojas para induzir o usuário a pagar fora delas (proibido pela Apple e pelo Google).
- O desconto do plano anual deve ser coerente entre lojas e site.

### Ação pendente

Definir os valores de preço (mensal e anual) e publicar de forma idêntica em: App Store Connect, Google Play Console, site do PetLive e painel admin (planos/cupons).

---

## 8. Resultado da validação

| Critério | Situação |
|----------|----------|
| Diretrizes Apple 3.1, 3.1.1, 3.1.2 lidas e resumidas | ✅ Feito (seção 2) |
| Política de Faturamento do Google Play lida e resumida | ✅ Feito (seção 3) |
| Definido com justificativa se cobra via IAP/Play Billing ou exceção | ✅ **Cobrar via IAP (Apple) e Play Billing (Google)** (seção 4) |
| Sem botão/link/chamada de pagamento externo onde proibido | ✅ Verificado no código atual (seção 5) |
| Fluxo de restaurar compras/assinatura definido | ✅ Definido (seção 6); teste com contas de teste pendente de execução |
| Preços nas lojas compatíveis com site/web | ⏳ Pendente definição dos valores (seção 7) |
| Resultado documentado e aprovado pelo P.O | ⏳ **Aguardando aprovação do P.O.** |

**Decisão registrada:** O Premium é cobrado obrigatoriamente via compra no app (In-App Purchase da Apple / Google Play Billing). Não se aplica exceção. O Asaas (Pix/cartão) é usado apenas para o marketplace da Fase 3, não para o Premium.

---

## 9. Aprovação

| Papel | Nome | Assinatura | Data |
|-------|------|------------|------|
| P.O | | | |
| Tech Lead | | | |

Este documento deve ser aprovado pelo P.O antes de iniciar a implementação do fluxo de pagamento do Premium (bloco 5, BUSINESS.md seção 25).
