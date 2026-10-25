# Exportação de avisos — 25/10/2026

A migration 20261222000000_exportacao_avisos_privados.sql complementa o exportador composto existente. Mantém pets, saúde e compartilhamentos anteriores; substitui tokens_de_push por metadados de dispositivos (id, plataforma, ativo, criado_em) e inclui o processamento dos avisos de fichas da própria conta. Não exporta token bruto, hash, identificador da requisição HTTP ou ticket/recibo Expo.

A nova RPC privacidade_exportar_dados(p_tutor) exige que a conta autenticada corresponda à conta esperada pelo cliente. O ponto de entrada antigo continua disponível para clientes anteriores, com a mesma sanitização. O exportador interno anterior fica inacessível a authenticated e anon. O app também recusa payload nulo, lista ou texto para evitar arquivo parcial apresentado como exportação.

Validação: PGlite com dados fictícios de três contas, reaplicação, preservação dos campos anteriores, isolamento, ausência de tokens/recibos, conta esperada e bloqueio de acesso anônimo/interno. Migration validada no esquema real com ROLLBACK antes da aplicação; nenhum dado pessoal consultado/exportado. Tutor: 291 testes em 49 arquivos, TypeScript e lint aprovados.

Esta entrega não ativa solicitações nem processamento de exclusão de contas. As tarefas de privacidade permanecem Em andamento enquanto faltarem homologação do worker, concorrência/bloqueio de uploads, agendamento e validação nativa do fluxo completo. Firebase não é necessário para a exportação. O cliente deste commit ainda precisa de uma entrega compatível de APK/OTA; o novo app config de push da main exige reavaliar o runtime, sem forçar a atualização no APK instalado.
