# Coroa de destaque pago das lojas

Regra solicitada pelo usuário: coroa dourada girando sobre o pin da loja no mapa e na ficha/perfil. O pin preserva categoria, seleção, posição/âncora e ação de abrir a ficha. A ficha exibe a coroa e o texto Destaque pago, separados de nota/avaliações. Não altera filtros, distância, avaliações ou classificação de resultados. Nenhuma dependência nativa nova.

## Ativação e validade

`lugares_destaques_pagos` é privada, com RLS, escrita/leitura direta somente service_role. O backend confiável deve inserir/atualizar o registro apenas depois de validar o pagamento no provedor e o vínculo com a loja: lugar_id (UUID de places ou place_id), pagamento_ref única, pagamento_confirmado_em, inicio_em, fim_em e status ativo/cancelado/reembolsado. Não guardar segredos/cartão na referência. Esta entrega não implementa checkout/webhook e não valida cobranças por conta própria. Não inserir registros para simular pagamento em produção.

RPC autenticada `destaques_lugares(text[])` aceita até 200 IDs por consulta e retorna somente IDs/vencimentos ativos e hora do servidor; não expõe referências financeiras. Pagamento com data futura, período futuro/vencido, cancelamento e reembolso não dão coroa. Períodos sobrepostos para o mesmo lugar retornam um único prazo vigente.

No cliente, busca em lotes de 200 (até 1000 lugares combinados), ao focar/retomar o app e a cada 60 s. O vencimento tem temporizador próprio; o prazo considera hora do servidor e desconta latência. Cancelamentos novos aparecem na próxima consulta, em até 60 s enquanto a tela estiver ativa e conectada. Consulta falha limpa as coroas: cache/offline do mapa nunca comprova pagamento. Os dados básicos do mapa continuam funcionando mesmo sem serviço de destaque.

## Animação e acessibilidade

Giro de 4 s sobre o eixo vertical, com espaço acima do pin para não cortar a coroa. Native driver e isInteraction false. Uma assinatura de movimento/foco/AppState por mapa; pins recebem o booleano. Pausa fora da tela/em segundo plano e fica estática com reduzir movimento. No Google Android, redraw explícito só nos pins patrocinados em animação, a 10 quadros/s, porque o marcador usa snapshots; MapLibre usa a View nativa. Performance e recorte precisam de homologação no aparelho.

Referências: [Marker MapLibre](https://maplibre.org/maplibre-react-native/docs/components/annotations/marker/), [Marker Google/redraw](https://github.com/react-native-maps/react-native-maps/blob/master/docs/marker.md), [Animated](https://reactnative.dev/docs/animated).

## Verificações e homologação

Testes do cliente cobrem hora do servidor/latência, vencimento, dados inválidos, IDs não solicitados, propriedades herdadas, lote vazio, deduplicação, limite e divisão em lotes. PGlite `supabase/tests/testar-destaques-pagos.mjs` reaplica migration e cobre conta/anon, vigência/início/fim, cancelamento/reembolso, sobreposição, projeção pública e bloqueio de autopromoção. Pagamentos fictícios somente no banco em memória.

No Android/iOS, com pagamento real confirmado por integração confiável ou ambiente isolado de homologação: conferir pin comum/selecionado, coroa sem corte, toque/rota/favorito, ficha com e sem foto, texto ampliado e TalkBack/VoiceOver. Testar reduzir movimento, mudança em tempo real dessa preferência, sair/voltar e segundo plano. Conferir vencimento, cancelamento, reembolso, rede indisponível e retomada. Medir desempenho do Google Android com vários destaques. Não usar uma loja real como anúncio fictício para validar o visual. Integração de cobrança e teste nativo permanecem pendentes.

## Implantação — 24/10/2026

Código `49d99a6` enviado à main e regra registrada em BUSINESS.md. Migration `20261213000000_destaques_pagos_lugares.sql` aplicada em produção após validação ROLLBACK. Conferidos RLS, acesso anônimo bloqueado e INSERT/SELECT direto negados ao cliente. Zero destaques/pagamentos cadastrados em produção; ativação automática pelo checkout/webhook permanece pendente.

Cópia limpa: 252 testes/42 arquivos, TypeScript, lint e export Metro Android aprovados. Preview publicado: https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/77bce15b-19b3-410e-b1dd-65b47b505e60 . Runtime `dff916ce37166d489949d7b3020e4ed90d1755dd`, compatível com APK `efb3cb3b-a260-427c-b501-21dde90e5dd0`. Sem novo APK ou Redeploy do site. Publicação confirmada, homologação visual/nativa pendente.
