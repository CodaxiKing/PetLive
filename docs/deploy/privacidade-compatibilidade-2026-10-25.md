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

## Preview publicado — 25/10/2026

APK 74634fba-1899-4717-ab63-d54033078a75 concluído (fonte 9436a23): https://expo.dev/artifacts/eas/erbQTPVVu1VTGEQ4QliAit9WD0ZBjU_ehrHucR1JpyU.apk . Download local solicitado: build/apk/PetLive-preview-2026-10-25.apk, 178799507 bytes, SHA256 65EDEAF57AFF794C20F356C6AF903535172152A33574B79984ECF1DA3B88181B. Arquivo ignorado pelo Git; manifest/classes.dex conferidos. Usuário informou que conseguiu acessar/obter o arquivo, sem confirmação funcional dos fluxos ainda.

OTA Android preview adbdacbf-3c99-4aaa-9002-afead428dd37 publicada a partir de bc152f387f2f020985950f76cc46e0e4b47ce485: https://expo.dev/accounts/codaxi/projects/petlive-tutor/updates/adbdacbf-3c99-4aaa-9002-afead428dd37 . Runtime 782d3618069253d333bb21ef58e609d7ef25e74e, igual ao APK e ao fingerprint calculado com perfil preview. Inclui compatibilidade de privacidade, resumo real de compartilhamentos e álbum anual. Abrir com internet e reabrir para receber; o APK antigo com runtime diferente não recebe essa OTA.

Cópia limpa: 274 testes/46 arquivos, TypeScript e lint aprovados, bundle Android gerado. Warnings transitivos do expo-router em export caíram para resolução de arquivos; bundle concluído. Homologação no aparelho continua pendente. Migrations 20261215000000 e 20261216000000 aplicadas em produção após ROLLBACK de validação; grants conferidos. Não ativada exclusão automática nem implantados serviços antigos de cuidador/carteirinha ausentes. RPCs cuidador_visao e cuidador_marcar_dose também confirmadas ausentes, além das rotinas de criação/revogação. Tasks afetadas reabertas. OCR depende de serviço de leitura ainda não implementado; tarefa de revisão não foi anunciada como concluída nem recebeu dados simulados.
