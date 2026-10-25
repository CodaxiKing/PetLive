# Consulta de Minha assinatura

Tela `/premium/assinatura`, acessível pelo Perfil e pela tela Premium, seguindo a referência `prototipo/MinhaAssinatura.dc.html`: herói roxo, card de plano e contrato, estado, período, valor e forma de pagamento.

Fonte de autorização continua `profiles.plano`. Um contrato registrado não concede Premium automaticamente. Premium sem contrato mostra o acesso atual, sem inventar preço ou cobrança. Sem contrato há estado vazio; falha de rede permite tentar novamente. A resposta de uma conta anterior é descartada ao trocar de conta ou sair da tela. Não há cache de dados de cobrança.

Migration `20261228000000_consulta_assinatura.sql`: tabela `subscriptions`, RLS, sem acesso direto para anon/authenticated; escrita apenas pelo serviço de cobrança. RPC `minha_assinatura(p_tutor)` valida auth.uid, devolve somente os dados de exibição da própria conta e omite referência privada do provedor. Prioriza um contrato vigente sobre uma tentativa encerrada mais recente. Não armazena dados de cartão, tokens, payloads nem URLs de pagamento.

Compra e gestão ainda indisponíveis: mudar para mensal, atualizar pagamento e cancelar dependem da integração com o provedor e confirmação dos webhooks. A tela não oferece botões que simulem essas operações. Estado `cancelando` informa preservação do período pago; períodos encerrados nunca são exibidos como renovação futura. Falha de cobrança não é apresentada como renovação confirmada.

Validações: 330 testes do tutor; PGlite verifica isolamento, ausência de escrita cliente, retorno sem referência privada, separação do benefício e contrato, ordenação dos contratos e reaplicação. Migration verificada no schema real de produção com rollback antes da instalação.

Pendente no board: integração de gestão e cobrança real; teste no Android. Não considerar a task concluída. O APK anterior (`4c110fc6-2b45-4160-9e46-eccb2b41bbe8`) não contém esta tela. Limites de plano continuam desligados.

Produção instalada após o commit `b2b4b5a`. Metadados confirmados: `rls=true`, `cliente_altera=false`, `cliente_le_tabela=false`, `cliente_consulta_rpc=true`, `anon_consulta=false`, `limites_ativos=false`. Sem criação de contratos ou cobranças de teste em produção. Board Minha assinatura atualizado para Em andamento com as pendências acima. TypeScript e lint passaram após geração das novas rotas pelo Expo.
