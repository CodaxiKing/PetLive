# Compatibilidade de privacidade — 25/10/2026

Produção usa tipo excluir/status pendente (com FK Auth SET NULL); a migration
original esperava apagar/novo. Contagem agregada: nenhum pedido preexistente.
Não foram consultados dados pessoais. Migration 20261215000000 testada em
PGlite com ambos os schemas, reaplicação, isolamento, cancelamento idempotente,
log e bloqueio de acesso anônimo/direto. Em produção: transação ROLLBACK de
validação, depois COMMIT; funções/permissões conferidas. Anon não executa estado
e authenticated não insere diretamente. Nenhum pedido/arquivo fictício criado.

privacidade_estado(uuid) consulta os dois formatos. Cancelamento opera somente
no pedido da própria conta que ainda não entrou em execução, com bloqueio de
linha; repetição após cancelamento é aceita. Log de exportação não copia e-mail.
Parâmetro de conta esperada evita usar outra sessão entre consulta e chamada.

App mostra carregamento/falha e nova tentativa; não interpreta falha como zero
pedidos. Invalida respostas ao sair/trocar de conta, exige recibo válido e confere
conta depois do compartilhamento antes de registrar exportação. Falha do log é
visível. Nove testes focados, TypeScript e lint passaram no commit f858416.

Novas solicitações pelo app ficam explicitamente indisponíveis (pode_solicitar
false) até homologar o worker, bloqueio de uploads durante execução, fila/estados
e cron. Nada agenda/executa exclusão nesta migration; não foi ativado o worker.
Cancelamento de pedido próprio anterior continua disponível quando permitido.
Exclusão automática em produção permanece pendente, com tasks APP/BACKEND em
andamento. Não confundir esta implantação com conclusão do fluxo LGPD.
