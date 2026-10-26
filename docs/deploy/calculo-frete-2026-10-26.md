# Cálculo de frete — preparação do Todo

Card conferido no [Project 5](https://github.com/users/CodaxiKing/projects/5): **[BACKEND] Entrega: Cálculo da taxa por modo (fixa, bairro e distância), pedido mínimo e frete grátis**, status **Todo**. Referência de negócio: `BUSINESS.md`, seção 5.8, Fase 3.

Esta entrega prepara um módulo isolado em `supabase/functions/_shared/frete.ts`. Não habilita marketplace, cria tabelas, expõe uma Edge Function ou integra checkout/pagamento. Valores de taxa, raio, mínimo, isenção e prazo precisam vir da configuração aprovada da loja; não foram definidos preços comerciais/defaults.

## Contrato

`calcularFrete(configuracao, consulta)` recebe dados validados em runtime e devolve cotação disponível ou motivo da indisponibilidade. O chamador futuro deve buscar a configuração da loja no servidor, calcular o subtotal a partir do catálogo/pedido autorizado e obter distância/bairro por validação de endereço confiável. Não aceitar esses valores diretamente do cliente como autorização de compra.

| Campo | Regra |
|---|---|
| Valores monetários | Centavos inteiros não negativos dentro do limite seguro de Number; não converte strings, NaN ou floats |
| Distância e raio | Metros inteiros; raio positivo; endereço sem distância validada não recebe cotação |
| Prazo | Intervalo em minutos inteiros não negativos, máximo maior ou igual ao mínimo |
| Pedido mínimo | Subtotal dos produtos, sem frete; igualdade ao mínimo é aceita |
| Frete grátis | `null` desativa; subtotal deve ser estritamente maior que `freteGratisAcimaDeCentavos`, conforme “acima de” no escopo; igualdade continua cobrada |
| Retirada | `retiradaHabilitada` informa apenas a configuração do canal, não autoriza um pedido nem valida horário/estoque |

- **Fixa:** mesma taxa e prazo dentro do raio.
- **Bairro:** ID exato da área validada, sem aproximação pelo nome digitado. Bairros desativados ou desconhecidos não têm fallback gratuito. IDs repetidos invalidam a configuração.
- **Distância:** faixas ordenadas por limite superior, sem repetições, com cobertura até o raio máximo. Cada limite superior é inclusivo; a faixa seguinte começa após esse limite. Não há extrapolação automática para distâncias não atendidas.
- Cobertura e pedido mínimo são conferidos antes da isenção. Um subtotal alto não libera endereço fora do raio, bairro desativado ou endereço não validado.
- Resultado copia o intervalo de prazo, preservando os objetos de entrada.

## O que permanece pendente

Persistência/validação das configurações da loja, tabelas e APIs do marketplace, geocodificação e validação do endereço (card próprio), horários de entrega, estoque, formação do subtotal/descontos, autorização e criação idempotente do pedido. A taxa aceita deverá ser gravada no pedido e congelada conforme o escopo. A comissão deve continuar excluindo o frete. Nenhum desses fluxos é simulado por este módulo.

Este cálculo não recebe cupom e não aplica desconto sobre a taxa. A política de subtotal para cupom e mínimo/isenção ainda precisa ser integrada no checkout futuro; não foi criada implicitamente nesta entrega.

O card pode passar para **In Progress**, com a observação “motor de cálculo implementado; integração com loja/pedido pendente”. Atualização do board continua manual, conforme orientação do usuário. As fases futuras e os pagamentos permanecem sem ativação.

## Validação

`node --test supabase/tests/frete.test.mjs`: nove casos com múltiplas entradas sintéticas, cobrindo os três modos, limites de faixa/raio, mínimo e isenção, ausência de endereço, bairro, dados inválidos, configuração ambígua e imutabilidade do resultado. Os valores dos fixtures não são preços do PetLive.

Suíte Node completa do backend: **27 testes aprovados**. Deno 2.5.6 `check` e `lint` aprovados, sem rede ou credenciais. O CI executa a suíte e a verificação de tipos/lint do módulo. Nenhuma alteração no app/web exige novo build nesta entrega.
